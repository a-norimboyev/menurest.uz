from datetime import datetime

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from data.achievements import ALL_ACHIEVEMENTS, grant_achievement
from data.mood import (
    MOOD_LEVELS,
    add_mood,
    get_mood_avg,
    get_today_mood,
    get_total_mood_days,
    get_weekly_mood,
)
from keyboards import MAIN_MENU


async def mood_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id    = update.effective_user.id
    today_mood = get_today_mood(user_id)

    if today_mood:
        score  = today_mood["score"]
        label  = MOOD_LEVELS[score]
        note   = f"\n📝 _{today_mood['note']}_" if today_mood.get("note") else ""
        weekly = get_weekly_mood(user_id)
        avg    = get_mood_avg(user_id)

        days_uz = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
        chart   = ""
        for w in weekly:
            d        = datetime.strptime(w["date"], "%Y-%m-%d")
            day_name = days_uz[d.weekday()]
            if w["entry"]:
                s   = w["entry"]["score"]
                bar = "🟢" * s + "⬜" * (5 - s)
            else:
                bar = "⬛⬛⬛⬛⬛"
            chart += f"`{day_name}` {bar}\n"

        avg_line = f"\n📈 O'rtacha: *{avg}/5*" if avg else ""

        await update.message.reply_text(
            f"😊 *Bugungi kayfiyat:* {label}{note}\n\n"
            f"*Haftalik grafik:*\n{chart}{avg_line}\n\n"
            f"Kayfiyatni o'zgartirish uchun /mood ni qayta bosing.",
            parse_mode="Markdown",
            reply_markup=MAIN_MENU,
        )
        return

    keyboard = [[
        InlineKeyboardButton("😞 1", callback_data="mood_1"),
        InlineKeyboardButton("😕 2", callback_data="mood_2"),
        InlineKeyboardButton("😐 3", callback_data="mood_3"),
        InlineKeyboardButton("😊 4", callback_data="mood_4"),
        InlineKeyboardButton("😄 5", callback_data="mood_5"),
    ]]
    await update.message.reply_text(
        "😊 *Bugungi kayfiyatingiz qanday?*\n\n"
        "1️⃣ — Juda yomon\n"
        "2️⃣ — Yomon\n"
        "3️⃣ — Normal\n"
        "4️⃣ — Yaxshi\n"
        "5️⃣ — Ajoyib",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def mood_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query   = update.callback_query
    await query.answer()
    user_id = query.from_user.id

    score = int(query.data.replace("mood_", ""))
    add_mood(user_id, score)
    label = MOOD_LEVELS[score]

    # Yutuqlar tekshirish
    days = get_total_mood_days(user_id)
    new_ach = None
    if days >= 30 and grant_achievement(user_id, "mood_30"):
        new_ach = ALL_ACHIEVEMENTS["mood_30"]["name"]
    elif days >= 7 and grant_achievement(user_id, "mood_7"):
        new_ach = ALL_ACHIEVEMENTS["mood_7"]["name"]

    ach_text = f"\n\n🏆 *Yangi yutuq: {new_ach}!*" if new_ach else ""

    await query.edit_message_text(
        f"✅ Kayfiyat saqlandi: {label}{ach_text}\n\n"
        f"📊 /mood — statistika ko'rish",
        parse_mode="Markdown",
    )
