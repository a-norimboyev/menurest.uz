import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import pg from 'pg'

dotenv.config()

const BOT_TOKEN = process.env.BOT_TOKEN
const DATABASE_URL = process.env.DATABASE_URL
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID ? Number(process.env.ALLOWED_USER_ID) : null
const SYNC_USER_ID = process.env.SYNC_USER_ID || 'azizjon-365-sync'

const DAY_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
const DEFAULT_GOAL = 70
const DEFAULT_ROWS_PER_DAY = 7
const HISTORY_KEY = 'planner-history-v1'
const DAILY_QUOTES_KEY = 'planner-daily-motivation-v1'
const RECURRING_KEY = 'planner-recurring-v1'

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required in bot/.env')
  process.exit(1)
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required in bot/.env')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const bot = new TelegramBot(BOT_TOKEN, { polling: false })

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sendHtml(chatId, html, options = {}) {
  return bot.sendMessage(chatId, html, { parse_mode: 'HTML', ...options })
}

function isAllowed(msg) {
  if (!ALLOWED_USER_ID) return true
  return msg.from?.id === ALLOWED_USER_ID
}

function ensureAllowed(msg) {
  if (isAllowed(msg)) return true
  sendHtml(msg.chat.id, '⛔ <b>Bu bot siz uchun yopiq.</b>')
  return false
}

