# 🤖 365 Reja Telegram Bot

Backend PostgreSQL bilan bog'langan Telegram bot. Ilovadagi vazifalarni ko'rish, belgilash, qo'shish va kunlik yozuv yozish imkonini beradi.

## Buyruqlar

| Buyruq | Tavsif |
|---|---|
| `/start` | Bot haqida ma'lumot |
| `/bugun` | Bugungi vazifalar ro'yxati |
| `/hafta` | Haftalik reja va progress |
| `/stat` | Statistika (progress bar, maqsad) |
| `/kunlik` | Kunlik doimiy vazifalar holati |
| `/qosh yuqori | Kitob o'qish` | Bugunga prioritet bilan vazifa qo'shish |
| `/bajar 2` | Bugungi 2-vazifani bajarildi qilish |
| `/bekor 2` | Belgilangan vazifani qayta ochish |
| `/yoz Ajoyib kun bo'ldi` | Kunlik yozuv yozish |
| `/eslatma` | Bajarilmagan vazifalar eslatmasi |

`/qosh` uchun prioritet qismi ixtiyoriy. Misollar:

```text
/qosh Hisobotni tugatish
/qosh yuqori | Muhim qo'ng'iroq
/qosh past | 10 daqiqa yurish
```

## O'rnatish

1. @BotFather dan bot yarating va tokenni oling
2. `.env` faylini sozlang:

```bash
cp .env.example .env
# BOT_TOKEN, DATABASE_URL, ALLOWED_USER_ID, SYNC_USER_ID ni to'ldiring
```

3. O'rnating va ishga tushiring:

```bash
cd bot
npm install
npm start
```

## Xavfsizlik

`ALLOWED_USER_ID` — faqat sizning Telegram ID ingizga ruxsat beradi. Telegram ID ni bilish uchun @userinfobot ga yozing.

Bot frontendning hozirgi cloud payload formatini ham, eski localStorage snapshot formatini ham o'qiy oladi.
