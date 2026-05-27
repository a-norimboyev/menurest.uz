import logging
from datetime import datetime, timedelta

from telegram import Update
from telegram.ext import ContextTypes

from config import TZ, scheduler
from data.achievements import ALL_ACHIEVEMENTS, grant_achievement, increment_pomodoro

logger = logging.getLogger(__name__)

# Xotirada faol taymerlar: {user_id: {"end_time": isoformat, "minutes": int}}
_active: dict[int, dict] = {}


async def focus_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args
    minutes = 25  # standart

    if args:
        try:
            minutes = int(args[0])
            if not (1 <= minutes <= 180):
                await update.message.reply_text("❌ Vaqt 1–180 daqiqa orasida bo'lishi kerak!")
                return
        except ValueError:
            await update.message.reply_text("❌ Daqiqa sonini kiriting. Misol: `/focus 30`", parse_mode="Markdown")
            return

    # Avvalgi taymerni o'chirish
    if user_id in _active:
        try:
            scheduler.remove_job(f"pomodoro_{user_id}")
        except Exception:
            pass

    now      = datetime.now(TZ)
    end_time = now + timedelta(minutes=minutes)
    _active[user_id] = {"end_time": end_time.isoformat(), "minutes": minutes}

    scheduler.add_job(
        _send_done,
        "date",
        run_date=end_time,
        args=[context.bot, user_id, minutes],
        id=f"pomodoro_{user_id}",
        replace_existing=True,
    )

    await update.message.reply_text(
        f"🍅 *Fokus rejimi boshlandi!*\n\n"
        f"⏱ Muddati: *{minutes} daqiqa*\n"
        f"🏁 Tugash vaqti: *{end_time.strftime('%H:%M')}*\n\n"
        f"💪 Diqqatingizni jamlab ishlang!\n"
        f"❌ Bekor qilish: /stopfocus",
        parse_mode="Markdown",
    )


async def stopfocus_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id

    if user_id not in _active:
        await update.message.reply_text("❌ Faol fokus taymer yo'q.\n\nBoshlash: `/focus 25`", parse_mode="Markdown")
        return

    try:
        scheduler.remove_job(f"pomodoro_{user_id}")
    except Exception:
        pass

    info     = _active.pop(user_id)
    minutes  = info["minutes"]
    end_time = datetime.fromisoformat(info["end_time"])
    elapsed  = minutes - max(0, int((end_time - datetime.now(TZ)).total_seconds() / 60))

    await update.message.reply_text(
        f"⏹ *Fokus taymer to'xtatildi.*\n\n"
        f"⏱ Rejа: {minutes} daqiqa\n"
        f"✅ Ishlangan: {elapsed} daqiqa\n\n"
        f"Yana boshlash: `/focus {minutes}`",
        parse_mode="Markdown",
    )


async def _send_done(bot, user_id: int, minutes: int) -> None:
    try:
        _active.pop(user_id, None)

        # Sanash va yutuq
        count   = increment_pomodoro(user_id)
        new_ach = None
        if count >= 50 and grant_achievement(user_id, "focus_50"):
            new_ach = ALL_ACHIEVEMENTS["focus_50"]["name"]
        elif count >= 10 and grant_achievement(user_id, "focus_10"):
            new_ach = ALL_ACHIEVEMENTS["focus_10"]["name"]

        ach_text = f"\n🏆 *Yangi yutuq: {new_ach}!*" if new_ach else ""

        await bot.send_message(
            chat_id=user_id,
            text=f"🍅 *FOKUS TAYMER TUGADI!*\n\n"
                 f"✅ {minutes} daqiqa muvaffaqiyatli bajardingiz!\n"
                 f"📊 Jami Pomodoro: {count} ta\n\n"
                 f"☕ Endi 5 daqiqa dam oling.\n"
                 f"🔄 Yana boshlash: `/focus {minutes}`"
                 f"{ach_text}",
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"_send_done xato: {e}")
