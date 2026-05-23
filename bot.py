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
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
TIMEZONE = "Asia/Tashkent"
MORNING_DIGEST_HOUR = 8
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
        [KeyboardButton("📅 Bugun"),     KeyboardButton("📅 Ertaga")],
        [KeyboardButton("🗓 Hafta"),     KeyboardButton("📋 Hammasi")],
        [KeyboardButton("📌 Kunlik"),    KeyboardButton("🗑 O'chirish")],
        [KeyboardButton("❓ Yordam")],
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
    completed = get_today_completed(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    total = len(tasks)
    done  = len([t for t in tasks if t["id"] in completed])

    keyboard = []
    for task in tasks:
        checked = "✅" if task["id"] in completed else "☐"
        keyboard.append([
            InlineKeyboardButton(
                f"{checked} {task['text']}",
                callback_data=f"habit_{task['id']}",
            )
        ])

    keyboard.append([
        InlineKeyboardButton(
            f"📊 {done}/{total} bajarildi",
            callback_data="habit_stats",
        )
    ])
    return InlineKeyboardMarkup(keyboard)


def habits_header(user_id: int) -> str:
    tasks = get_user_habits(user_id)
    completed = get_today_completed(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    total = len(tasks)
    done  = len([t for t in tasks if t["id"] in completed])

    if total == 0:
        return "📌 *Kunlik vazifalar*\n\nHali vazifalar yo'q.\n`/addhabit Matn` — vazifa qo'shish"

    progress = int((done / total) * 10)
    bar = "🟩" * progress + "⬜" * (10 - progress)
    return (
        f"📌 *Kunlik vazifalar — {today}*\n"
        f"{bar} {done}/{total}\n\n"
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
            "❌ Format: `/addhabit Vazifa nomi`\n\nMisol: `/addhabit Sport`",
            parse_mode="Markdown",
        )
        return

    text = " ".join(args)
    data = load_habits()
    uid = str(user_id)

    if uid not in data:
        data[uid] = {"tasks": [], "completed": {}}

    task_id = str(uuid.uuid4())
    data[uid]["tasks"].append({"id": task_id, "text": text})
    save_habits(data)

    await update.message.reply_text(
        f"✅ Kunlik vazifa qo'shildi: *{text}*\n\n"
        "/habits — vazifalarni ko'rish",
        parse_mode="Markdown",
    )


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


async def habit_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id

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

    app.add_handler(CallbackQueryHandler(delete_callback, pattern="^del_"))
    app.add_handler(CallbackQueryHandler(habit_callback,  pattern="^habit"))
    app.add_handler(CallbackQueryHandler(habit_callback,  pattern="^habdel_"))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, menu_button_handler))

    print("Bot ishga tushdi! Toxtatish uchun Ctrl+C bosing.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
