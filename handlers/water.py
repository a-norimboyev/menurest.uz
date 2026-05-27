import logging
from datetime import datetime, timedelta

from telegram import Update
from telegram.ext import ContextTypes

from config import TZ, scheduler
from data.achievements import ALL_ACHIEVEMENTS, grant_achievement
from data.water import (
    disable_water_reminder,
    get_today_drank,
    get_water_days_count,
    get_water_settings,
    log_drank,
    set_water_reminder,
)
from keyboards import MAIN_MENU

logger = logging.getLogger(__name__)

DAILY_GOAL = 8  # stakan


async def water_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id  = update.effective_user.id
    args     = context.args

    if not args:
        settings    = get_water_settings(user_id)
        today_count = get_today_drank(user_id)
        status      = "✅ Yoqilgan" if settings["enabled"] else "❌ O'chirilgan"
        bar         = "💧" * today_count + "⬜" * max(0, DAILY_GOAL - today_count)

        await update.message.reply_text(
            f"💧 *Suv eslatmasi*\n\n"
            f"Holat: {status}\n"
            f"Interval: har *{settings['interval']} soat*\n\n"
            f"Bugun: {bar} {today_count}/{DAILY_GOAL}\n\n"
            f"`/water on` — yoqish (har 2 soat)\n"
            f"`/water on 3` — har 3 soatda\n"
            f"`/water off` — o'chirish\n"
            f"`/drank` — ichganimni belgilash",
            parse_mode="Markdown",
        )
        return

    action = args[0].lower()

    if action == "on":
        interval = 2
        if len(args) > 1:
            try:
                interval = int(args[1])
                if not (1 <= interval <= 8):
                    await update.message.reply_text("❌ Interval 1–8 soat orasida bo'lishi kerak!")
                    return
            except ValueError:
                pass

        set_water_reminder(user_id, interval)

        now       = datetime.now(TZ)
        next_time = now + timedelta(hours=interval)

        scheduler.add_job(
            send_water_reminder,
            "interval",
            hours=interval,
            start_date=next_time,
            args=[context.bot, user_id],
            id=f"water_{user_id}",
            replace_existing=True,
        )

        await update.message.reply_text(
            f"💧 *Suv eslatmasi yoqildi!*\n\n"
            f"⏰ Har *{interval} soat*da eslatma keladi.\n"
            f"Keyingi: *{next_time.strftime('%H:%M')}*\n\n"
            f"Ichgach `/drank` deb yozing ✅",
            parse_mode="Markdown",
        )

    elif action == "off":
        disable_water_reminder(user_id)
        try:
            scheduler.remove_job(f"water_{user_id}")
        except Exception:
            pass
        await update.message.reply_text("💧 Suv eslatmasi o'chirildi.")

    else:
        await update.message.reply_text(
            "❌ `/water on` yoki `/water off`", parse_mode="Markdown"
        )


async def drank_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    count   = log_drank(user_id)

    # Yutuqlar
    days    = get_water_days_count(user_id)
    new_ach = None
    if days >= 30 and grant_achievement(user_id, "water_30"):
        new_ach = ALL_ACHIEVEMENTS["water_30"]["name"]
    elif days >= 7 and grant_achievement(user_id, "water_7"):
        new_ach = ALL_ACHIEVEMENTS["water_7"]["name"]

    bar = "💧" * min(count, DAILY_GOAL) + "⬜" * max(0, DAILY_GOAL - count)

    if count >= DAILY_GOAL:
        msg = "🎉 *Kunlik maqsadga erishdingiz!* Zo'r!"
    elif count >= DAILY_GOAL // 2:
        msg = "👍 Yaxshi! Davom eting."
    else:
        msg = "💪 Boshlandi! Suv ichish odatini shakllantiryapsiz."

    ach_text = f"\n🏆 *Yangi yutuq: {new_ach}!*" if new_ach else ""

    await update.message.reply_text(
        f"💧 *Suv ichildi!*\n\n"
        f"{bar}\n"
        f"Bugun: *{count}/{DAILY_GOAL}* stakan\n\n"
        f"{msg}{ach_text}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


async def send_water_reminder(bot, user_id: int) -> None:
    try:
        count = get_today_drank(user_id)
        bar   = "💧" * min(count, DAILY_GOAL) + "⬜" * max(0, DAILY_GOAL - count)
        await bot.send_message(
            chat_id=user_id,
            text=f"💧 *Suv ichish vaqti!*\n\n"
                 f"{bar}\n"
                 f"Bugun: {count}/{DAILY_GOAL} stakan\n\n"
                 f"Ichgach `/drank` deb yozing ✅",
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"send_water_reminder xato: {e}")
