import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from telegram import Update
from telegram.ext import ContextTypes

from config import TZ, scheduler
from data.achievements import ALL_ACHIEVEMENTS, grant_achievement, increment_pomodoro

logger = logging.getLogger(__name__)

POMODORO_FILE = Path("pomodoro_active.json")


def _load_active() -> dict:
    if POMODORO_FILE.exists():
        try:
            return json.loads(POMODORO_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_active(data: dict) -> None:
    POMODORO_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _set(user_id: int, end_time: datetime, minutes: int) -> None:
    data = _load_active()
    data[str(user_id)] = {"end_time": end_time.isoformat(), "minutes": minutes}
    _save_active(data)


def _remove(user_id: int) -> dict:
    data = _load_active()
    entry = data.pop(str(user_id), {})
    _save_active(data)
    return entry


def _get(user_id: int) -> dict:
    return _load_active().get(str(user_id), {})


def get_all_active() -> dict:
    """Bot qayta ishga tushganda barcha faol taymerlarni tiklash uchun."""
    return _load_active()


async def focus_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args
    minutes = 25

    if args:
        try:
            minutes = int(args[0])
            if not (1 <= minutes <= 180):
                await update.message.reply_text("❌ Vaqt 1–180 daqiqa orasida bo'lishi kerak!")
                return
        except ValueError:
            await update.message.reply_text(
                "❌ Daqiqa sonini kiriting. Misol: `/focus 30`", parse_mode="Markdown"
            )
            return

    # Avvalgi taymerni o'chirish
    if _get(user_id):
        try:
            scheduler.remove_job(f"pomodoro_{user_id}")
        except Exception:
            pass

    now      = datetime.now(TZ)
    end_time = now + timedelta(minutes=minutes)

    _set(user_id, end_time, minutes)

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
    entry   = _get(user_id)

    if not entry:
        await update.message.reply_text(
            "❌ Faol fokus taymer yo'q.\n\nBoshlash: `/focus 25`", parse_mode="Markdown"
        )
        return

    try:
        scheduler.remove_job(f"pomodoro_{user_id}")
    except Exception:
        pass

    _remove(user_id)
    minutes  = entry["minutes"]
    end_time = datetime.fromisoformat(entry["end_time"])
    elapsed  = minutes - max(0, int((end_time - datetime.now(TZ)).total_seconds() / 60))

    await update.message.reply_text(
        f"⏹ *Fokus taymer to'xtatildi.*\n\n"
        f"⏱ Reja: {minutes} daqiqa\n"
        f"✅ Ishlangan: ~{elapsed} daqiqa\n\n"
        f"Yana boshlash: `/focus {minutes}`",
        parse_mode="Markdown",
    )


async def _send_done(bot, user_id: int, minutes: int) -> None:
    try:
        _remove(user_id)

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
