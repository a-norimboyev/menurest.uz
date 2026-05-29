import logging
from datetime import datetime

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from config import (
    EVENING_REPORT_HOUR,
    MORNING_DIGEST_HOUR,
    TZ,
    WEEKLY_REPORT_DAY,
    WEEKLY_REPORT_HOUR,
    scheduler,
)
from data.habits import get_streak, get_task_days_done, get_weekly_stats, load_habits
from data.mood import get_mood_avg, get_weekly_mood
from data.expense import get_month_expenses, get_total
from data.sleep import get_avg_sleep
from data.water import get_all_enabled_users
from data.reminders import (
    get_user_reminders,
    load_reminders,
    next_occurrence,
    set_user_reminders,
)

logger = logging.getLogger(__name__)


# ─── Eslatmalar ──────────────────────────────────────────────────────────────

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

    current_dt           = datetime.fromisoformat(reminder["datetime"])
    next_dt              = next_occurrence(current_dt, reminder["repeat"])
    reminder["datetime"] = next_dt.isoformat()
    set_user_reminders(user_id, reminders)

    scheduler.add_job(
        send_recurring_reminder, "date",
        run_date=next_dt,
        args=[bot, user_id, reminder_id],
        id=f"reminder_{user_id}_{reminder_id}",
        replace_existing=True,
    )


# ─── Ertalabki hisobot ────────────────────────────────────────────────────────

async def send_morning_digest(bot) -> None:
    reminders_data = load_reminders()
    habits_data    = load_habits()
    today          = datetime.now(TZ).date()
    today_str      = today.strftime("%Y-%m-%d")

    all_uids = set(reminders_data.keys()) | set(habits_data.keys())

    for uid_str in all_uids:
        uid = int(uid_str)

        reminders = reminders_data.get(uid_str, [])
        items     = [
            r for r in reminders
            if datetime.fromisoformat(r["datetime"]).date() == today
        ]
        items.sort(key=lambda x: x["datetime"])

        tasks     = habits_data.get(uid_str, {}).get("tasks", [])
        completed = habits_data.get(uid_str, {}).get("completed", {}).get(today_str, [])
        streak    = get_streak(uid)

        if not items and not tasks:
            continue

        text = f"☀️ *Xayrli tong! — {today_str}*\n"
        if streak >= 2:
            text += f"🔥 {streak} kun ketma-ket!\n"
        text += "\n"

        if items:
            text += "📅 *Bugungi eslatmalar:*\n"
            for r in items:
                dt    = datetime.fromisoformat(r["datetime"])
                text += f"  🕐 {dt.strftime('%H:%M')} — {r['text']}\n"
            text += "\n"

        keyboard = []
        if tasks:
            done   = len([t for t in tasks if t["id"] in completed])
            text  += f"📌 *Kunlik vazifalar ({done}/{len(tasks)}):*\n"
            for t in tasks:
                check     = "✅" if t["id"] in completed else "☐"
                dur       = t.get("duration", 0)
                days_done = get_task_days_done(uid, t["id"])
                if dur > 0:
                    label = f"{check} {t['text']} ({days_done}/{dur})"
                else:
                    label = f"{check} {t['text']}"
                text += f"  {label}\n"
                keyboard.append([
                    InlineKeyboardButton(label, callback_data=f"habit_{t['id']}")
                ])

        reply_markup = InlineKeyboardMarkup(keyboard) if keyboard else None
        try:
            await bot.send_message(
                chat_id=uid,
                text=text,
                parse_mode="Markdown",
                reply_markup=reply_markup,
            )
        except Exception as e:
            logger.error(f"send_morning_digest xato: {e}")


# ─── Kechki hisobot ───────────────────────────────────────────────────────────

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


# ─── Haftalik xulosa ──────────────────────────────────────────────────────────

