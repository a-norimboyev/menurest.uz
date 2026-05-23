from datetime import datetime

from telegram import Update
from telegram.ext import ContextTypes

from data.habits import get_streak, get_user_habits, get_weekly_stats, load_habits


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    tasks   = get_user_habits(user_id)
    weekly  = get_weekly_stats(user_id)
    streak  = get_streak(user_id)

    if not tasks:
        await update.message.reply_text(
            "📊 *Statistika*\n\nHali vazifalar yo'q.\n`/addhabit` bilan qo'shing.",
            parse_mode="Markdown",
        )
        return

    days_uz = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
    chart   = ""
    for w in weekly:
        d        = datetime.strptime(w["date"], "%Y-%m-%d")
        day_name = days_uz[d.weekday()]
        blocks   = int(w["pct"] / 20)
        bar      = "🟩" * blocks + "⬜" * (5 - blocks)
        chart   += f"{day_name} {bar} {w['pct']}%\n"

    streak_line = f"🔥 *Streak: {streak} kun ketma-ket*\n\n" if streak >= 1 else ""

    completed_data = load_habits().get(str(user_id), {}).get("completed", {})
    task_counts    = {
        t["text"]: sum(1 for ids in completed_data.values() if t["id"] in ids)
        for t in tasks
    }
    best      = max(task_counts, key=task_counts.get) if task_counts else None
    best_line = (
        f"🏅 Eng faol: *{best}* ({task_counts[best]} kun)\n\n"
        if best and task_counts[best] > 0 else ""
    )

    await update.message.reply_text(
        f"📊 *Statistika — oxirgi 7 kun*\n\n{streak_line}{best_line}{chart}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )
