from telegram import Update
from telegram.ext import ContextTypes

from data.achievements import ALL_ACHIEVEMENTS, grant_achievement
from data.expense import (
    add_expense,
    delete_last_expense,
    get_limit,
    get_month_expenses,
    get_today_expenses,
    get_total,
    get_total_expense_count,
    set_limit,
)
from keyboards import MAIN_MENU


def _limit_bar(month_total: float, limit: float) -> str:
    pct        = (month_total / limit) * 100 if limit else 0
    bar_filled = min(int(pct / 10), 10)
    color      = "🔴" if pct > 80 else "🟢"
    bar        = color * bar_filled + "⬜" * (10 - bar_filled)
    warn       = "\n⚠️ *Limit oshib ketdi!*" if month_total > limit else ""
    return f"\n\n💳 Oylik limit: {bar} {pct:.0f}%\n{month_total:,.0f} / {limit:,.0f} so'm{warn}"


async def spend_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args

    if len(args) < 2:
        await update.message.reply_text(
            "❌ Format: `/spend MIQDOR KATEGORIYA`\n\n"
            "Misol:\n"
            "`/spend 50000 Kafe`\n"
            "`/spend 15000 Transport`\n"
            "`/spend 200000 Oziq-ovqat`\n\n"
            "`/budget` — umumiy hisobot\n"
            "`/limit 1500000` — oylik limit",
            parse_mode="Markdown",
        )
        return

    try:
        amount = float(args[0].replace(",", "").replace(" ", ""))
    except ValueError:
        await update.message.reply_text("❌ Miqdor son bo'lishi kerak! Misol: `50000`", parse_mode="Markdown")
        return

    category = " ".join(args[1:])
    add_expense(user_id, amount, category)

    # Yutuqlar
    total_count = get_total_expense_count(user_id)
    new_ach     = None
    if total_count >= 50 and grant_achievement(user_id, "expense_50"):
        new_ach = ALL_ACHIEVEMENTS["expense_50"]["name"]
    elif total_count >= 10 and grant_achievement(user_id, "expense_10"):
        new_ach = ALL_ACHIEVEMENTS["expense_10"]["name"]

    today_total = get_total(get_today_expenses(user_id))
    month_total = get_total(get_month_expenses(user_id))
    limit       = get_limit(user_id)
    limit_line  = _limit_bar(month_total, limit) if limit > 0 else ""
    ach_text    = f"\n\n🏆 *Yangi yutuq: {new_ach}!*" if new_ach else ""

    await update.message.reply_text(
        f"💰 *Xarajat qo'shildi!*\n\n"
        f"📝 {category}: *{amount:,.0f} so'm*\n"
        f"📅 Bugun jami: {today_total:,.0f} so'm"
        f"{limit_line}{ach_text}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


async def budget_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id     = update.effective_user.id
    today_exps  = get_today_expenses(user_id)
    month_exps  = get_month_expenses(user_id)
    today_total = get_total(today_exps)
    month_total = get_total(month_exps)
    limit       = get_limit(user_id)

    if not month_exps:
        await update.message.reply_text(
            "💰 *Xarajatlar*\n\nHali xarajatlar yo'q.\n\n"
            "`/spend 50000 Kafe` — xarajat qo'shish\n"
            "`/limit 1000000` — oylik limit belgilash",
            parse_mode="Markdown",
        )
        return

    # Bugun
    today_text = "📅 *Bugungi xarajatlar:*\n"
    if today_exps:
        for e in today_exps[-6:]:
            today_text += f"  • {e['category']}: {e['amount']:,.0f} so'm\n"
        today_text += f"  _Jami: {today_total:,.0f} so'm_\n"
    else:
        today_text += "  Bugun xarajat yo'q\n"

    # Kategoriyalar
    categories = {}
    for e in month_exps:
        categories[e["category"]] = categories.get(e["category"], 0) + e["amount"]
    cat_sorted = sorted(categories.items(), key=lambda x: x[1], reverse=True)
    cat_text   = "\n🗂 *Top kategoriyalar:*\n"
    for cat, amt in cat_sorted[:5]:
        pct      = (amt / month_total) * 100 if month_total else 0
        cat_text += f"  {cat}: {amt:,.0f} ({pct:.0f}%)\n"

    limit_text = _limit_bar(month_total, limit) if limit > 0 else ""

    await update.message.reply_text(
        f"💰 *Xarajatlar hisoboti*\n\n"
        f"{today_text}\n"
        f"📊 *Bu oy jami: {month_total:,.0f} so'm*"
        f"{cat_text}"
        f"{limit_text}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


async def limit_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args

    if not args:
        current = get_limit(user_id)
        limit_line = f"{current:,.0f} so'm" if current > 0 else "belgilanmagan"
        await update.message.reply_text(
            f"💳 *Oylik limit*\n\n"
            f"Hozirgi: {limit_line}\n\n"
            f"O'zgartirish: `/limit 1500000`",
            parse_mode="Markdown",
        )
        return

    try:
        limit = float(args[0].replace(",", "").replace(" ", ""))
    except ValueError:
        await update.message.reply_text("❌ Son kiriting! Misol: `/limit 2000000`", parse_mode="Markdown")
        return

    set_limit(user_id, limit)
    await update.message.reply_text(
        f"✅ *Oylik limit: {limit:,.0f} so'm*\n\n"
        f"/budget — xarajatlar hisoboti",
        parse_mode="Markdown",
    )


async def undospend_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    deleted = delete_last_expense(user_id)
    if deleted:
        await update.message.reply_text(
            f"↩️ Oxirgi xarajat bekor qilindi:\n"
            f"*{deleted['category']}: {deleted['amount']:,.0f} so'm*",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text("❌ O'chirish uchun xarajat yo'q.")