async def send_weekly_report(bot) -> None:
    """Har yakshanba kechki haftalik xulosa."""
    from data.books import get_user_books

    habits_data = load_habits()
    for uid_str in habits_data:
        uid = int(uid_str)
        try:
            streak = get_streak(uid)
            weekly = get_weekly_stats(uid)
            tasks  = habits_data.get(uid_str, {}).get("tasks", [])
            if not tasks:
                continue

            total_pct = round(sum(w["pct"] for w in weekly) / len(weekly), 0) if weekly else 0
            days_uz   = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
            chart     = ""
            for w in weekly:
                d        = datetime.strptime(w["date"], "%Y-%m-%d")
                day_name = days_uz[d.weekday()]
                blocks   = int(w["pct"] / 20)
                bar      = "🟩" * blocks + "⬜" * (5 - blocks)
                chart   += f"`{day_name}` {bar} {w['pct']}%\n"

            # Kayfiyat o'rtachasi — bo'sh bo'lsa xato chiqmasin
            mood_weekly = get_weekly_mood(uid)
            mood_scores = [w["entry"]["score"] for w in mood_weekly if w["entry"]]
            mood_avg    = sum(mood_scores) / len(mood_scores) if mood_scores else None
            mood_line   = f"\n😊 Haftalik kayfiyat o'rtachasi: *{mood_avg:.1f}/5*" if mood_avg else ""

            # Uyqu o'rtachasi
            avg_sleep = get_avg_sleep(uid)
            sleep_line = f"\n😴 O'rtacha uyqu: *{avg_sleep:.1f} soat/kecha*" if avg_sleep else ""

            # Bu oy xarajat
            month_exp   = get_month_expenses(uid)
            month_total = get_total(month_exp)
            exp_line    = f"\n💰 Bu oy xarajat: *{month_total:,.0f} so'm*" if month_exp else ""

            # O'qilgan kitoblar
            books      = get_user_books(uid)
            done_books = [b for b in books if b["status"] == "done"]
            book_line  = f"\n📚 O'qilgan kitoblar: *{len(done_books)} ta*" if done_books else ""

            streak_line = f"🔥 *{streak} kun ketma-ket streak!*\n\n" if streak >= 1 else ""

            text = (
                f"📊 *Haftalik xulosa*\n\n"
                f"{streak_line}"
                f"📈 O'rtacha: *{total_pct:.0f}%*\n\n"
                f"{chart}"
                f"{mood_line}"
                f"{sleep_line}"
                f"{exp_line}"
                f"{book_line}\n\n"
                f"💪 Kelasi hafta ham muvaffaqiyatli bo'lsin!"
            )

            await bot.send_message(chat_id=uid, text=text, parse_mode="Markdown")
        except Exception as e:
            logger.error(f"send_weekly_report xato ({uid_str}): {e}")


# ─── Bot ishga tushishi ───────────────────────────────────────────────────────

async def post_init(application) -> None:
    from telegram import BotCommand
    from handlers.water import send_water_reminder

    commands = [
        BotCommand("start",      "Boshlash"),
        BotCommand("add",        "Yangi eslatma qo'shish"),
        BotCommand("today",      "Bugungi eslatmalar"),
        BotCommand("tomorrow",   "Ertangi eslatmalar"),
        BotCommand("week",       "Haftalik reja"),
        BotCommand("list",       "Barcha eslatmalar"),
        BotCommand("delete",     "Eslatma o'chirish"),
        BotCommand("addr",       "Takrorlanuvchi eslatma"),
        BotCommand("habits",     "Kunlik vazifalar"),
        BotCommand("addhabit",   "Yangi kunlik vazifa"),
        BotCommand("delhabit",   "Vazifa o'chirish"),
        BotCommand("stats",      "Statistika"),
        BotCommand("mood",       "Kayfiyat kuzatuvchi"),
        BotCommand("spend",      "Xarajat qo'shish"),
        BotCommand("budget",     "Xarajatlar hisoboti"),
        BotCommand("limit",      "Oylik limit belgilash"),
        BotCommand("focus",      "Pomodoro taymer boshlash"),
        BotCommand("stopfocus",  "Pomodoro taymerni to'xtatish"),
        BotCommand("addbook",    "Kitob qo'shish"),
        BotCommand("books",      "Kitoblar ro'yxati"),
        BotCommand("water",      "Suv eslatmasi sozlash"),
        BotCommand("drank",      "Suv ichdim belgilash"),
        BotCommand("goal",       "Yangi maqsad qo'shish"),
        BotCommand("goals",      "Maqsadlar ro'yxati"),
        BotCommand("progress",   "Maqsad progressini yangilash"),
        BotCommand("sleep",      "Uxlash vaqtini yozish"),
        BotCommand("wake",       "Turish vaqtini yozish"),
        BotCommand("sleepstats", "Uyqu statistikasi"),
        BotCommand("badges",     "Yutuqlar ro'yxati"),
        BotCommand("motivate",   "AI motivatsiya"),
        BotCommand("help",       "Yordam"),
    ]
    await application.bot.set_my_commands(commands)

    # Eslatmalarni tiklash
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

    # Pomodoro taymerlarini tiklash
    from handlers.pomodoro import _send_done, get_all_active
    active_pomodoros = get_all_active()
    for uid_str, entry in active_pomodoros.items():
        uid      = int(uid_str)
        end_time = datetime.fromisoformat(entry["end_time"])
        minutes  = entry["minutes"]
        if end_time > now:
            scheduler.add_job(
                _send_done, "date",
                run_date=end_time,
                args=[application.bot, uid, minutes],
                id=f"pomodoro_{uid}",
                replace_existing=True,
            )
        else:
            # Vaqt o'tib ketgan — fayldan o'chirib yuboramiz
            from handlers.pomodoro import _remove
            _remove(uid)

    # Suv eslatmalarini tiklash
    water_users = get_all_enabled_users()
    for uid_str, info in water_users.items():
        uid      = int(uid_str)
        interval = info.get("interval", 2)
        scheduler.add_job(
            send_water_reminder,
            "interval",
            hours=interval,
            args=[application.bot, uid],
            id=f"water_{uid}",
            replace_existing=True,
        )

    # Har kuni
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

    # Har yakshanba
    scheduler.add_job(
        send_weekly_report, "cron",
        day_of_week=WEEKLY_REPORT_DAY,
        hour=WEEKLY_REPORT_HOUR, minute=0,
        args=[application.bot],
        id="weekly_report",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler ishga tushdi!")
