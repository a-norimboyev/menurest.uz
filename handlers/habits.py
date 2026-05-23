from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from data.habits import (
    add_task,
    build_habits_keyboard,
    check_milestone,
    get_task_days_done,
    get_today_completed,
    get_user_habits,
    habits_header,
    load_habits,
    remove_task,
    save_habits,
    toggle_habit,
)


async def habits_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    tasks   = get_user_habits(user_id)
    if not tasks:
        await update.message.reply_text(
            "📌 *Kunlik vazifalar*\n\nHali vazifalar yo'q.\n\n"
            "`/addhabit Sport` — doimiy\n"
            "`/addhabit Sport 30` — 30 kunlik",
            parse_mode="Markdown",
        )
        return
    await update.message.reply_text(
        habits_header(user_id),
        parse_mode="Markdown",
        reply_markup=build_habits_keyboard(user_id),
    )


async def add_habit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args
    if not args:
        await update.message.reply_text(
            "❌ Format:\n`/addhabit Vazifa` — doimiy\n`/addhabit Vazifa 20` — 20 kunlik",
            parse_mode="Markdown",
        )
        return

    if args[-1].isdigit():
        duration = int(args[-1])
        text     = " ".join(args[:-1])
    else:
        duration = 0
        text     = " ".join(args)

    if not text:
        await update.message.reply_text("❌ Vazifa nomini kiriting.")
        return

    add_task(user_id, text, duration)
    msg = (
        f"✅ *{text}* — {duration} kunlik vazifa qo'shildi!\n\n/habits"
        if duration > 0
        else f"✅ *{text}* — doimiy vazifa qo'shildi!\n\n/habits"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def del_habit_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    tasks   = get_user_habits(user_id)
    if not tasks:
        await update.message.reply_text("📭 O'chirish uchun vazifalar yo'q.")
        return
    keyboard = [
        [InlineKeyboardButton(f"🗑 {t['text']}", callback_data=f"habdel_{t['id']}")]
        for t in tasks
    ]
    keyboard.append([InlineKeyboardButton("❌ Bekor qilish", callback_data="habdel_cancel")])
    await update.message.reply_text(
        "Qaysi vazifani o'chirmoqchisiz?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def habit_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query   = update.callback_query
    await query.answer()
    user_id = query.from_user.id

    if query.data == "habit_finished":
        await query.answer("🏆 Bu vazifa allaqachon tugallangan!", show_alert=True)
        return

    if query.data == "habit_stats":
        tasks     = get_user_habits(user_id)
        completed = get_today_completed(user_id)
        done      = len([t for t in tasks if t["id"] in completed])
        await query.answer(f"Bugun: {done}/{len(tasks)} bajarildi", show_alert=True)
        return

    if query.data.startswith("habit_"):
        task_id = query.data.replace("habit_", "", 1)
        toggle_habit(user_id, task_id)
        tasks = get_user_habits(user_id)
        task  = next((t for t in tasks if t["id"] == task_id), None)
        if task and task.get("duration", 0) > 0:
            days_done = get_task_days_done(user_id, task_id)
            dur       = task["duration"]
            if days_done >= dur:
                await query.answer(
                    f"🏆 TABRIKLAYMIZ! '{task['text']}' — {dur} kunlik maqsad bajarildi!",
                    show_alert=True,
                )
            else:
                milestone = check_milestone(user_id, task_id)
                if milestone:
                    await query.answer(
                        f"🎉 {milestone} kun! '{task['text']}' — ajoyib natija!",
                        show_alert=True,
                    )
        await query.edit_message_text(
            habits_header(user_id),
            parse_mode="Markdown",
            reply_markup=build_habits_keyboard(user_id),
        )
        return

    if query.data == "habdel_cancel":
        await query.edit_message_text("✅ Bekor qilindi.")
        return

    if query.data.startswith("habdel_"):
        task_id = query.data.replace("habdel_", "", 1)
        deleted = remove_task(user_id, task_id)
        if deleted:
            await query.edit_message_text(f"🗑 O'chirildi: *{deleted['text']}*", parse_mode="Markdown")
        else:
            await query.edit_message_text("❌ Vazifa topilmadi.")
