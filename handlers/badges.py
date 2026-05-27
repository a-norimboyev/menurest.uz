from telegram import Update
from telegram.ext import ContextTypes

from data.achievements import ALL_ACHIEVEMENTS, get_user_achievements
from keyboards import MAIN_MENU


async def badges_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id  = update.effective_user.id
    earned   = get_user_achievements(user_id)
    # _pomodoro_count kabi maxsus kalitlarni chiqarib tashlaymiz
    earned   = {k: v for k, v in earned.items() if not k.startswith("_")}

    if not earned:
        await update.message.reply_text(
            "🏆 *Yutuqlar (Badges)*\n\n"
            "Hali yutuqlar yo'q.\n\n"
            "Qanday qozoniladi:\n"
            "🥉 7 kun ketma-ket odatlar\n"
            "😊 7 kun kayfiyat yozish\n"
            "💰 10 ta xarajat kiritish\n"
            "📖 Birinchi kitob o'qish\n"
            "💧 7 kun suv kuzatish\n"
            "🎯 Birinchi maqsad tugallash\n"
            "🍅 10 ta Pomodoro taymer\n"
            "😴 7 kun uyqu yozish",
            parse_mode="Markdown",
            reply_markup=MAIN_MENU,
        )
        return

    text = f"🏆 *Yutuqlar — {len(earned)} ta qozonildi!*\n\n"

    # Qozonilganlar
    text += "✅ *Qozonilgan:*\n"
    for ach_id, date in sorted(earned.items(), key=lambda x: x[1]):
        ach   = ALL_ACHIEVEMENTS.get(ach_id)
        if ach:
            text += f"  {ach['name']}\n  _{ach['desc']}_ — {date}\n\n"

    # Hali qozonilmaganlar
    not_earned = [a for a in ALL_ACHIEVEMENTS if a not in earned]
    if not_earned:
        text += f"🔒 *Qozonilmagan ({len(not_earned)} ta):*\n"
        for ach_id in not_earned[:6]:
            ach   = ALL_ACHIEVEMENTS[ach_id]
            text += f"  🔒 {ach['name']} — _{ach['desc']}_\n"
        if len(not_earned) > 6:
            text += f"  _...va yana {len(not_earned) - 6} ta_\n"

    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )
