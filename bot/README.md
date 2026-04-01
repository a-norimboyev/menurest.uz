# 🤖 365 Reja Telegram Bot

Backend PostgreSQL bilan bog'langan Telegram bot. Ilovadagi vazifalarni ko'rish, qo'shish va kunlik yozuv yozish imkonini beradi.

## Buyruqlar

| Buyruq | Tavsif |
|---|---|
| `/start` | Bot haqida ma'lumot |
| `/bugun` | Bugungi vazifalar ro'yxati |
| `/hafta` | Haftalik reja va progress |
| `/stat` | Statistika (progress bar, maqsad) |
| `/qosh Kitob o'qish` | Bugunga vazifa qo'shish |
| `/yoz Ajoyib kun bo'ldi` | Kunlik yozuv yozish |
| `/eslatma` | Bajarilmagan vazifalar eslatmasi |

## O'rnatish

1. @BotFather dan bot yarating va tokenni oling
2. `.env` faylini sozlang:

```bash
cp .env.example .env
# BOT_TOKEN, DATABASE_URL, ALLOWED_USER_ID ni to'ldiring
```

3. O'rnating va ishga tushiring:

```bash
cd bot
npm install
npm start
```

## Xavfsizlik

`ALLOWED_USER_ID` — faqat sizning Telegram ID ingizga ruxsat beradi. Telegram ID ni bilish uchun @userinfobot ga yozing.
