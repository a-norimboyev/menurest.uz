"""
Shaxsiy Eslatma Bot — ishga tushirish nuqtasi

Fayl tuzilmasi:
  config.py              — sozlamalar (BOT_TOKEN, TZ, scheduler)
  keyboards.py           — asosiy menyu
  data/reminders.py      — eslatmalar ma'lumot
  data/habits.py         — vazifalar ma'lumot + streak/stats
  data/mood.py           — kayfiyat kuzatuvchi
  data/expense.py        — xarajatlar kuzatuvchi
  data/books.py          — kitoblar ro'yxati
  data/water.py          — suv kuzatuvchi
  data/goals.py          — maqsadlar
  data/sleep.py          — uyqu kuzatuvchi
  data/achievements.py   — yutuqlar tizimi
  handlers/misc.py       — /start, /help, menyu tugmalari
  handlers/reminders.py  — /add, /list, /today, /tomorrow, /week, /delete, /addr
  handlers/habits.py     — /habits, /addhabit, /delhabit
  handlers/stats.py      — /stats
  handlers/mood.py       — /mood
  handlers/expense.py    — /spend, /budget, /limit
  handlers/pomodoro.py   — /focus, /stopfocus
  handlers/books.py      — /addbook, /books
  handlers/water.py      — /water, /drank
  handlers/goals.py      — /goal, /goals, /progress
  handlers/sleep.py      — /sleep, /wake, /sleepstats
  handlers/ai_motivate.py — /motivate
  handlers/badges.py     — /badges
  jobs.py                — barcha avtomatik joblar
"""

from telegram import Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    filters,
)

from config import BOT_TOKEN
from handlers.ai_motivate import motivate_command
from handlers.badges import badges_command
from handlers.books import addbook_command, book_callback, books_command
from handlers.expense import budget_command, limit_command, spend_command, undospend_command
from handlers.goals import goal_callback, goal_command, goals_command, progress_command
from handlers.habits import add_habit, del_habit_command, habit_callback, habits_command
from handlers.misc import help_command, menu_handler, start
from handlers.mood import mood_callback, mood_command
from handlers.pomodoro import focus_command, stopfocus_command
from handlers.reminders import (
    add_recurring,
    add_reminder,
    delete_callback,
    delete_reminder,
    list_reminders,
    today_reminders,
    tomorrow_reminders,
    week_reminders,
)
from handlers.sleep import sleep_command, sleepstats_command, wake_command
from handlers.stats import stats_command
from handlers.water import drank_command, water_command
from jobs import post_init


def main() -> None:
    if not BOT_TOKEN:
        print("XATO: BOT_TOKEN o'rnatilmagan! .env faylini tekshiring.")
        return

    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    # ── Eslatmalar ──────────────────────────────────────────────
    app.add_handler(CommandHandler("add",        add_reminder))
    app.add_handler(CommandHandler("list",       list_reminders))
    app.add_handler(CommandHandler("today",      today_reminders))
    app.add_handler(CommandHandler("tomorrow",   tomorrow_reminders))
    app.add_handler(CommandHandler("week",       week_reminders))
    app.add_handler(CommandHandler("delete",     delete_reminder))
    app.add_handler(CommandHandler("addr",       add_recurring))

    # ── Odatlar ─────────────────────────────────────────────────
    app.add_handler(CommandHandler("habits",     habits_command))
    app.add_handler(CommandHandler("addhabit",   add_habit))
    app.add_handler(CommandHandler("delhabit",   del_habit_command))
    app.add_handler(CommandHandler("stats",      stats_command))

    # ── Kayfiyat ────────────────────────────────────────────────
    app.add_handler(CommandHandler("mood",       mood_command))

    # ── Xarajatlar ──────────────────────────────────────────────
    app.add_handler(CommandHandler("spend",      spend_command))
    app.add_handler(CommandHandler("budget",     budget_command))
    app.add_handler(CommandHandler("limit",      limit_command))
    app.add_handler(CommandHandler("undospend",  undospend_command))

    # ── Pomodoro ────────────────────────────────────────────────
    app.add_handler(CommandHandler("focus",      focus_command))
    app.add_handler(CommandHandler("stopfocus",  stopfocus_command))

    # ── Kitoblar ────────────────────────────────────────────────
    app.add_handler(CommandHandler("addbook",    addbook_command))
    app.add_handler(CommandHandler("books",      books_command))

    # ── Suv ─────────────────────────────────────────────────────
    app.add_handler(CommandHandler("water",      water_command))
    app.add_handler(CommandHandler("drank",      drank_command))

    # ── Maqsadlar ───────────────────────────────────────────────
    app.add_handler(CommandHandler("goal",       goal_command))
    app.add_handler(CommandHandler("goals",      goals_command))
    app.add_handler(CommandHandler("progress",   progress_command))

    # ── Uyqu ────────────────────────────────────────────────────
    app.add_handler(CommandHandler("sleep",      sleep_command))
    app.add_handler(CommandHandler("wake",       wake_command))
    app.add_handler(CommandHandler("sleepstats", sleepstats_command))

    # ── Yutuqlar & AI ───────────────────────────────────────────
    app.add_handler(CommandHandler("badges",     badges_command))
    app.add_handler(CommandHandler("motivate",   motivate_command))

    # ── Umumiy ──────────────────────────────────────────────────
    app.add_handler(CommandHandler("start",      start))
    app.add_handler(CommandHandler("help",       help_command))

    # ── Inline callback-lar ─────────────────────────────────────
    app.add_handler(CallbackQueryHandler(delete_callback,  pattern="^del_"))
    app.add_handler(CallbackQueryHandler(habit_callback,   pattern="^habit"))
    app.add_handler(CallbackQueryHandler(habit_callback,   pattern="^habdel_"))
    app.add_handler(CallbackQueryHandler(mood_callback,    pattern="^mood_"))
    app.add_handler(CallbackQueryHandler(book_callback,    pattern="^bk"))
    app.add_handler(CallbackQueryHandler(goal_callback,    pattern="^goal"))

    # ── Menyu tugmalari (reply keyboard) ────────────────────────
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, menu_handler))

    print("Bot ishga tushdi! Toxtatish uchun Ctrl+C bosing.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
