from telegram import KeyboardButton, ReplyKeyboardMarkup

MAIN_MENU = ReplyKeyboardMarkup(
    [
        [KeyboardButton("📅 Bugun"),      KeyboardButton("📌 Kunlik"),     KeyboardButton("📊 Statistika")],
        [KeyboardButton("😊 Kayfiyat"),   KeyboardButton("💰 Xarajat"),    KeyboardButton("🎯 Maqsadlar")],
        [KeyboardButton("📚 Kitoblar"),   KeyboardButton("😴 Uyqu"),       KeyboardButton("💧 Suv")],
        [KeyboardButton("🍅 Fokus"),      KeyboardButton("🏆 Yutuqlar"),   KeyboardButton("🤖 Motivatsiya")],
        [KeyboardButton("🗑 O'chirish"),  KeyboardButton("❓ Yordam")],
    ],
    resize_keyboard=True,
    is_persistent=True,
)
