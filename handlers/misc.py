from telegram import Update
from telegram.ext import ContextTypes

from config import MORNING_DIGEST_HOUR
from handlers.ai_motivate import motivate_command
from handlers.badges import badges_command
from handlers.books import books_command
from handlers.expense import budget_command
from handlers.goals import goals_command
from handlers.habits import habits_command
from handlers.mood import mood_command
from handlers.pomodoro import focus_command
from handlers.reminders import delete_reminder, today_reminders
from handlers.sleep import sleepstats_command
from handlers.stats import stats_command
from handlers.water import water_command
from keyboards import MAIN_MENU


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    name    = update.effective_user.first_name
    welcome = (
        f"👋 Salom, *{name}*!\n\n"
        "Men sizning shaxsiy yordamchingizman — odatlar, eslatmalar, "
        "kayfiyat, xarajat, kitoblar, uyqu va maqsadlaringizni kuzataman!\n\n"
        "📅 *Eslatmalar:*\n"
        "/add — Yangi eslatma\n"
        "/today — Bugungi eslatmalar\n"
        "/week — Haftalik reja\n"
        "/addr — Takrorlanuvchi eslatma\n\n"
        "📌 *Kunlik odatlar:*\n"
        "/addhabit Sport 30 — 30 kunlik\n"
        "/habits — bugungi ro'yxat\n"
        "/stats — statistika\n\n"
        "😊 *Yangi funksiyalar:*\n"
        "/mood — Kayfiyat kuzatuvchi\n"
        "/spend 50000 Kafe — Xarajat yozish\n"
        "/focus 25 — Pomodoro taymer\n"
        "/addbook Atomic Habits — Kitob qo'shish\n"
        "/water on — Suv eslatmasi\n"
        "/goal IELTS 180 — Maqsad qo'yish\n"
        "/sleep 23:00 — Uyqu kuzatish\n"
        "/badges — Yutuqlar\n"
        "/motivate — AI motivatsiya\n\n"
        f"☀️ Har kuni soat {MORNING_DIGEST_HOUR}:00 da reja yuboriladi\n"
        "📅 Har yakshanba haftalik xulosa yuboriladi\n\n"
        "👇 Pastdagi *Menyu* tugmalarini bosing!"
    )
    await update.message.reply_text(
        welcome,
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "📖 *YORDAM — barcha buyruqlar*\n\n"
        "━━━ 📅 *ESLATMALAR* ━━━\n"
        "`/add bugun 15:00 Sport`\n"
        "`/add ertaga 09:00 Vrach`\n"
        "`/today` `/tomorrow` `/week` `/list`\n"
        "`/delete` — o'chirish\n"
        "`/addr daily 09:00 Sport` — takrorlanuvchi\n\n"
        "━━━ 📌 *KUNLIK ODATLAR* ━━━\n"
        "`/addhabit Sport` — doimiy\n"
        "`/addhabit Sport 30` — 30 kunlik\n"
        "`/habits` `/stats` `/delhabit`\n\n"
        "━━━ 😊 *KAYFIYAT* ━━━\n"
        "`/mood` — bugungi kayfiyat + grafik\n\n"
        "━━━ 💰 *XARAJATLAR* ━━━\n"
        "`/spend 50000 Kafe`\n"
        "`/budget` — hisobot\n"
        "`/limit 1500000` — oylik limit\n"
        "`/undospend` — oxirgi o'chirish\n\n"
        "━━━ 🍅 *POMODORO TAYMER* ━━━\n"
        "`/focus 25` — fokus rejimi (daqiqa)\n"
        "`/stopfocus` — to'xtatish\n\n"
        "━━━ 📚 *KITOBLAR* ━━━\n"
        "`/addbook Atomic Habits`\n"
        "`/books` — ro'yxat + holat o'zgartirish\n\n"
        "━━━ 💧 *SUV* ━━━\n"
        "`/water on` — har 2 soatda eslatma\n"
        "`/water on 3` — har 3 soatda\n"
        "`/water off` — o'chirish\n"
        "`/drank` — 'ichdim' belgilash\n\n"
        "━━━ 🎯 *MAQSADLAR* ━━━\n"
        "`/goal IELTS olish 180`\n"
        "`/goals` — ro'yxat\n"
        "`/progress 1 75` — 75% qo'yish\n\n"
        "━━━ 😴 *UYQU* ━━━\n"
        "`/sleep 23:00` — uxlash vaqti\n"
        "`/wake 07:00` — turish vaqti\n"
        "`/sleepstats` — haftalik grafik\n\n"
        "━━━ 🏆 *YUTUQLAR & AI* ━━━\n"
        "`/badges` — barcha yutuqlar\n"
        "`/motivate` — AI motivatsiya"
    )
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=MAIN_MENU)


# ── Menyu tugmalari → buyruqlarga yo'naltirish ──────────────────────────────

_MENU_MAP: dict[str, str] = {
    "📅 bugun":       "today",
    "📌 kunlik":      "habits",
    "📊 statistika":  "stats",
    "😊 kayfiyat":    "mood",
    "💰 xarajat":     "budget",
    "🎯 maqsadlar":   "goals",
    "📚 kitoblar":    "books",
    "😴 uyqu":        "sleepstats",
    "💧 suv":         "water",
    "🍅 fokus":       "focus",
    "🏆 yutuqlar":    "badges",
    "🤖 motivatsiya": "motivate",
    "🗑 o'chirish":   "delete",
    "❓ yordam":      "help",
}

_DISPATCH = {
    "today":      today_reminders,
    "habits":     habits_command,
    "stats":      stats_command,
    "mood":       mood_command,
    "budget":     budget_command,
    "goals":      goals_command,
    "books":      books_command,
    "sleepstats": sleepstats_command,
    "water":      water_command,
    "focus":      focus_command,
    "badges":     badges_command,
    "motivate":   motivate_command,
    "delete":     delete_reminder,
    "help":       help_command,
}


async def menu_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    cmd = _MENU_MAP.get(update.message.text.strip().lower())
    if not cmd:
        return
    handler = _DISPATCH.get(cmd)
    if handler:
        await handler(update, context)
