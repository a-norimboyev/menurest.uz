"""
Shaxsiy Eslatma Bot — ishga tushirish nuqtasi

Fayl tuzilmasi:
  config.py          — sozlamalar (BOT_TOKEN, TZ, scheduler)
  keyboards.py       — pastki menyu
  data/reminders.py  — eslatmalar ma'lumot
  data/habits.py     — vazifalar ma'lumot + streak/stats
  handlers/misc.py   — /start, /help
  handlers/reminders.py — /add, /list, /today, /tomorrow, /week, /delete, /addr
  handlers/habits.py — /habits, /addhabit, /delhabit
  handlers/stats.py  — /stats
  jobs.py            — ertalabki/kechki hisobot, takrorlanuvchi eslatmalar
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
from handlers.habits import del_habit_command, add_habit, habit_callback, habits_command
from handlers.misc import help_command, start
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
from handlers.stats import stats_command
from jobs import post_init


async def menu_button_handler(update, context) -> None:
    text = update.message.text
    dispatch = {
        "📅 Bugun":      today_reminders,
        "📅 Ertaga":     tomorrow_reminders,
        "🗓 Hafta":      week_reminders,
        "📋 Hammasi":    list_reminders,
        "📌 Kunlik":     habits_command,
        "📊 Statistika": stats_command,
        "🗑 O'chirish":  delete_reminder,
        "❓ Yordam":     help_command,
    }
    handler = dispatch.get(text)
    if handler:
        await handler(update, context)


def main() -> None:
    if not BOT_TOKEN:
        print("XATO: BOT_TOKEN o'rnatilmagan! .env faylini tekshiring.")
        return

    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start",    start))
    app.add_handler(CommandHandler("help",     help_command))
    app.add_handler(CommandHandler("add",      add_reminder))
    app.add_handler(CommandHandler("list",     list_reminders))
    app.add_handler(CommandHandler("today",    today_reminders))
    app.add_handler(CommandHandler("tomorrow", tomorrow_reminders))
    app.add_handler(CommandHandler("week",     week_reminders))
    app.add_handler(CommandHandler("delete",   delete_reminder))
    app.add_handler(CommandHandler("addr",     add_recurring))
    app.add_handler(CommandHandler("habits",   habits_command))
    app.add_handler(CommandHandler("addhabit", add_habit))
    app.add_handler(CommandHandler("delhabit", del_habit_command))
    app.add_handler(CommandHandler("stats",    stats_command))

    app.add_handler(CallbackQueryHandler(delete_callback, pattern="^del_"))
    app.add_handler(CallbackQueryHandler(habit_callback,  pattern="^habit"))
    app.add_handler(CallbackQueryHandler(habit_callback,  pattern="^habdel_"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, menu_button_handler))

    print("Bot ishga tushdi! Toxtatish uchun Ctrl+C bosing.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
