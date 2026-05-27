from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from data.achievements import ALL_ACHIEVEMENTS, grant_achievement
from data.goals import (
    add_goal,
    delete_goal,
    get_done_goals_count,
    get_user_goals,
    update_progress,
)
from keyboards import MAIN_MENU


def _progress_bar(pct: int, width: int = 10) -> str:
    filled = min(int(pct / 100 * width), width)
    return "█" * filled + "░" * (width - filled)


async def goal_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args

    if not args:
        await update.message.reply_text(
            "🎯 *Yangi maqsad qo'shish*\n\n"
            "Format: `/goal Maqsad nomi KUN`\n\n"
            "Misol:\n"
            "`/goal 5 kg yo'qotish 90`\n"
            "`/goal IELTS 7.0 olish 180`\n"
            "`/goal Kitob yozish 365`\n"
            "`/goal Ingliz tili 0` — muddatsiz\n\n"
            "/goals — barcha maqsadlar",
            parse_mode="Markdown",
        )
        return

    if args[-1].isdigit():
        days  = int(args[-1])
        title = " ".join(args[:-1])
    else:
        days  = 0
        title = " ".join(args)

    if not title:
        await update.message.reply_text("❌ Maqsad nomini kiriting!")
        return

    add_goal(user_id, title, days)
    days_text = f"{days} kun ichida" if days > 0 else "muddatsiz"

    await update.message.reply_text(
        f"🎯 *Maqsad qo'shildi!*\n\n"
        f"📋 {title}\n"
        f"📅 {days_text}\n\n"
        f"Progress: `/progress 1 50` — 1-maqsadga 50% qo'yish\n"
        f"/goals — barcha maqsadlar",
        parse_mode="Markdown",
    )


async def goals_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    goals   = get_user_goals(user_id)

    if not goals:
        await update.message.reply_text(
            "🎯 *Maqsadlar*\n\nHali maqsadlar yo'q.\n\n"
            "`/goal IELTS olish 180` — maqsad qo'shish",
            parse_mode="Markdown",
        )
        return

    active     = [g for g in goals if not g["done"]]
    done_goals = [g for g in goals if g["done"]]

    text = "🎯 *Maqsadlar*\n\n"
    for i, g in enumerate(active, 1):
        bar      = _progress_bar(g["progress"])
        dur_line = f" _{g['deadline_days']} kun_" if g["deadline_days"] > 0 else ""
        text    += f"{i}. *{g['title']}*{dur_line}\n"
        text    += f"   `{bar}` {g['progress']}%\n\n"

    if done_goals:
        text += f"✅ *Tugallangan ({len(done_goals)} ta):*\n"
        for g in done_goals[-3:]:
            text += f"  🏆 {g['title']}\n"

    keyboard = []
    for g in active:
        keyboard.append([
            InlineKeyboardButton(
                f"📈 {g['title'][:30]} ({g['progress']}%)",
                callback_data=f"goalupd_{g['id']}",
            )
        ])
    if goals:
        keyboard.append([InlineKeyboardButton("🗑 Maqsad o'chirish", callback_data="goal_del_menu")])

    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None,
    )


async def progress_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args

    if len(args) < 2:
        await update.message.reply_text(
            "❌ Format: `/progress RAQAM FOIZ`\n\n"
            "Misol: `/progress 1 75` — 1-maqsadga 75% qo'yish\n"
            "/goals — maqsadlar ro'yxati",
            parse_mode="Markdown",
        )
        return

    try:
        idx = int(args[0]) - 1
        pct = int(args[1].replace("%", "").replace("+", ""))
    except ValueError:
        await update.message.reply_text("❌ Raqamlar kiriting!")
        return

    active = [g for g in get_user_goals(user_id) if not g["done"]]
    if idx < 0 or idx >= len(active):
        await update.message.reply_text(
            f"❌ Maqsad topilmadi. /goals — ro'yxatni ko'ring"
        )
        return

    goal    = active[idx]
    updated = update_progress(user_id, goal["id"], min(pct, 100))
    bar     = _progress_bar(min(pct, 100))

    if updated and updated["done"]:
        done_count = get_done_goals_count(user_id)
        new_ach    = None
        if done_count >= 5 and grant_achievement(user_id, "goal_5"):
            new_ach = ALL_ACHIEVEMENTS["goal_5"]["name"]
        elif done_count >= 1 and grant_achievement(user_id, "goal_1"):
            new_ach = ALL_ACHIEVEMENTS["goal_1"]["name"]

        ach_text = f"\n🏆 *Yangi yutuq: {new_ach}!*" if new_ach else ""
        await update.message.reply_text(
            f"🎉 *MAQSAD TUGALLANDI!*\n\n"
            f"🏆 {goal['title']}\n"
            f"`{bar}` 100%{ach_text}",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text(
            f"📈 *Progress yangilandi!*\n\n"
            f"🎯 {goal['title']}\n"
            f"`{bar}` {pct}%",
            parse_mode="Markdown",
        )


async def goal_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query   = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    data    = query.data

    if data == "goal_del_menu":
        goals    = get_user_goals(user_id)
        keyboard = [
            [InlineKeyboardButton(f"🗑 {g['title'][:35]}", callback_data=f"goaldel_{g['id']}")]
            for g in goals
        ]
        keyboard.append([InlineKeyboardButton("❌ Bekor", callback_data="goal_cancel")])
        await query.edit_message_text(
            "Qaysi maqsadni o'chirmoqchisiz?",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )

    elif data.startswith("goaldel_"):
        goal_id = data.replace("goaldel_", "")
        goal    = delete_goal(user_id, goal_id)
        msg     = f"🗑 O'chirildi: *{goal['title']}*" if goal else "❌ Topilmadi."
        await query.edit_message_text(msg, parse_mode="Markdown")

    elif data == "goal_cancel":
        await query.edit_message_text("✅ Bekor qilindi.")

    elif data.startswith("goalupd_"):
        await query.answer(
            "Progress yangilash: /progress RAQAM FOIZ\nMisol: /progress 1 60",
            show_alert=True,
        )
