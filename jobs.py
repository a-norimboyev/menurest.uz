import logging
from datetime import datetime

from config import EVENING_REPORT_HOUR, MORNING_DIGEST_HOUR, TZ, scheduler
from data.habits import get_streak, get_user_habits, load_habits
from data.reminders import (
    get_user_reminders,
    load_reminders,
    next_occurrence,
    set_user_reminders,
)

logger = logging.getLogger(__name__)


async def send_reminder(bot, user_id: int, text: str) -> None:
    try:
        await bot.send_message(
            chat_id=user_id,
            text=f"🔔 *ESLATMA!*\n\n{text}",
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"send_reminder xato: {e}")


async def send_recurring_reminder(bot, user_id: int, reminder_id: str) -> None:
    reminders = get_user_reminders(user_id)
    reminder  = next((r for r in reminders if r["id"] == reminder_id), None)
    if not reminder:
        return
    try:
        names = {"daily": "har kuni", "weekly": "har hafta", "monthly": "har oy"}
        label = names.get(reminder.get("repeat", ""), "")
        await bot.send_message(
            chat_id=user_id,
            text=f"🔔 *ESLATMA* ({label})\n\n{reminder['text']}",
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error(f"send_recurring_reminder xato: {e}")
        return

    current_dt        = datetime.fromisoformat(reminder["datetime"])
    next_dt           = next_occurrence(current_dt, reminder["repeat"])
    reminder["datetime"] = next_dt.isoformat()
    set_user_reminders(user_id, reminders)

    scheduler.add_job(
        send_recurring_reminder, "date",
        run_date=next_dt,
        args=[bot, user_id, reminder_id],
        id=f"reminder_{user_id}_{reminder_id}",
        replace_existing=True,
    )


async def send_morning_digest(bot) -> None:
    data  = load_reminders()
    today = datetime.now(TZ).date()
    for uid_str, reminders in data.items():
        items = [
            r for r in reminders
            if datetime.fromisoformat(r["datetime"]).date() == today
        ]
        if not items:
            continue
        items.sort(key=lambda x: x["datetime"])
        text = "☀️ *Xayrli tong! Bugungi rejangiz:*\n\n"
        for r in items:
            dt    = datetime.fromisoformat(r["datetime"])
            text += f"🕐 {dt.strftime('%H:%M')} — {r['text']}\n"
        try:
            await bot.send_message(chat_id=int(uid_str), text=text, parse_mode="Markdown")
        except Exception as e:
            logger.error(f"send_morning_digest xato: {e}")


async def send_evening_report(bot) -> None:
    data  = load_habits()
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    for uid_str, user_data in data.items():
        tasks = user_data.get("tasks", [])
        if not tasks:
            continue
        completed   = user_data.get("completed", {}).get(today, [])
        done_tasks  = [t for t in tasks if t["id"] in completed]
        missed      = [t for t in tasks if t["id"] not in completed]
        streak      = get_streak(int(uid_str))
        streak_line = f"\n🔥 Streak: {streak} kun ketma-ket!" if streak >= 2 else ""

        text  = f"🌙 *Kechki hisobot — {today}*\n\n"
        text += f"✅ Bajarildi: {len(done_tasks)}/{len(tasks)}{streak_line}\n\n"
        if done_tasks:
            text += "*Bajardingiz:*\n" + "".join(f"  ✅ {t['text']}\n" for t in done_tasks)
        if missed:
            text += "\n*Bajarilmadi:*\n" + "".join(f"  ☐ {t['text']}\n" for t in missed)
        if len(done_tasks) == len(tasks):
            text += "\n🎉 Ajoyib! Bugun hammasi bajarildi!"
        elif not done_tasks:
            text += "\n💪 Ertaga yangi imkoniyat!"

        try:
            await bot.send_message(chat_id=int(uid_str), text=text, parse_mode="Markdown")
        except Exception as e:
            logger.error(f"send_evening_report xato: {e}")


async def post_init(application) -> None:
    from telegram.ext import Application
    data = load_reminders()
    now  = datetime.now(TZ)

    for uid_str, reminders in data.items():
        uid = int(uid_str)
        for r in reminders:
            dt = datetime.fromisoformat(r["datetime"])
            if dt > now:
                func = send_recurring_reminder if r.get("repeat") else send_reminder
                args = (
                    [application.bot, uid, r["id"]]
                    if r.get("repeat")
                    else [application.bot, uid, r["text"]]
                )
                scheduler.add_job(
                    func, "date",
                    run_date=dt,
                    args=args,
                    id=f"reminder_{uid}_{r['id']}",
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
    scheduler.start()
    logger.info("Scheduler ishga tushdi!")