function getISOWeekId(date = new Date()) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7)
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getDateId(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getTodayDayIndex(date = new Date()) {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

function parseStoredObject(value, fallback) {
  if (!value) return fallback
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizePriority(value) {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium'
}

function getPriorityIcon(priority) {
  if (priority === 'high') return '🔴'
  if (priority === 'low') return '🟢'
  return '🟡'
}

function getPriorityLabel(priority) {
  if (priority === 'high') return 'Yuqori'
  if (priority === 'low') return 'Past'
  return "O'rta"
}

function createEmptyWeekState(weekId) {
  return {
    weekId,
    goal: DEFAULT_GOAL,
    days: Array.from({ length: 7 }, () =>
      Array.from({ length: DEFAULT_ROWS_PER_DAY }, () => ({
        text: '',
        done: false,
        priority: 'medium',
        carryDays: 0,
      })),
    ),
  }
}

function normalizeWeekState(raw, weekId) {
  const fallback = createEmptyWeekState(weekId)
  const source = raw && typeof raw === 'object' ? raw : {}

  return {
    weekId,
    goal: Number.isFinite(Number(source.goal)) ? Math.max(1, Math.min(100, Number(source.goal))) : DEFAULT_GOAL,
    days: fallback.days.map((dayRows, dayIndex) => {
      const storedRows = Array.isArray(source.days?.[dayIndex]) ? source.days[dayIndex] : []
      const rowCount = Math.max(dayRows.length, storedRows.length)

      return Array.from({ length: rowCount }, (_, rowIndex) => {
        const row = storedRows[rowIndex]
        return {
          text: typeof row?.text === 'string' ? row.text : '',
          done: Boolean(row?.done),
          priority: normalizePriority(row?.priority),
          carryDays: Number.isFinite(Number(row?.carryDays)) ? Math.max(0, Number(row.carryDays)) : 0,
        }
      })
    }),
  }
}

function getWeekData(payload, weekId) {
  if (payload?.weekState?.weekId === weekId) {
    return normalizeWeekState(payload.weekState, weekId)
  }

  const legacyKey = `planner-week-${weekId}`
  const legacyValue = parseStoredObject(payload?.[legacyKey], null)
  if (legacyValue) {
    return normalizeWeekState(legacyValue, weekId)
  }

  return null
}

function setWeekData(payload, week) {
  payload.weekState = week
  payload[`planner-week-${week.weekId}`] = JSON.stringify(week)
  payload.updatedAt = Date.now()
  payload.dateId = getDateId()
}

function getDailyQuotes(payload) {
  if (payload?.dailyQuotes && typeof payload.dailyQuotes === 'object') {
    return payload.dailyQuotes
  }

  return parseStoredObject(payload?.[DAILY_QUOTES_KEY], {})
}

function setDailyQuotes(payload, quotes) {
  payload.dailyQuotes = quotes
  payload[DAILY_QUOTES_KEY] = JSON.stringify(quotes)
  payload.updatedAt = Date.now()
  payload.dateId = getDateId()
}

function getRecurringTemplates(payload) {
  if (Array.isArray(payload?.recurringTemplates)) {
    return payload.recurringTemplates
  }

  const legacy = parseStoredObject(payload?.[RECURRING_KEY], [])
  return Array.isArray(legacy) ? legacy : []
}

function getRecurringDone(payload, dateId, minLength) {
  if (payload?.dateId === dateId && Array.isArray(payload?.recurringDone)) {
    return Array.from({ length: Math.max(minLength, payload.recurringDone.length) }, (_, index) => Boolean(payload.recurringDone[index]))
  }

  const legacyKey = `planner-recurring-done-${dateId}`
  const legacy = parseStoredObject(payload?.[legacyKey], [])
  return Array.from({ length: Math.max(minLength, Array.isArray(legacy) ? legacy.length : 0) }, (_, index) => Boolean(legacy[index]))
}

function updateHistory(payload, week) {
  const allTasks = week.days.flat().filter((task) => task.text.trim().length > 0)
  const doneTasks = allTasks.filter((task) => task.done).length
  const percent = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0

  const history = payload.history && typeof payload.history === 'object'
    ? payload.history
    : parseStoredObject(payload[HISTORY_KEY], {})

  history[week.weekId] = {
    weekId: week.weekId,
    percent,
    done: doneTasks,
    total: allTasks.length,
    updatedAt: Date.now(),
  }

  payload.history = history
  payload[HISTORY_KEY] = JSON.stringify(history)
}

function getTodayFilledTasks(week, date = new Date()) {
  const dayIndex = getTodayDayIndex(date)
  const rows = Array.isArray(week.days?.[dayIndex]) ? week.days[dayIndex] : []
  return rows
    .map((task, rowIndex) => ({ task, rowIndex }))
    .filter(({ task }) => task.text.trim().length > 0)
}

function parsePriorityKeyword(value) {
  const normalized = value.trim().toLowerCase()
  if (['high', 'yuqori', 'muhim'].includes(normalized)) return 'high'
  if (['low', 'past'].includes(normalized)) return 'low'
  if (['medium', 'orta', "o'rta", 'normal'].includes(normalized)) return 'medium'
  return null
}

function parseTaskInput(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) return { text: '', priority: 'medium' }

  const delimiterIndex = raw.indexOf('|')
  if (delimiterIndex === -1) {
    return { text: raw, priority: 'medium' }
  }

  const left = raw.slice(0, delimiterIndex).trim()
  const right = raw.slice(delimiterIndex + 1).trim()
  const parsedPriority = parsePriorityKeyword(left)

  if (!parsedPriority) {
    return { text: raw, priority: 'medium' }
  }

  return { text: right, priority: parsedPriority }
}

function getProgressBar(percent) {
  let bar = ''
  for (let index = 0; index < 10; index += 1) {
    bar += index < Math.round(percent / 10) ? '🟧' : '⬜'
  }
  return bar
}

async function ensureSchema() {
  await pool.query(`
    create table if not exists planner_sync (
      user_id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `)
}

async function loadPayload() {
  const result = await pool.query('select payload from planner_sync where user_id = $1 limit 1', [SYNC_USER_ID])
  if (result.rowCount === 0) return null

  const payload = result.rows[0].payload
  return payload && typeof payload === 'object' ? payload : null
}

async function savePayload(payload) {
  await pool.query(
    `insert into planner_sync (user_id, payload, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (user_id)
     do update set payload = excluded.payload, updated_at = now()`,
    [SYNC_USER_ID, JSON.stringify(payload)],
  )
}

async function withPayload(msg, handler) {
  try {
    const payload = await loadPayload()
    if (!payload) {
      await sendHtml(msg.chat.id, "❌ <b>Ma'lumot topilmadi.</b> Avval ilovadan sync qiling.")
      return
    }

    await handler(payload)
  } catch (error) {
    console.error(error)
    await sendHtml(msg.chat.id, '❌ <b>Xatolik yuz berdi.</b>')
  }
}

function getHelpText() {
  return [
    '🗓 <b>365 Reja Bot</b>',
    '',
    'Buyruqlar:',
    '/bugun - Bugungi vazifalar',
    '/hafta - Haftalik reja',
    '/stat - Statistika',
    '/kunlik - Doimiy vazifalar',
    "/qosh [yuqori|o'rta|past] | matn - Vazifa qo'shish",
    '/bajar 2 - Bugungi 2-vazifani bajarildi qilish',
    '/bekor 2 - Belgilangan vazifani qayta ochish',
    '/yoz Matn - Kunlik yozuv saqlash',
    '/eslatma - Bajarilmagan vazifalar',
  ].join('\n')
}

bot.onText(/^\/(?:start|help)$/, async (msg) => {
  if (!ensureAllowed(msg)) return
  await sendHtml(msg.chat.id, getHelpText())
})

bot.onText(/^\/bugun$/, async (msg) => {
  if (!ensureAllowed(msg)) return

  await withPayload(msg, async (payload) => {
    const weekId = getISOWeekId()
    const week = getWeekData(payload, weekId)
    if (!week) {
      await sendHtml(msg.chat.id, `📭 <b>Bu hafta (${escapeHtml(weekId)}) uchun reja topilmadi.</b>`)
      return
    }

    const dateId = getDateId()
    const dayIndex = getTodayDayIndex()
    const dayName = DAY_NAMES[dayIndex]
    const filled = getTodayFilledTasks(week)
    const todayQuote = getDailyQuotes(payload)[dateId]

    let text = `📅 <b>${escapeHtml(dayName)}</b> (${escapeHtml(dateId)})\n\n`

    if (filled.length === 0) {
      text += '<i>Vazifalar yo\'q</i>\n'
    } else {
      filled.forEach(({ task }, index) => {
        const carryLabel = task.carryDays > 0 ? ` <i>(+${task.carryDays} kun)</i>` : ''
        text += `${index + 1}. ${task.done ? '✅' : '⬜'} ${getPriorityIcon(task.priority)} ${escapeHtml(task.text)}${carryLabel}\n`
      })
    }

    const doneCount = filled.filter(({ task }) => task.done).length
    text += `\n📊 <b>${doneCount}/${filled.length}</b> bajarildi`

    if (todayQuote) {
      text += `\n\n✍️ <i>${escapeHtml(todayQuote)}</i>`
    }

    await sendHtml(msg.chat.id, text)
  })
})

bot.onText(/^\/hafta$/, async (msg) => {
  if (!ensureAllowed(msg)) return

  await withPayload(msg, async (payload) => {
    const weekId = getISOWeekId()
    const week = getWeekData(payload, weekId)
    if (!week) {
      await sendHtml(msg.chat.id, `📭 <b>Bu hafta (${escapeHtml(weekId)}) uchun reja topilmadi.</b>`)
      return
    }

    const todayIndex = getTodayDayIndex()
    let text = `🗓 <b>Hafta: ${escapeHtml(weekId)}</b>\n\n`

    DAY_NAMES.forEach((name, index) => {
      const tasks = Array.isArray(week.days?.[index]) ? week.days[index] : []
      const filled = tasks.filter((task) => task.text.trim().length > 0)
      const done = filled.filter((task) => task.done).length
      const icon = filled.length === 0 ? '📭' : done === filled.length ? '✅' : '📝'
      const todayMarker = index === todayIndex ? ' - bugun' : ''
      text += `${icon} <b>${escapeHtml(name)}</b>: ${done}/${filled.length}${todayMarker}\n`
    })

    const allTasks = week.days.flat().filter((task) => task.text.trim().length > 0)
    const totalDone = allTasks.filter((task) => task.done).length
    const percent = allTasks.length > 0 ? Math.round((totalDone / allTasks.length) * 100) : 0
    text += `\n📊 Jami: <b>${totalDone}/${allTasks.length}</b> (${percent}%)`
    text += `\n🎯 Maqsad: <b>${week.goal || DEFAULT_GOAL}%</b>`

    await sendHtml(msg.chat.id, text)
  })
})

bot.onText(/^\/stat$/, async (msg) => {
  if (!ensureAllowed(msg)) return

  await withPayload(msg, async (payload) => {
    const week = getWeekData(payload, getISOWeekId())
    if (!week) {
      await sendHtml(msg.chat.id, "📭 <b>Bu hafta uchun statistika yo'q.</b>")
      return
    }

    const allTasks = week.days.flat().filter((task) => task.text.trim().length > 0)
    const totalDone = allTasks.filter((task) => task.done).length
    const percent = allTasks.length > 0 ? Math.round((totalDone / allTasks.length) * 100) : 0
    const highTasks = allTasks.filter((task) => task.priority === 'high')
    const highDone = highTasks.filter((task) => task.done).length
    const todayTasks = getTodayFilledTasks(week)
    const todayDone = todayTasks.filter(({ task }) => task.done).length
    const goal = week.goal || DEFAULT_GOAL

    let text = '📊 <b>Haftalik Statistika</b>\n\n'
    text += `${getProgressBar(percent)} ${percent}%\n\n`
    text += `📋 Jami vazifalar: <b>${allTasks.length}</b>\n`
    text += `✅ Bajarildi: <b>${totalDone}</b>\n`
    text += `⬜ Qoldi: <b>${allTasks.length - totalDone}</b>\n`
    text += `🔴 Muhim: <b>${highDone}/${highTasks.length}</b>\n`
    text += `📅 Bugun: <b>${todayDone}/${todayTasks.length}</b>\n`
    text += `🎯 Maqsad: <b>${goal}%</b>\n`
    text += percent >= goal
      ? '\n🏆 <b>Maqsadga erishdingiz!</b>'
      : `\n💪 Maqsadgacha <b>${goal - percent}%</b> qoldi`

    await sendHtml(msg.chat.id, text)
  })
})

bot.onText(/^\/kunlik$/, async (msg) => {
  if (!ensureAllowed(msg)) return

  await withPayload(msg, async (payload) => {
    const dateId = getDateId()
    const templates = getRecurringTemplates(payload)
    const filled = templates
      .map((item, index) => ({ text: typeof item?.text === 'string' ? item.text.trim() : '', index }))
      .filter((item) => item.text.length > 0)

    if (filled.length === 0) {
      await sendHtml(msg.chat.id, "📭 <b>Kunlik vazifalar topilmadi.</b>")
      return
    }

    const doneRows = getRecurringDone(payload, dateId, templates.length)
    let text = `🔁 <b>Kunlik vazifalar</b> (${escapeHtml(dateId)})\n\n`

    filled.forEach(({ text: taskText, index }, position) => {
      text += `${position + 1}. ${doneRows[index] ? '✅' : '⬜'} ${escapeHtml(taskText)}\n`
    })

    const doneCount = filled.filter(({ index }) => doneRows[index]).length
    text += `\n📊 <b>${doneCount}/${filled.length}</b> bajarildi`

    await sendHtml(msg.chat.id, text)
  })
})

bot.onText(/^\/qosh(?:\s+(.+))?$/, async (msg, match) => {
  if (!ensureAllowed(msg)) return

  const parsed = parseTaskInput(match?.[1])
  if (!parsed.text) {
    await sendHtml(msg.chat.id, "Vazifa matnini yozing: <code>/qosh yuqori | Kitob o'qish</code>")
    return
  }

  await withPayload(msg, async (payload) => {
    const weekId = getISOWeekId()
    const week = getWeekData(payload, weekId) || createEmptyWeekState(weekId)
    const dayIndex = getTodayDayIndex()
    const rows = [...week.days[dayIndex]]
    const emptyIndex = rows.findIndex((task) => task.text.trim().length === 0)
    const targetIndex = emptyIndex >= 0 ? emptyIndex : rows.length

    rows[targetIndex] = {
      text: parsed.text,
      done: false,
      priority: parsed.priority,
      carryDays: 0,
    }

    week.days[dayIndex] = rows
    setWeekData(payload, week)
    updateHistory(payload, week)
    await savePayload(payload)

    await sendHtml(
      msg.chat.id,
      `✅ Qo'shildi: <b>${escapeHtml(parsed.text)}</b>\n📅 ${escapeHtml(DAY_NAMES[dayIndex])}, slot ${targetIndex + 1}\n🏷 ${escapeHtml(getPriorityLabel(parsed.priority))}`,
    )
  })
})

async function updateTaskDoneState(msg, orderText, isDone) {
  if (!ensureAllowed(msg)) return

  const order = Number.parseInt(String(orderText || '').trim(), 10)
  if (!Number.isInteger(order) || order < 1) {
    await sendHtml(msg.chat.id, `Raqam kiriting: <code>/${isDone ? 'bajar' : 'bekor'} 2</code>`)
    return
  }

  await withPayload(msg, async (payload) => {
    const weekId = getISOWeekId()
    const week = getWeekData(payload, weekId)
    if (!week) {
      await sendHtml(msg.chat.id, "📭 <b>Bugungi vazifalar topilmadi.</b>")
      return
    }

    const filled = getTodayFilledTasks(week)
    const selected = filled[order - 1]
    if (!selected) {
      await sendHtml(msg.chat.id, `⚠️ <b>${order}-raqamli vazifa yo'q.</b> /bugun bilan ro'yxatni ko'ring.`)
      return
    }

    week.days[getTodayDayIndex()][selected.rowIndex] = {
      ...selected.task,
      done: isDone,
    }

    setWeekData(payload, week)
    updateHistory(payload, week)
    await savePayload(payload)

    await sendHtml(
      msg.chat.id,
      `${isDone ? '✅' : '↩️'} <b>${escapeHtml(selected.task.text)}</b> ${isDone ? 'bajarildi deb belgilandi' : 'qayta ochildi'}.`,
    )
  })
}

bot.onText(/^\/bajar(?:\s+(.+))?$/, async (msg, match) => {
  await updateTaskDoneState(msg, match?.[1], true)
})

bot.onText(/^\/bekor(?:\s+(.+))?$/, async (msg, match) => {
  await updateTaskDoneState(msg, match?.[1], false)
})

bot.onText(/^\/yoz(?:\s+(.+))?$/, async (msg, match) => {
  if (!ensureAllowed(msg)) return

  const note = String(match?.[1] || '').trim()
  if (!note) {
    await sendHtml(msg.chat.id, "Yozuv matnini yozing: <code>/yoz Bugun yaxshi o'tdi</code>")
    return
  }

  await withPayload(msg, async (payload) => {
    const quotes = getDailyQuotes(payload)
    const dateId = getDateId()
    quotes[dateId] = note
    setDailyQuotes(payload, quotes)
    await savePayload(payload)
    await sendHtml(msg.chat.id, `✍️ Saqlandi (${escapeHtml(dateId)}):\n<i>${escapeHtml(note)}</i>`)
  })
})

bot.onText(/^\/eslatma$/, async (msg) => {
  if (!ensureAllowed(msg)) return

  await withPayload(msg, async (payload) => {
    const week = getWeekData(payload, getISOWeekId())
    if (!week) {
      await sendHtml(msg.chat.id, "📭 <b>Bu hafta uchun reja yo'q.</b>")
      return
    }

    const dayIndex = getTodayDayIndex()
    const dayName = DAY_NAMES[dayIndex]
    const undone = getTodayFilledTasks(week).filter(({ task }) => !task.done)

    if (undone.length === 0) {
      await sendHtml(msg.chat.id, `🎉 <b>${escapeHtml(dayName)}</b> - barcha vazifalar bajarilgan!`)
      return
    }

    let text = `⏰ <b>${escapeHtml(dayName)} eslatma</b>\n\nBajarilmagan vazifalar:\n\n`
    undone.forEach(({ task }, index) => {
      text += `${index + 1}. ${getPriorityIcon(task.priority)} ${escapeHtml(task.text)}\n`
    })
    text += `\n💪 <b>${undone.length}</b> ta vazifa kutmoqda!`

    await sendHtml(msg.chat.id, text)
  })
})

bot.on('message', async (msg) => {
  if (!isAllowed(msg)) return

  if (msg.text?.startsWith('/') && !/^\/(start|help|bugun|hafta|stat|kunlik|qosh|bajar|bekor|yoz|eslatma)(?:\s|$)/.test(msg.text)) {
    await sendHtml(msg.chat.id, "❓ <b>Noma'lum buyruq.</b> /start ni bosing.")
  }
})

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error?.message || error)

  if (String(error?.message || '').includes('ETELEGRAM: 409')) {
    console.error('Another Telegram bot instance is already polling. Stop the old process first.')
  }
})

ensureSchema()
  .then(async () => {
    await pool.query('select 1')
    await bot.startPolling()
    console.log('🤖 365 Reja Telegram bot ishga tushdi!')
  })
  .catch((error) => {
    console.error('Failed to start Telegram bot:', error)
    process.exit(1)
  })
