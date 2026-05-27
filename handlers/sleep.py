from datetime import datetime

from telegram import Update
from telegram.ext import ContextTypes

from data.achievements import ALL_ACHIEVEMENTS, grant_achievement
from data.sleep import (
    get_avg_sleep,
    get_sleep_days_count,
    get_weekly_sleep,
    log_sleep_time,
    log_wake_time,
)
from keyboards import MAIN_MENU


async def sleep_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args

    if not args:
        await update.message.reply_text(
            "😴 *Uyqu kuzatuvchi*\n\n"
            "`/sleep 23:00` — uxlash vaqtini yozish\n"
            "`/wake 07:00`  — turish vaqtini yozish\n"
            "`/sleepstats`  — haftalik statistika",
            parse_mode="Markdown",
        )
        return

    time_str = args[0]
    try:
        datetime.strptime(time_str, "%H:%M")
    except ValueError:
        await update.message.reply_text(
            "❌ Vaqt `HH:MM` formatida bo'lishi kerak. Misol: `/sleep 23:30`",
            parse_mode="Markdown",
        )
        return

    log_sleep_time(user_id, time_str)
    await update.message.reply_text(
        f"😴 *Uxlash vaqti yozildi:* {time_str}\n\n"
        f"Ertaga turganingizda: `/wake HH:MM`",
        parse_mode="Markdown",
    )


async def wake_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args

    if not args:
        await update.message.reply_text(
            "⏰ Format: `/wake 07:30`",
            parse_mode="Markdown",
        )
        return

    time_str = args[0]
    try:
        datetime.strptime(time_str, "%H:%M")
    except ValueError:
        await update.message.reply_text(
            "❌ Vaqt `HH:MM` formatida bo'lishi kerak.",
            parse_mode="Markdown",
        )
        return

    duration = log_wake_time(user_id, time_str)

    # Yutuqlar
    days    = get_sleep_days_count(user_id)
    new_ach = None
    if days >= 30 and grant_achievement(user_id, "sleep_30"):
        new_ach = ALL_ACHIEVEMENTS["sleep_30"]["name"]
    elif days >= 7 and grant_achievement(user_id, "sleep_7"):
        new_ach = ALL_ACHIEVEMENTS["sleep_7"]["name"]

    ach_text = f"\n\n🏆 *Yangi yutuq: {new_ach}!*" if new_ach else ""

    if duration is not None:
        if duration < 6:
            quality = "😞 Kam uyqu"
            advice  = "Bugun erta uxlashga harakat qiling!"
        elif duration < 7:
            quality = "😐 Normal"
            advice  = "Biroz ko'proq uxlasangiz yaxshi bo'lardi."
        elif duration <= 9:
            quality = "😊 Ajoyib"
            advice  = "Zo'r uyqu! Bugun produktiv bo'lasiz 💪"
        else:
            quality = "😴 Ko'p uxlabsiz"
            advice  = "Ozroq uxlasangiz energiyangiz ko'p bo'ladi."

        await update.message.reply_text(
            f"⏰ *Turish vaqti: {time_str}*\n\n"
            f"😴 Uyqu davomiyligi: *{duration:.1f} soat*\n"
            f"Sifat: {quality}\n\n"
            f"💡 {advice}"
            f"{ach_text}\n\n"
            f"/sleepstats — haftalik statistika",
            parse_mode="Markdown",
            reply_markup=MAIN_MENU,
        )
    else:
        await update.message.reply_text(
            f"⏰ *Turish vaqti yozildi: {time_str}*\n\n"
            f"💡 Uxlash vaqtini ham yozing: `/sleep HH:MM`"
            f"{ach_text}",
            parse_mode="Markdown",
        )


async def sleepstats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    weekly  = get_weekly_sleep(user_id)
    avg     = get_avg_sleep(user_id)

    has_data = any(w["entry"] for w in weekly)
    if not has_data:
        await update.message.reply_text(
            "😴 *Uyqu statistikasi*\n\nHali ma'lumot yo'q.\n\n"
            "`/sleep 23:00` — uxlash vaqtini yozish\n"
            "`/wake 07:00`  — turish vaqtini yozish",
            parse_mode="Markdown",
        )
        return

    days_uz = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
    chart   = ""
    for w in weekly:
        d        = datetime.strptime(w["date"], "%Y-%m-%d")
        day_name = days_uz[d.weekday()]
        entry    = w["entry"]
        if entry.get("duration"):
            hrs   = entry["duration"]
            bars  = min(int(hrs / 9 * 8), 8)
            bar   = "🟦" * bars + "⬜" * (8 - bars)
            chart += f"`{day_name}` {bar} *{hrs}h*\n"
        elif entry.get("sleep") or entry.get("wake"):
            s     = entry.get("sleep", "?")
            wk    = entry.get("wake", "?")
            chart += f"`{day_name}` 📝 {s} → {wk}\n"
        else:
            chart += f"`{day_name}` ──────── ─\n"

    avg_line = f"\n⏱ *O'rtacha: {avg:.1f} soat/kecha*" if avg else ""

    if avg:
        if avg < 6:
            advice = "⚠️ Ko'proq uxlashingiz kerak!"
        elif avg <= 9:
            advice = "✅ Ajoyib uyqu!"
        else:
            advice = "💡 Biroz kamroq uxlang."
    else:
        advice = ""

    await update.message.reply_text(
        f"😴 *Haftalik uyqu statistikasi*\n\n{chart}{avg_line}\n{advice}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )
