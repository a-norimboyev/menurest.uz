from telegram import Update
from telegram.ext import ContextTypes

from config import MORNING_DIGEST_HOUR
from keyboards import MAIN_MENU


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    name    = update.effective_user.first_name
    welcome = (
        f"👋 Salom, {name}!\n\n"
        "Men sizning shaxsiy eslatma yordamchingizman.\n\n"
        "📝 *Buyruqlar:*\n"
        "/add — Yangi eslatma\n"
        "/today — Bugungi eslatmalar\n"
        "/week — Haftalik reja\n"
        "/addr — Takrorlanuvchi eslatma\n"
        "/habits — Kunlik doimiy vazifalar\n"
        "/addhabit — Yangi kunlik vazifa\n"
        "/stats — Statistika\n"
        "/help — Batafsil yordam\n\n"
        f"Har kuni soat {MORNING_DIGEST_HOUR}:00 da bugungi rejangizni yuboraman! ☀️"
    )
    await update.message.reply_text(welcome, parse_mode="Markdown", reply_markup=MAIN_MENU)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "📖 *YORDAM*\n\n"
        "*Eslatma:*\n"
        "`/add bugun 15:00 Sport`\n"
        "`/add ertaga 09:00 Ishga borish`\n"
        "`/delete` — o'chirish\n\n"
        "*Takrorlanuvchi:*\n"
        "`/addr daily 09:00 Sport`\n"
        "`/addr weekly 10:00 Uy tozalash`\n"
        "`/addr monthly 09:00 Hisobot`\n\n"
        "*Kunlik vazifalar:*\n"
        "`/addhabit Sport` — doimiy\n"
        "`/addhabit Sport 30` — 30 kunlik\n"
        "`/habits` — bugungi ro'yxat\n"
        "`/delhabit` — o'chirish\n\n"
        "*Ko'rish:*\n"
        "/today /tomorrow /week /list /stats"
    )
    await update.message.reply_text(text, parse_mode="Markdown")
