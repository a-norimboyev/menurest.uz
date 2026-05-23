"""
Shaxsiy Eslatma Bot
====================
Telegram orqali kun tartibingizni boshqaring va eslatmalar oling.

Buyruqlar:
  /start    - Botni ishga tushirish
  /add      - Yangi eslatma qo'shish
  /today    - Bugungi eslatmalar
  /tomorrow - Ertangi eslatmalar
  /week     - Haftalik reja
  /list     - Barcha eslatmalar
  /delete   - Eslatmani o'chirish (inline tugmalar bilan)
  /help     - Yordam
"""

import json
import logging
import os
import sys
import uuid

# Windows terminali UTF-8 qo'llab-quvvatlashi uchun
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")
from datetime import datetime, timedelta
from pathlib import Path

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

DATA_FILE = Path("reminders.json")
TZ = pytz.timezone(TIMEZONE)
scheduler = AsyncIOScheduler(timezone=TZ)

MAIN_MENU = ReplyKeyboardMarkup(
    [
        [KeyboardButton("📅 Bugun"), KeyboardButton("📅 Ertaga")],
        [KeyboardButton("🗓 Hafta"),  KeyboardButton("📋 Hammasi")],
        [KeyboardButton("🗑 O'chirish"), KeyboardButton("❓ Yordam")],
    ],
    resize_keyboard=True,
    persistent=True,
)


# ============================================
# MA'LUMOTLARNI SAQLASH VA O'QISH
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
    data = load_reminders()
    return data.get(str(user_id), [])


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
# BUYRUQLAR
# ============================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_name = update.effective_user.first_name
    welcome = (
        f"👋 Salom, {user_name}!\n\n"
        "Men sizning shaxsiy eslatma yordamchingizman.\n\n"
        "📝 *Asosiy buyruqlar:*\n"
        "/add — Yangi eslatma qo'shish\n"
        "/today — Bugungi eslatmalar\n"
        "/tomorrow — Ertangi eslatmalar\n"
        "/week — Haftalik reja\n"
        "/list — Barcha eslatmalar\n"
        "/delete — Eslatmani o'chirish\n"
        "/help — Yordam\n\n"
        "✨ *Misol:*\n"
        "`/add 2026-05-24 09:00 Ishga borish`\n"
        "`/add ertaga 14:00 Vrach`\n"
        "`/add bugun 18:30 Onamga qo'ng'iroq`\n\n"
        f"Har kuni ertalab soat {MORNING_DIGEST_HOUR}:00 da bugungi rejangizni yuboraman! ☀️"
    )
    await update.message.reply_text(welcome, parse_mode="Markdown", reply_markup=MAIN_MENU)


