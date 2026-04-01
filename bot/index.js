import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import pg from 'pg'

dotenv.config()

const BOT_TOKEN = process.env.BOT_TOKEN
const DATABASE_URL = process.env.DATABASE_URL
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID ? Number(process.env.ALLOWED_USER_ID) : null
const SYNC_USER_ID = process.env.SYNC_USER_ID || 'azizjon-365-sync'

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required in bot/.env')
  process.exit(1)
}
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required in bot/.env')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const bot = new TelegramBot(BOT_TOKEN, { polling: true })

const DAY_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']

// ── Helpers ──

function isAllowed(msg) {
  if (!ALLOWED_USER_ID) return true
  return msg.from.id === ALLOWED_USER_ID
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

function getTodayDayIndex() {
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1
}

async function loadPayload() {
  const result = await pool.query(
    'SELECT payload FROM planner_sync WHERE user_id = $1 LIMIT 1',
    [SYNC_USER_ID],
  )
  if (result.rowCount === 0) return null
  return result.rows[0].payload
}

async function savePayload(payload) {
  await pool.query(
    `INSERT INTO planner_sync (user_id, payload, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET payload = $2, updated_at = now()`,
    [SYNC_USER_ID, JSON.stringify(payload)],
  )
}

function getWeekData(payload, weekId) {
  const key = `planner-week-${weekId}`
  const raw = payload?.[key]
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

function getDailyQuotes(payload) {
  const key = 'planner-daily-motivation-v1'
  const raw = payload?.[key]
  if (!raw) return {}
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

// ── Commands ──

bot.onText(/\/start/, (msg) => {
  if (!isAllowed(msg)) return
  bot.sendMessage(
    msg.chat.id,
    `🗓 *365 Reja Bot*\n\nBuyruqlar:\n/bugun — Bugungi vazifalar\n/hafta — Haftalik reja\n/stat — Statistika\n/qosh — Vazifa qo'shish\n/yoz — Kunlik yozuv\n/eslatma — Eslatma olish`,
    { parse_mode: 'Markdown' },
  )
})

// ── /bugun — Today's tasks ──

bot.onText(/\/bugun/, async (msg) => {
  if (!isAllowed(msg)) return
  try {
    const payload = await loadPayload()
    if (!payload) return bot.sendMessage(msg.chat.id, '❌ Ma\'lumot topilmadi. Avval ilovadan sync qiling.')

    const weekId = getISOWeekId()
    const week = getWeekData(payload, weekId)
    if (!week) return bot.sendMessage(msg.chat.id, `📭 Bu hafta (${weekId}) uchun reja topilmadi.`)

    const dayIdx = getTodayDayIndex()
    const dayName = DAY_NAMES[dayIdx]
    const tasks = week.days?.[dayIdx] || []
    const dateId = getDateId()

    const quotes = getDailyQuotes(payload)
    const todayQuote = quotes[dateId]

    let text = `📅 *${dayName}* (${dateId})\n\n`

    const filled = tasks.filter((t) => t.text?.trim())
    if (filled.length === 0) {
      text += '_Vazifalar yo\'q_\n'
    } else {
      filled.forEach((t) => {
        const icon = t.done ? '✅' : '⬜'
        const prio = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '🟢' : '🟡'
        text += `${icon} ${prio} ${t.text}\n`
      })
    }

    const doneCount = filled.filter((t) => t.done).length
    text += `\n📊 ${doneCount}/${filled.length} bajarildi`

    if (todayQuote) {
      text += `\n\n✍️ _${todayQuote}_`
    }

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error(err)
    bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.')
  }
})

// ── /hafta — Full week overview ──

bot.onText(/\/hafta/, async (msg) => {
  if (!isAllowed(msg)) return
  try {
    const payload = await loadPayload()
    if (!payload) return bot.sendMessage(msg.chat.id, '❌ Ma\'lumot topilmadi.')

    const weekId = getISOWeekId()
    const week = getWeekData(payload, weekId)
    if (!week) return bot.sendMessage(msg.chat.id, `📭 Bu hafta (${weekId}) uchun reja topilmadi.`)

    let text = `🗓 *Hafta: ${weekId}*\n\n`

    DAY_NAMES.forEach((name, idx) => {
      const tasks = week.days?.[idx] || []
      const filled = tasks.filter((t) => t.text?.trim())
      const done = filled.filter((t) => t.done).length
      const icon = filled.length === 0 ? '📭' : done === filled.length ? '✅' : '📝'
      text += `${icon} *${name}*: ${done}/${filled.length}\n`
    })

    const allTasks = week.days?.flat().filter((t) => t.text?.trim()) || []
    const totalDone = allTasks.filter((t) => t.done).length
    const pct = allTasks.length ? Math.round((totalDone / allTasks.length) * 100) : 0
    text += `\n📊 Jami: ${totalDone}/${allTasks.length} (${pct}%)`
    text += `\n🎯 Maqsad: ${week.goal || 70}%`

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error(err)
    bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.')
  }
})

// ── /stat — Statistics ──

bot.onText(/\/stat/, async (msg) => {
  if (!isAllowed(msg)) return
  try {
    const payload = await loadPayload()
    if (!payload) return bot.sendMessage(msg.chat.id, '❌ Ma\'lumot topilmadi.')

    const weekId = getISOWeekId()
    const week = getWeekData(payload, weekId)
    if (!week) return bot.sendMessage(msg.chat.id, `📭 Bu hafta uchun statistika yo'q.`)

    const allTasks = week.days?.flat().filter((t) => t.text?.trim()) || []
    const totalDone = allTasks.filter((t) => t.done).length
    const pct = allTasks.length ? Math.round((totalDone / allTasks.length) * 100) : 0

    const highTasks = allTasks.filter((t) => t.priority === 'high')
    const highDone = highTasks.filter((t) => t.done).length

    const todayIdx = getTodayDayIndex()
    const todayTasks = (week.days?.[todayIdx] || []).filter((t) => t.text?.trim())
    const todayDone = todayTasks.filter((t) => t.done).length

    let bar = ''
    for (let i = 0; i < 10; i++) {
      bar += i < Math.round(pct / 10) ? '🟧' : '⬜'
    }

    let text = `📊 *Haftalik Statistika*\n\n`
    text += `${bar} ${pct}%\n\n`
    text += `📋 Jami vazifalar: ${allTasks.length}\n`
    text += `✅ Bajarildi: ${totalDone}\n`
    text += `⬜ Qoldi: ${allTasks.length - totalDone}\n`
    text += `🔴 Muhim: ${highDone}/${highTasks.length}\n`
    text += `📅 Bugun: ${todayDone}/${todayTasks.length}\n`
    text += `🎯 Maqsad: ${week.goal || 70}%\n`

    const goalMet = pct >= (week.goal || 70)
    text += goalMet ? '\n🏆 Maqsadga erishdingiz!' : `\n💪 Maqsadgacha ${(week.goal || 70) - pct}% qoldi`

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error(err)
    bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.')
  }
})

// ── /qosh [text] — Add task to today ──

bot.onText(/\/qosh (.+)/, async (msg, match) => {
  if (!isAllowed(msg)) return
  const taskText = match[1].trim()
  if (!taskText) return bot.sendMessage(msg.chat.id, 'Vazifa matnini yozing: /qosh Kitob o\'qish')

  try {
    const payload = await loadPayload()
    if (!payload) return bot.sendMessage(msg.chat.id, '❌ Ma\'lumot topilmadi. Avval ilovadan sync qiling.')

    const weekId = getISOWeekId()
    const weekKey = `planner-week-${weekId}`
    let week = getWeekData(payload, weekId)

    if (!week) {
      week = {
        weekId,
        goal: 70,
        days: Array.from({ length: 7 }, () =>
          Array.from({ length: 7 }, () => ({ text: '', done: false, priority: 'medium' })),
        ),
        notes: Array.from({ length: 7 }, () => ''),
      }
    }

    const dayIdx = getTodayDayIndex()
    const tasks = week.days[dayIdx]
    const emptyIdx = tasks.findIndex((t) => !t.text?.trim())

    if (emptyIdx === -1) {
      return bot.sendMessage(msg.chat.id, '⚠️ Bugungi joylar to\'lgan (maks 7 vazifa).')
    }

    tasks[emptyIdx] = { text: taskText, done: false, priority: 'medium' }
    payload[weekKey] = JSON.stringify(week)
    await savePayload(payload)

    bot.sendMessage(msg.chat.id, `✅ Qo'shildi: *${taskText}*\n📅 ${DAY_NAMES[dayIdx]}, slot ${emptyIdx + 1}`, {
      parse_mode: 'Markdown',
    })
  } catch (err) {
    console.error(err)
    bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.')
  }
})

// ── /yoz [text] — Write daily note ──

bot.onText(/\/yoz (.+)/, async (msg, match) => {
  if (!isAllowed(msg)) return
  const note = match[1].trim()
  if (!note) return bot.sendMessage(msg.chat.id, 'Yozuv matnini yozing: /yoz Bugun ajoyib kun bo\'ldi')

  try {
    const payload = await loadPayload()
    if (!payload) return bot.sendMessage(msg.chat.id, '❌ Ma\'lumot topilmadi.')

    const quotesKey = 'planner-daily-motivation-v1'
    let quotes = getDailyQuotes(payload)
    const dateId = getDateId()

    quotes[dateId] = note
    payload[quotesKey] = JSON.stringify(quotes)
    await savePayload(payload)

    bot.sendMessage(msg.chat.id, `✍️ Saqlandi (${dateId}):\n_${note}_`, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error(err)
    bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.')
  }
})

// ── /eslatma — Morning reminder ──

bot.onText(/\/eslatma/, async (msg) => {
  if (!isAllowed(msg)) return
  try {
    const payload = await loadPayload()
    if (!payload) return bot.sendMessage(msg.chat.id, '❌ Ma\'lumot topilmadi.')

    const weekId = getISOWeekId()
    const week = getWeekData(payload, weekId)
    if (!week) return bot.sendMessage(msg.chat.id, `📭 Bu hafta uchun reja yo'q.`)

    const dayIdx = getTodayDayIndex()
    const dayName = DAY_NAMES[dayIdx]
    const tasks = (week.days?.[dayIdx] || []).filter((t) => t.text?.trim())
    const undone = tasks.filter((t) => !t.done)

    if (undone.length === 0) {
      return bot.sendMessage(msg.chat.id, `🎉 *${dayName}* — barcha vazifalar bajarilgan!`, {
        parse_mode: 'Markdown',
      })
    }

    let text = `⏰ *${dayName} eslatma*\n\nBajarilmagan vazifalar:\n\n`
    undone.forEach((t) => {
      const prio = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '🟢' : '🟡'
      text += `${prio} ${t.text}\n`
    })
    text += `\n💪 ${undone.length} ta vazifa kutmoqda!`

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error(err)
    bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.')
  }
})

// ── Unknown commands ──

bot.on('message', (msg) => {
  if (!isAllowed(msg)) return
  if (msg.text?.startsWith('/') && !/^\/(start|bugun|hafta|stat|qosh|yoz|eslatma)/.test(msg.text)) {
    bot.sendMessage(msg.chat.id, '❓ Noma\'lum buyruq. /start ni bosing.')
  }
})

console.log('🤖 365 Reja Telegram bot ishga tushdi!')
