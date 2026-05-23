from telegram import KeyboardButton, ReplyKeyboardMarkup

MAIN_MENU = ReplyKeyboardMarkup(
    [
        [KeyboardButton("📅 Bugun"),     KeyboardButton("📅 Ertaga")],
        [KeyboardButton("🗓 Hafta"),     KeyboardButton("📋 Hammasi")],
        [KeyboardButton("📌 Kunlik"),    KeyboardButton("📊 Statistika")],
        [KeyboardButton("🗑 O'chirish"), KeyboardButton("❓ Yordam")],
    ],
    resize_keyboard=True,
    is_persistent=True,
)