async def menu_button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Pastki menyu tugmalari bosilganda."""
    text = update.message.text
    if text == "📅 Bugun":
        await today_reminders(update, context)
    elif text == "📅 Ertaga":
        await tomorrow_reminders(update, context)
    elif text == "🗓 Hafta":
        await week_reminders(update, context)
    elif text == "📋 Hammasi":
        await list_reminders(update, context)
    elif text == "🗑 O'chirish":
        await delete_reminder(update, context)
    elif text == "❓ Yordam":
        await help_command(update, context)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    help_text = (
        "📖 *YORDAM*\n\n"
        "*Eslatma qo'shish:*\n"
        "`/add SANA VAQT MATN`\n\n"
        "Sana formatlari:\n"
        "- `2026-05-24` (YYYY-MM-DD)\n"
        "- `bugun`\n"
        "- `ertaga`\n\n"
        "Vaqt formati: `HH:MM` (masalan, `09:30`, `18:00`)\n\n"
        "*Misollar:*\n"
        "`/add bugun 15:00 Sport zaliga borish`\n"
        "`/add ertaga 09:00 Ishga borish`\n"
        "`/add 2026-05-30 14:00 Vrach`\n\n"
        "*Ko'rish:*\n"
        "/today — bugungi\n"
        "/tomorrow — ertangi\n"
        "/week — haftalik\n"
        "/list — barcha\n\n"
        "*O'chirish:*\n"
        "/delete — tugmalar orqali tanlab o'chirish"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def add_reminder(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args = context.args

    if len(args) < 3:
        await update.message.reply_text(
            "❌ Format noto'g'ri!\n\n"
            "To'g'ri format:\n"
            "`/add SANA VAQT MATN`\n\n"
            "Misol:\n"
            "`/add ertaga 14:00 Vrach`\n"
            "`/add bugun 18:30 Onamga qo'ng'iroq`",
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
                "❌ Sana formati noto'g'ri.\n"
                "Foydalaning: `bugun`, `ertaga` yoki `YYYY-MM-DD`",
                parse_mode="Markdown",
            )
            return

    try:
        target_time = datetime.strptime(time_str, "%H:%M").time()
    except ValueError:
        await update.message.reply_text(
            "❌ Vaqt formati noto'g'ri.\n"
            "Foydalaning: `HH:MM` (masalan, `14:30`)",
            parse_mode="Markdown",
        )
        return

    target_dt = TZ.localize(datetime.combine(target_date, target_time))

    if target_dt < now:
        await update.message.reply_text(
            "⚠️ Bu vaqt o'tib ketgan! Kelajakdagi vaqtni kiriting."
        )
        return

    # UUID ishlatamiz — o'chirishda ID buzilmaydi
    reminder_id = str(uuid.uuid4())
    reminders = get_user_reminders(user_id)
    reminder = {
        "id": reminder_id,
        "datetime": target_dt.isoformat(),
        "text": text,
    }
    reminders.append(reminder)
    set_user_reminders(user_id, reminders)

    scheduler.add_job(
        send_reminder,
        "date",
        run_date=target_dt,
        args=[context.bot, user_id, text],
        id=f"reminder_{user_id}_{reminder_id}",
        replace_existing=True,
    )

    await update.message.reply_text(
        f"✅ Eslatma qo'shildi!\n\n"
        f"📅 {target_dt.strftime('%Y-%m-%d %H:%M')}\n"
        f"📝 {text}"
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
            day_name = days_uz[dt.weekday()]
            text += f"\n📆 *{day_str} — {day_name}*\n"
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
    """Inline tugmalar bilan eslatmani o'chirish."""
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
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "Qaysi eslatmani o'chirmoqchisiz?", reply_markup=reply_markup
    )


async def delete_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Inline tugma bosilganda o'chirish."""
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

    job_id = f"reminder_{user_id}_{reminder_id}"
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass

    await query.edit_message_text(f"🗑 O'chirildi: *{to_delete['text']}*", parse_mode="Markdown")


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
                    send_reminder,
                    "date",
                    run_date=target_dt,
                    args=[application.bot, user_id, r["text"]],
                    id=f"reminder_{user_id}_{r['id']}",
                    replace_existing=True,
                )

    scheduler.add_job(
        send_morning_digest,
        "cron",
        hour=MORNING_DIGEST_HOUR,
        minute=0,
        args=[application.bot],
        id="morning_digest",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler ishga tushdi!")


def main() -> None:
    if not BOT_TOKEN:
        print("❌ XATO: BOT_TOKEN o'rnatilmagan!")
        print(".env faylida BOT_TOKEN=tokeningiz qatorini qo'shing.")
        return

    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("add", add_reminder))
    app.add_handler(CommandHandler("list", list_reminders))
    app.add_handler(CommandHandler("today", today_reminders))
    app.add_handler(CommandHandler("tomorrow", tomorrow_reminders))
    app.add_handler(CommandHandler("week", week_reminders))
    app.add_handler(CommandHandler("delete", delete_reminder))
    app.add_handler(CallbackQueryHandler(delete_callback, pattern="^del_"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, menu_button_handler))

    print("🤖 Bot ishga tushdi! To'xtatish uchun Ctrl+C bosing.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
