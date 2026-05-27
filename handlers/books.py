from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from data.achievements import ALL_ACHIEVEMENTS, grant_achievement
from data.books import (
    STATUS_LABELS,
    add_book,
    delete_book,
    get_done_count,
    get_user_books,
    update_book_status,
)
from keyboards import MAIN_MENU


def _books_text(user_id: int) -> tuple[str, list]:
    books   = get_user_books(user_id)
    reading = [b for b in books if b["status"] == "reading"]
    queue   = [b for b in books if b["status"] == "queue"]
    done    = [b for b in books if b["status"] == "done"]

    text = "📚 *Kitoblar ro'yxati*\n\n"
    if reading:
        text += "📖 *O'qiyapman:*\n" + "".join(f"  • {b['title']}\n" for b in reading) + "\n"
    if queue:
        text += "⏳ *Navbatda:*\n" + "".join(f"  • {b['title']}\n" for b in queue) + "\n"
    if done:
        text += f"✅ *O'qildi ({len(done)} ta):*\n"
        text += "".join(f"  • {b['title']}\n" for b in done[-4:])
        text += "\n"
    text += f"\n📊 Jami: {len(books)} | ✅ {len(done)} | 📖 {len(reading)} | ⏳ {len(queue)}"

    # Keyboard
    keyboard = []
    for b in books:
        if b["status"] == "queue":
            keyboard.append([
                InlineKeyboardButton(f"⏳ {b['title'][:28]}", callback_data=f"bkinfo_{b['id']}"),
                InlineKeyboardButton("📖 O'qiyman", callback_data=f"bkread_{b['id']}"),
            ])
        elif b["status"] == "reading":
            keyboard.append([
                InlineKeyboardButton(f"📖 {b['title'][:28]}", callback_data=f"bkinfo_{b['id']}"),
                InlineKeyboardButton("✅ Tugat", callback_data=f"bkdone_{b['id']}"),
            ])
    if books:
        keyboard.append([InlineKeyboardButton("🗑 Kitob o'chirish", callback_data="bk_del_menu")])

    return text, keyboard


async def addbook_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    args    = context.args

    if not args:
        await update.message.reply_text(
            "❌ Format: `/addbook Kitob nomi`\n\n"
            "Misol:\n"
            "`/addbook Atomic Habits`\n"
            "`/addbook Doim G'olib`\n"
            "`/addbook 7 odат`",
            parse_mode="Markdown",
        )
        return

    title = " ".join(args)
    add_book(user_id, title)
    books = get_user_books(user_id)

    await update.message.reply_text(
        f"📚 *Kitob qo'shildi!*\n\n"
        f"📖 {title}\n"
        f"📊 Jami: {len(books)} ta kitob\n\n"
        f"/books — ro'yxatni ko'rish",
        parse_mode="Markdown",
    )


async def books_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    books   = get_user_books(user_id)

    if not books:
        await update.message.reply_text(
            "📚 *Kitoblar ro'yxati*\n\nHali kitoblar yo'q.\n\n"
            "`/addbook Atomic Habits` — kitob qo'shish",
            parse_mode="Markdown",
        )
        return

    text, keyboard = _books_text(user_id)
    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None,
    )


async def book_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query   = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    data    = query.data

    if data.startswith("bkread_"):
        book_id = data.replace("bkread_", "")
        book    = update_book_status(user_id, book_id, "reading")
        if book:
            await query.answer(f"📖 O'qilmoqda: {book['title']}", show_alert=False)
        text, keyboard = _books_text(user_id)
        await query.edit_message_text(text, parse_mode="Markdown",
                                      reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None)

    elif data.startswith("bkdone_"):
        book_id = data.replace("bkdone_", "")
        book    = update_book_status(user_id, book_id, "done")
        if book:
            done_count = get_done_count(user_id)
            new_ach    = None
            if done_count >= 10 and grant_achievement(user_id, "book_10"):
                new_ach = ALL_ACHIEVEMENTS["book_10"]["name"]
            elif done_count >= 5 and grant_achievement(user_id, "book_5"):
                new_ach = ALL_ACHIEVEMENTS["book_5"]["name"]
            elif done_count >= 1 and grant_achievement(user_id, "book_1"):
                new_ach = ALL_ACHIEVEMENTS["book_1"]["name"]

            msg = f"✅ Tugallandi: {book['title']}"
            if new_ach:
                msg += f"\n🏆 Yangi yutuq: {new_ach}!"
            await query.answer(msg, show_alert=bool(new_ach))
        text, keyboard = _books_text(user_id)
        await query.edit_message_text(text, parse_mode="Markdown",
                                      reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None)

    elif data == "bk_del_menu":
        books    = get_user_books(user_id)
        keyboard = [
            [InlineKeyboardButton(f"🗑 {b['title'][:35]}", callback_data=f"bkdel_{b['id']}")]
            for b in books
        ]
        keyboard.append([InlineKeyboardButton("❌ Bekor", callback_data="bk_cancel")])
        await query.edit_message_text(
            "Qaysi kitobni o'chirmoqchisiz?",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )

    elif data.startswith("bkdel_"):
        book_id = data.replace("bkdel_", "")
        book    = delete_book(user_id, book_id)
        if book:
            await query.edit_message_text(f"🗑 O'chirildi: *{book['title']}*", parse_mode="Markdown")
        else:
            await query.edit_message_text("❌ Kitob topilmadi.")

    elif data == "bk_cancel":
        await query.edit_message_text("✅ Bekor qilindi.")

    elif data.startswith("bkinfo_"):
        await query.answer("Holati o'zgartirish uchun tugmalarni ishlating.")
