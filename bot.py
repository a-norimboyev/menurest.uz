"""
Shaxsiy Eslatma Bot
====================
Telegram orqali kun tartibingizni boshqaring va eslatmalar oling.

Buyruqlar:
  /start      - Botni ishga tushirish
  /add        - Yangi eslatma qo'shish
  /today      - Bugungi eslatmalar
  /tomorrow   - Ertangi eslatmalar
  /week       - Haftalik reja
  /list       - Barcha eslatmalar
  /delete     - Eslatmani o'chirish
  /habits     - Kunlik doimiy vazifalar
  /addhabit   - Yangi kunlik vazifa qo'shish
  /delhabit   - Kunlik vazifani o'chirish
  /addr       - Takrorlanuvchi eslatma (daily/weekly/monthly)
  /stats      - Statistika
  /help       - Yordam
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# Windows terminali UTF-8 qo'llab-quvvatlashi uchun
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    Update,
)
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

# ============================================
# SOZLAMALAR
# ============================================
BOT_TOKEN          = os.getenv("BOT_TOKEN", "")
TIMEZONE           = "Asia/Tashkent"
MORNING_DIGEST_HOUR = 8
EVENING_REPORT_HOUR = 21
# ============================================

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

DATA_FILE   = Path("reminders.json")
HABITS_FILE = Path("habits.json")
TZ          = pytz.timezone(TIMEZONE)
scheduler   = AsyncIOScheduler(timezone=TZ)

MAIN_MENU = ReplyKeyboardMarkup(
    [
        [KeyboardButton("📅 Bugun"),      KeyboardButton("📅 Ertaga")],
        [KeyboardButton("🗓 Hafta"),      KeyboardButton("📋 Hammasi")],
        [KeyboardButton("📌 Kunlik"),     KeyboardButton("📊 Statistika")],
        [KeyboardButton("🗑 O'chirish"),  KeyboardButton("❓ Yordam")],
    ],
    resize_keyboard=True,
    persistent=True,
)


# ============================================
# ESLATMALAR — MA'LUMOT
# ============================================
def load_reminders() -> dict:
    if DATA_FILE.exists():
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_reminders(data: dict) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_user_reminders(user_id: int) -> list:
    return load_reminders().get(str(user_id), [])


def set_user_reminders(user_id: int, reminders: list) -> None:
    data = load_reminders()
    data[str(user_id)] = reminders
    save_reminders(data)


def get_active_sorted(user_id: int) -> list:
    now = datetime.now(TZ)
    reminders = get_user_reminders(user_id)
    active = [r for r in reminders if datetime.fromisoformat(r["datetime"]) > now]
    return sorted(active, key=lambda x: x["datetime"])


def next_occurrence(dt: datetime, repeat: str) -> datetime:
    """Takrorlanuvchi eslatma uchun keyingi vaqtni hisoblash."""
    if repeat == "daily":
        return dt + timedelta(days=1)
    if repeat == "weekly":
        return dt + timedelta(weeks=1)
    if repeat == "monthly":
        month = dt.month + 1 if dt.month < 12 else 1
        year  = dt.year + (1 if dt.month == 12 else 0)
        try:
            return dt.replace(year=year, month=month)
        except ValueError:
            return dt.replace(year=year, month=month, day=28)
    return dt


# ============================================
# STREAK HISOBLASH
# ============================================
def get_streak(user_id: int) -> int:
    completed = load_habits().get(str(user_id), {}).get("completed", {})
    if not completed:
        return 0
    today = datetime.now(TZ).date()
    today_str = today.strftime("%Y-%m-%d")
    # Bugun hech narsa bajarilmagan bo'lsa, kechagi kundan boshla
    start = today if (today_str in completed and completed[today_str]) else today - timedelta(days=1)
    streak = 0
    check = start
    while True:
        s = check.strftime("%Y-%m-%d")
        if s in completed and completed[s]:
            streak += 1
            check -= timedelta(days=1)
        else:
            break
    return streak


def get_weekly_stats(user_id: int) -> list:
    """Oxirgi 7 kunlik bajarilish foizi."""
    completed = load_habits().get(str(user_id), {}).get("completed", {})
    tasks = get_user_habits(user_id)
    if not tasks:
        return []
    today = datetime.now(TZ).date()
    result = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        done = len(completed.get(day_str, []))
        total = len(tasks)
        pct = int((done / total) * 100) if total else 0
        result.append({"date": day_str, "done": done, "total": total, "pct": pct})
    return result


# ============================================
# KUNLIK VAZIFALAR — MA'LUMOT
# ============================================
def load_habits() -> dict:
    if HABITS_FILE.exists():
        with open(HABITS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_habits(data: dict) -> None:
    with open(HABITS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_user_habits(user_id: int) -> list:
    return load_habits().get(str(user_id), {}).get("tasks", [])


def get_today_completed(user_id: int) -> list:
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    return load_habits().get(str(user_id), {}).get("completed", {}).get(today, [])


def get_task_days_done(user_id: int, task_id: str) -> int:
    """Vazifa necha kun bajarilganini hisoblash."""
    completed = load_habits().get(str(user_id), {}).get("completed", {})
    return sum(1 for day_ids in completed.values() if task_id in day_ids)


def toggle_habit(user_id: int, task_id: str) -> bool:
    """Vazifani belgilash/bekor qilish. True qaytarsa — belgilandi."""
    data = load_habits()
    uid = str(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")

    if uid not in data:
        data[uid] = {"tasks": [], "completed": {}}
    if "completed" not in data[uid]:
        data[uid]["completed"] = {}
    if today not in data[uid]["completed"]:
        data[uid]["completed"][today] = []

    completed_today = data[uid]["completed"][today]
    if task_id in completed_today:
        completed_today.remove(task_id)
        done = False
    else:
        completed_today.append(task_id)
        done = True

    save_habits(data)
    return done


def build_habits_keyboard(user_id: int) -> InlineKeyboardMarkup:
    tasks = get_user_habits(user_id)
    completed_today = get_today_completed(user_id)
    keyboard = []

    for task in tasks:
        duration = task.get("duration", 0)
        days_done = get_task_days_done(user_id, task["id"])

        if duration > 0 and days_done >= duration:
            # Tugallangan vazifa — faqat ko'rsatish
            label = f"🏆 {task['text']} ({days_done}/{duration} kun — TUGALLANDI!)"
            keyboard.append([InlineKeyboardButton(label, callback_data="habit_finished")])
        elif duration > 0:
            checked = "✅" if task["id"] in completed_today else "☐"
            label = f"{checked} {task['text']}  ({days_done}/{duration} kun)"
            keyboard.append([InlineKeyboardButton(label, callback_data=f"habit_{task['id']}")])
        else:
            checked = "✅" if task["id"] in completed_today else "☐"
            label = f"{checked} {task['text']}"
            keyboard.append([InlineKeyboardButton(label, callback_data=f"habit_{task['id']}")])

    total = len(tasks)
    done  = len([t for t in tasks if t["id"] in completed_today])
    keyboard.append([
        InlineKeyboardButton(f"📊 {done}/{total} bajarildi", callback_data="habit_stats")
    ])
    return InlineKeyboardMarkup(keyboard)


def habits_header(user_id: int) -> str:
    tasks = get_user_habits(user_id)
    completed_today = get_today_completed(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    total = len(tasks)
    done  = len([t for t in tasks if t["id"] in completed_today])

    if total == 0:
        return "📌 *Kunlik vazifalar*\n\nHali vazifalar yo'q.\n`/addhabit Matn` — doimiy\n`/addhabit Matn 20` — 20 kunlik"

    progress = int((done / total) * 10)
    bar = "🟩" * progress + "⬜" * (10 - progress)
    streak = get_streak(user_id)
    streak_line = f"🔥 {streak} kun ketma-ket!\n" if streak >= 2 else ""
    return (
        f"📌 *Kunlik vazifalar — {today}*\n"
        f"{bar} {done}/{total}\n"
        f"{streak_line}\n"
        "Tugmani bosib belgilang:"
    )


# ============================================
# BUYRUQLAR — START / HELP
# ============================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_name = update.effective_user.first_name
    welcome = (
        f"👋 Salom, {user_name}!\n\n"
        "Men sizning shaxsiy eslatma yordamchingizman.\n\n"
        "📝 *Buyruqlar:*\n"
        "/add — Yangi eslatma\n"
        "/today — Bugungi eslatmalar\n"
        "/week — Haftalik reja\n"
        "/habits — Kunlik doimiy vazifalar\n"
        "/addhabit — Yangi kunlik vazifa\n"
        "/help — Batafsil yordam\n\n"
        f"Har kuni soat {MORNING_DIGEST_HOUR}:00 da bugungi rejangizni yuboraman! ☀️"
    )
    await update.message.reply_text(welcome, parse_mode="Markdown", reply_markup=MAIN_MENU)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    help_text = (
        "📖 *YORDAM*\n\n"
        "*Eslatma qo'shish:*\n"
        "`/add SANA VAQT MATN`\n\n"
        "Sana: `bugun`, `ertaga`, `2026-05-30`\n"
        "Vaqt: `09:30`, `18:00`\n\n"
        "*Misollar:*\n"
        "`/add bugun 15:00 Sport`\n"
        "`/add ertaga 09:00 Ishga borish`\n\n"
        "*Kunlik vazifalar:*\n"
        "`/addhabit Sport` — vazifa qo'shish\n"
        "`/habits` — bugungi vazifalar\n"
        "`/delhabit` — vazifani o'chirish\n\n"
        "*Ko'rish:*\n"
        "/today /tomorrow /week /list\n\n"
        "*O'chirish:*\n"
        "/delete — eslatmani o'chirish"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


# ============================================
# ESLATMALAR — BUYRUQLAR
# ============================================
async def add_reminder(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args = context.args

    if len(args) < 3:
        await update.message.reply_text(
            "❌ Format: `/add SANA VAQT MATN`\n\n"
            "Misol: `/add ertaga 14:00 Vrach`",
            parse_mode="Markdown",
        )
        return

    date_str = args[0].lower()
    time_str = args[1]
    text = " ".join(args[2:])
    now = datetime.now(TZ)

    if date_str == "bugun":
        target_date = now.date()
    elif date_str == "ertaga":
        target_date = (now + timedelta(days=1)).date()
    else:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            await update.message.reply_text(
                "❌ Sana: `bugun`, `ertaga` yoki `YYYY-MM-DD`",
                parse_mode="Markdown",
            )
            return

    try:
        target_time = datetime.strptime(time_str, "%H:%M").time()
    except ValueError:
        await update.message.reply_text(
            "❌ Vaqt formati: `HH:MM` (masalan `14:30`)",
            parse_mode="Markdown",
        )
        return

    target_dt = TZ.localize(datetime.combine(target_date, target_time))
    if target_dt < now:
        await update.message.reply_text("⚠️ Bu vaqt o'tib ketgan!")
        return

    reminder_id = str(uuid.uuid4())
    reminders = get_user_reminders(user_id)
    reminders.append({"id": reminder_id, "datetime": target_dt.isoformat(), "text": text})
    set_user_reminders(user_id, reminders)

    scheduler.add_job(
        send_reminder, "date",
        run_date=target_dt,
        args=[context.bot, user_id, text],
        id=f"reminder_{user_id}_{reminder_id}",
        replace_existing=True,
    )

    await update.message.reply_text(
        f"✅ Eslatma qo'shildi!\n\n📅 {target_dt.strftime('%Y-%m-%d %H:%M')}\n📝 {text}"
    )


async def list_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    active = get_active_sorted(user_id)

    if not active:
        await update.message.reply_text("📭 Faol eslatmalar yo'q.")
        return

    text = "📋 *Barcha eslatmalar:*\n\n"
    for i, r in enumerate(active, 1):
        dt = datetime.fromisoformat(r["datetime"])
        text += f"{i}. 📅 {dt.strftime('%Y-%m-%d %H:%M')}\n   📝 {r['text']}\n\n"
    await update.message.reply_text(text, parse_mode="Markdown")


async def today_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _show_day_reminders(update, days_offset=0, title="📅 *Bugungi reja:*")


async def tomorrow_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _show_day_reminders(update, days_offset=1, title="📅 *Ertangi reja:*")


async def week_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    now = datetime.now(TZ)
    week_end = now + timedelta(days=7)

    reminders = get_user_reminders(user_id)
    week_items = [
        r for r in reminders
        if now < datetime.fromisoformat(r["datetime"]) <= week_end
    ]

    if not week_items:
        await update.message.reply_text("📭 Keyingi 7 kunda eslatmalar yo'q.")
        return

    week_items.sort(key=lambda x: x["datetime"])
    days_uz = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]
    text = "🗓 *Haftalik reja (keyingi 7 kun):*\n"
    current_date = None

    for r in week_items:
        dt = datetime.fromisoformat(r["datetime"])
        day_str = dt.strftime("%Y-%m-%d")
        if day_str != current_date:
            current_date = day_str
            text += f"\n📆 *{day_str} — {days_uz[dt.weekday()]}*\n"
        text += f"  🕐 {dt.strftime('%H:%M')} — {r['text']}\n"

    await update.message.reply_text(text, parse_mode="Markdown")


async def _show_day_reminders(update: Update, days_offset: int, title: str) -> None:
    user_id = update.effective_user.id
    reminders = get_user_reminders(user_id)
    target_date = (datetime.now(TZ) + timedelta(days=days_offset)).date()

    day_reminders = [
        r for r in reminders
        if datetime.fromisoformat(r["datetime"]).date() == target_date
    ]

    if not day_reminders:
        await update.message.reply_text(f"{title}\n\n📭 Bu kunda eslatmalar yo'q.")
        return

    day_reminders.sort(key=lambda x: x["datetime"])
    text = f"{title}\n\n"
    for r in day_reminders:
        dt = datetime.fromisoformat(r["datetime"])
        text += f"🕐 {dt.strftime('%H:%M')} — {r['text']}\n"
    await update.message.reply_text(text, parse_mode="Markdown")


async def delete_reminder(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    active = get_active_sorted(user_id)

    if not active:
        await update.message.reply_text("📭 O'chirish uchun faol eslatmalar yo'q.")
        return

    keyboard = []
    for r in active:
        dt = datetime.fromisoformat(r["datetime"])
        label = f"🗑 {dt.strftime('%m-%d %H:%M')} — {r['text'][:25]}"
        keyboard.append([InlineKeyboardButton(label, callback_data=f"del_{r['id']}")])
    keyboard.append([InlineKeyboardButton("❌ Bekor qilish", callback_data="del_cancel")])

    await update.message.reply_text(
        "Qaysi eslatmani o'chirmoqchisiz?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def delete_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    if query.data == "del_cancel":
        await query.edit_message_text("✅ Bekor qilindi.")
        return

    reminder_id = query.data.replace("del_", "", 1)
    user_id = query.from_user.id
    reminders = get_user_reminders(user_id)
    to_delete = next((r for r in reminders if r["id"] == reminder_id), None)

    if not to_delete:
        await query.edit_message_text("❌ Eslatma topilmadi.")
        return

    reminders.remove(to_delete)
    set_user_reminders(user_id, reminders)

    try:
        scheduler.remove_job(f"reminder_{user_id}_{reminder_id}")
    except Exception:
        pass

    await query.edit_message_text(
        f"🗑 O'chirildi: *{to_delete['text']}*", parse_mode="Markdown"
    )


# ============================================
# KUNLIK VAZIFALAR — BUYRUQLAR
# ============================================
async def habits_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    tasks = get_user_habits(user_id)

    if not tasks:
        await update.message.reply_text(
            "📌 *Kunlik vazifalar*\n\n"
            "Hali vazifalar yo'q.\n\n"
            "Qo'shish uchun:\n`/addhabit Sport`\n`/addhabit Kitob o'qish`",
            parse_mode="Markdown",
        )
        return

    await update.message.reply_text(
        habits_header(user_id),
        parse_mode="Markdown",
        reply_markup=build_habits_keyboard(user_id),
    )


async def add_habit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args = context.args

    if not args:
        await update.message.reply_text(
            "❌ Format:\n"
            "`/addhabit Vazifa nomi` — doimiy\n"
            "`/addhabit Vazifa nomi 20` — 20 kunlik\n\n"
            "Misol:\n"
            "`/addhabit Sport`\n"
            "`/addhabit Kitob o'qish 30`",
            parse_mode="Markdown",
        )
        return

    # Oxirgi argument raqam bo'lsa — davomiylik (kun soni)
    duration = 0
    if args[-1].isdigit():
        duration = int(args[-1])
        text = " ".join(args[:-1])
    else:
        text = " ".join(args)

    if not text:
        await update.message.reply_text("❌ Vazifa nomini kiriting.")
        return

    data = load_habits()
    uid = str(user_id)

    if uid not in data:
        data[uid] = {"tasks": [], "completed": {}}

    task_id = str(uuid.uuid4())
    data[uid]["tasks"].append({
        "id": task_id,
        "text": text,
        "duration": duration,
        "started": datetime.now(TZ).strftime("%Y-%m-%d"),
    })
    save_habits(data)

    if duration > 0:
        msg = f"✅ *{text}* — {duration} kunlik vazifa qo'shildi!\n\n/habits — vazifalarni ko'rish"
    else:
        msg = f"✅ *{text}* — doimiy vazifa qo'shildi!\n\n/habits — vazifalarni ko'rish"

    await update.message.reply_text(msg, parse_mode="Markdown")


async def del_habit_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    tasks = get_user_habits(user_id)

    if not tasks:
        await update.message.reply_text("📭 O'chirish uchun vazifalar yo'q.")
        return

    keyboard = [
        [InlineKeyboardButton(f"🗑 {t['text']}", callback_data=f"habdel_{t['id']}")]
        for t in tasks
    ]
    keyboard.append([InlineKeyboardButton("❌ Bekor qilish", callback_data="habdel_cancel")])

    await update.message.reply_text(
        "Qaysi kunlik vazifani o'chirmoqchisiz?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    tasks = get_user_habits(user_id)
    weekly = get_weekly_stats(user_id)
    streak = get_streak(user_id)

    if not tasks:
        await update.message.reply_text(
            "📊 *Statistika*\n\nHali vazifalar yo'q.\n`/addhabit` bilan qo'shing.",
            parse_mode="Markdown",
        )
        return

    days_uz = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
    chart = ""
    for w in weekly:
        d = datetime.strptime(w["date"], "%Y-%m-%d")
        day_name = days_uz[d.weekday()]
        blocks = int(w["pct"] / 20)
        bar = "🟩" * blocks + "⬜" * (5 - blocks)
        chart += f"{day_name} {bar} {w['pct']}%\n"

    streak_line = f"🔥 *Streak: {streak} kun ketma-ket*\n\n" if streak >= 1 else ""

    # Eng ko'p bajarilgan vazifa
    completed_data = load_habits().get(str(user_id), {}).get("completed", {})
    task_counts = {}
    for task in tasks:
        cnt = sum(1 for ids in completed_data.values() if task["id"] in ids)
        task_counts[task["text"]] = cnt
    best = max(task_counts, key=task_counts.get) if task_counts else None
    best_line = f"🏅 Eng faol: *{best}* ({task_counts[best]} kun)\n\n" if best and task_counts[best] > 0 else ""

    text = (
        "📊 *Statistika — oxirgi 7 kun*\n\n"
        f"{streak_line}"
        f"{best_line}"
        f"{chart}"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


async def add_recurring(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args = context.args

    if len(args) < 3:
        await update.message.reply_text(
            "❌ Format: `/addr TAKROR VAQT MATN`\n\n"
            "Takror turlari:\n"
            "`daily` — har kuni\n"
            "`weekly` — har hafta\n"
            "`monthly` — har oy\n\n"
            "Misol:\n"
            "`/addr daily 09:00 Sport`\n"
            "`/addr weekly 10:00 Uy tozalash`",
            parse_mode="Markdown",
        )
        return

    repeat  = args[0].lower()
    time_str = args[1]
    text    = " ".join(args[2:])

    if repeat not in ("daily", "weekly", "monthly"):
        await update.message.reply_text(
            "❌ Takror turi: `daily`, `weekly`, `monthly`",
            parse_mode="Markdown",
        )
        return

    try:
        target_time = datetime.strptime(time_str, "%H:%M").time()
    except ValueError:
        await update.message.reply_text("❌ Vaqt formati: `HH:MM`", parse_mode="Markdown")
        return

    now = datetime.now(TZ)
    target_dt = TZ.localize(datetime.combine(now.date(), target_time))
    if target_dt <= now:
        target_dt = next_occurrence(target_dt, repeat)

    reminder_id = str(uuid.uuid4())
    reminders = get_user_reminders(user_id)
    reminders.append({
        "id": reminder_id,
        "datetime": target_dt.isoformat(),
        "text": text,
        "repeat": repeat,
    })
    set_user_reminders(user_id, reminders)

    scheduler.add_job(
        send_recurring_reminder, "date",
        run_date=target_dt,
        args=[context.bot, user_id, reminder_id],
        id=f"reminder_{user_id}_{reminder_id}",
        replace_existing=True,
    )

    repeat_uz = {"daily": "har kuni", "weekly": "har hafta", "monthly": "har oy"}
    await update.message.reply_text(
        f"✅ Takrorlanuvchi eslatma qo'shildi!\n\n"
        f"🔄 {repeat_uz[repeat]}, soat {time_str}\n"
        f"📝 {text}"
    )


async def habit_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id

    # Tugallangan vazifaga bosilganda
    if query.data == "habit_finished":
        await query.answer("🏆 Bu vazifa allaqachon tugallangan!", show_alert=True)
        return

    # Statistika tugmasi
    if query.data == "habit_stats":
        tasks = get_user_habits(user_id)
        completed = get_today_completed(user_id)
        done = len([t for t in tasks if t["id"] in completed])
        remaining = len(tasks) - done
        await query.answer(
            f"Bugun: {done} bajarildi, {remaining} qoldi",
            show_alert=True,
        )
        return

    # Vazifani belgilash / bekor qilish
    if query.data.startswith("habit_"):
        task_id = query.data.replace("habit_", "", 1)
        toggle_habit(user_id, task_id)

        # Shu vazifa tugallandimi tekshirish
        tasks = get_user_habits(user_id)
        task = next((t for t in tasks if t["id"] == task_id), None)
        if task and task.get("duration", 0) > 0:
            days_done = get_task_days_done(user_id, task_id)
            if days_done >= task["duration"]:
                await query.answer(
                    f"🏆 Tabriklaymiz! '{task['text']}' — {task['duration']} kun bajardingiz!",
                    show_alert=True,
                )

        await query.edit_message_text(
            habits_header(user_id),
            parse_mode="Markdown",
            reply_markup=build_habits_keyboard(user_id),
        )

    # Vazifani o'chirish
    elif query.data == "habdel_cancel":
        await query.edit_message_text("✅ Bekor qilindi.")

    elif query.data.startswith("habdel_"):
        task_id = query.data.replace("habdel_", "", 1)
        data = load_habits()
        uid = str(user_id)
        tasks = data.get(uid, {}).get("tasks", [])
        to_del = next((t for t in tasks if t["id"] == task_id), None)

        if not to_del:
            await query.edit_message_text("❌ Vazifa topilmadi.")
            return

        data[uid]["tasks"] = [t for t in tasks if t["id"] != task_id]
        save_habits(data)
        await query.edit_message_text(
            f"🗑 O'chirildi: *{to_del['text']}*", parse_mode="Markdown"
        )


# ============================================
# MENYU TUGMALARI
# ============================================
async def menu_button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = update.message.text
    if text == "📅 Bugun":
        await today_reminders(update, context)
    elif text == "📅 Ertaga":
        await tomorrow_reminders(update, context)
    elif text == "🗓 Hafta":
        await week_reminders(update, context)
    elif text == "📋 Hammasi":
        await list_reminders(update, context)
    elif text == "📌 Kunlik":
        await habits_command(update, context)
    elif text == "📊 Statistika":
        await stats_command(update, context)
    elif text == "🗑 O'chirish":
        await delete_reminder(update, context)
    elif text == "❓ Yordam":
        await help_command(update, context)


# ============================================
# AVTOMATIK ESLATMA YUBORISH
# ============================================
async def send_reminder(bot, user_id: int, text: str) -> None:
    try:
        await bot.send_message(
            chat_id=user_id,
            text=f"🔔 *ESLATMA!*\n\n{text}",
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"Eslatma yuborishda xato: {e}")


async def send_recurring_reminder(bot, user_id: int, reminder_id: str) -> None:
    """Takrorlanuvchi eslatmani yuborish va keyingi vaqtga rejalashtirish."""
    reminders = get_user_reminders(user_id)
    reminder = next((r for r in reminders if r["id"] == reminder_id), None)
    if not reminder:
        return

    try:
        repeat_uz = {"daily": "har kuni", "weekly": "har hafta", "monthly": "har oy"}
        label = repeat_uz.get(reminder.get("repeat", ""), "")
        await bot.send_message(
            chat_id=user_id,
            text=f"🔔 *ESLATMA* ({label})\n\n{reminder['text']}",
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"Takrorlanuvchi eslatma xatosi: {e}")
        return

    # Keyingi vaqtni hisoblash va saqlash
    current_dt = datetime.fromisoformat(reminder["datetime"])
    next_dt = next_occurrence(current_dt, reminder["repeat"])
    reminder["datetime"] = next_dt.isoformat()
    set_user_reminders(user_id, reminders)

    scheduler.add_job(
        send_recurring_reminder, "date",
        run_date=next_dt,
        args=[bot, user_id, reminder_id],
        id=f"reminder_{user_id}_{reminder_id}",
        replace_existing=True,
    )


async def send_evening_report(bot) -> None:
    """Har kuni kechqurun bajarilgan/qolgan vazifalar hisoboti."""
    habits_data = load_habits()
    today = datetime.now(TZ).strftime("%Y-%m-%d")

    for user_id_str, user_data in habits_data.items():
        tasks = user_data.get("tasks", [])
        if not tasks:
            continue

        completed_today = user_data.get("completed", {}).get(today, [])
        done_tasks    = [t for t in tasks if t["id"] in completed_today]
        missed_tasks  = [t for t in tasks if t["id"] not in completed_today]

        done_count   = len(done_tasks)
        total_count  = len(tasks)
        streak       = get_streak(int(user_id_str))
        streak_line  = f"\n🔥 Streak: {streak} kun ketma-ket!" if streak >= 2 else ""

        text = f"🌙 *Kechki hisobot — {today}*\n\n"
        text += f"✅ Bajarildi: {done_count}/{total_count}{streak_line}\n\n"

        if done_tasks:
            text += "*Bajardingiz:*\n"
            for t in done_tasks:
                text += f"  ✅ {t['text']}\n"
        if missed_tasks:
            text += "\n*Bajarilmadi:*\n"
            for t in missed_tasks:
                text += f"  ☐ {t['text']}\n"

        if done_count == total_count:
            text += "\n🎉 Ajoyib! Bugun hammasi bajarildi!"
        elif done_count == 0:
            text += "\n💪 Ertaga yangi imkoniyat — davom eting!"

        try:
            await bot.send_message(
                chat_id=int(user_id_str), text=text, parse_mode="Markdown"
            )
        except Exception as e:
            logger.error(f"Kechki hisobot xatosi: {e}")


async def send_morning_digest(bot) -> None:
    data = load_reminders()
    today = datetime.now(TZ).date()

    for user_id_str, reminders in data.items():
        today_items = [
            r for r in reminders
            if datetime.fromisoformat(r["datetime"]).date() == today
        ]
        if not today_items:
            continue

        today_items.sort(key=lambda x: x["datetime"])
        text = "☀️ *Xayrli tong! Bugungi rejangiz:*\n\n"
        for r in today_items:
            dt = datetime.fromisoformat(r["datetime"])
            text += f"🕐 {dt.strftime('%H:%M')} — {r['text']}\n"

        try:
            await bot.send_message(
                chat_id=int(user_id_str), text=text, parse_mode="Markdown"
            )
        except Exception as e:
            logger.error(f"Ertalabki xabar yuborishda xato: {e}")


# ============================================
# BOTNI ISHGA TUSHIRISH
# ============================================
async def post_init(application: Application) -> None:
    data = load_reminders()
    now = datetime.now(TZ)

    for user_id_str, reminders in data.items():
        user_id = int(user_id_str)
        for r in reminders:
            target_dt = datetime.fromisoformat(r["datetime"])
            if target_dt > now:
                scheduler.add_job(
                    send_reminder, "date",
                    run_date=target_dt,
                    args=[application.bot, user_id, r["text"]],
                    id=f"reminder_{user_id}_{r['id']}",
                    replace_existing=True,
                )

    scheduler.add_job(
        send_morning_digest, "cron",
        hour=MORNING_DIGEST_HOUR, minute=0,
        args=[application.bot],
        id="morning_digest",
        replace_existing=True,
    )

    scheduler.add_job(
        send_evening_report, "cron",
        hour=EVENING_REPORT_HOUR, minute=0,
        args=[application.bot],
        id="evening_report",
        replace_existing=True,
    )

    # Takrorlanuvchi eslatmalarni qayta rejalashtirish
    for user_id_str, reminders in load_reminders().items():
        uid = int(user_id_str)
        for r in reminders:
            if r.get("repeat") and datetime.fromisoformat(r["datetime"]) > now:
                scheduler.add_job(
                    send_recurring_reminder, "date",
                    run_date=datetime.fromisoformat(r["datetime"]),
                    args=[application.bot, uid, r["id"]],
                    id=f"reminder_{uid}_{r['id']}",
                    replace_existing=True,
                )

    scheduler.start()
    logger.info("Scheduler ishga tushdi!")


def main() -> None:
    if not BOT_TOKEN:
        print("XATO: BOT_TOKEN o'rnatilmagan!")
        print(".env faylida BOT_TOKEN=tokeningiz qatorini qo'shing.")
        return

    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start",    start))
    app.add_handler(CommandHandler("help",     help_command))
    app.add_handler(CommandHandler("add",      add_reminder))
    app.add_handler(CommandHandler("list",     list_reminders))
    app.add_handler(CommandHandler("today",    today_reminders))
    app.add_handler(CommandHandler("tomorrow", tomorrow_reminders))
    app.add_handler(CommandHandler("week",     week_reminders))
    app.add_handler(CommandHandler("delete",   delete_reminder))
    app.add_handler(CommandHandler("habits",   habits_command))
    app.add_handler(CommandHandler("addhabit", add_habit))
    app.add_handler(CommandHandler("delhabit", del_habit_command))
    app.add_handler(CommandHandler("addr",     add_recurring))
    app.add_handler(CommandHandler("stats",    stats_command))

    app.add_handler(CallbackQueryHandler(delete_callback, pattern="^del_"))
    app.add_handler(CallbackQueryHandler(habit_callback,  pattern="^habit"))
    app.add_handler(CallbackQueryHandler(habit_callback,  pattern="^habdel_"))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, menu_button_handler))

    print("Bot ishga tushdi! Toxtatish uchun Ctrl+C bosing.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
