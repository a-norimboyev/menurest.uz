# QR Menyu - Ko'p Restoranli SaaS Platformasi

Restoran, kafe, oshxona va fast-food shoxobchalari uchun mo'ljallangan to'liq funksional elektron **QR Menyu platformasi**.

---

## 🌟 Asosiy Imkoniyatlar

### 1. 📱 Mijozlar uchun Mobil Menyu (`/r/:slug?table=X`)
- **Stol raqamini aniqlash:** Stol ustidagi QR kod skaner qilinganda stol avtomatik aniqlanadi (`?table=1`).
- **Kategoriyalar va Taomlar:** Har bir taomning rasmi, narxi, tavsifi, vazni va mashhurlik nishoni.
- **Qidiruv:** Jonli qidiruv va kategoriyalar bo'yicha filter.
- **Savatcha (Cart):** Taomlarni qo'shish, miqdorini oshirish/kamaytirish, xizmat haqi (%) hisob-kitobi va umumiy to'lov.
- **Buyurtma berish:** Stol raqami bilan buyurtma to'g'ridan-to'g'ri restoran oshxonasiga yuboriladi.
- **Tezkor xizmatlar:** "Ofitsiantni chaqirish" va "Hisobni so'rash" tugmalari.
- **Ko'p tillilik:** O'zbekcha (UZ), Ruscha (RU), Inglizcha (EN).

### 2. 👨‍🍳 Restoran Admin Kabineti (`/admin`)
- **Parol bilan kirish:** Har bir restoran o'z slugi va paroli bilan kiradi (Standart: `rayhon` / `123` yoki `max-burger` / `123`).
- **Jonli Buyurtmalar:** Stol raqamlari bilan tushayotgan yangi buyurtmalar, statuslarini o'zgartirish (`Yangi` ➔ `Tayyorlanmoqda` ➔ `Tayyor` ➔ `Yetkazildi`). Har 5 soniyada avtomatik yangilanadi.
- **Taomlar boshqaruvi (CRUD):** Yangi taom qo'shish (kompyuterdan rasm yuklash yoki URL bilan), tahrirlash, o'chirish.
- **Kategoriyalar boshqaruvi:** Yangi kategoriya ochish va ikonkalarni sozlash.
- **QR Kod Generator & Chop etish (Print):** Stollar sonini kiritib, har bir stol uchun restoranning o'z brendi tushirilgan chiroyli stikerlarni chiqarish va 1 tugma bilan printerdan chop etish (`Ctrl + P`).
- **Sozlamalar:** Restoran nomi, telefoni, manzili, xizmat haqi (%) va valyutani tahrirlash.

### 3. 👑 Super Admin Paneli (`/super-admin`)
- **Yangi restoran ochish:** Platformaga yangi restoran, kafe yoki oshxona qo'shish.
- **Umumiy statistika:** Jami restoranlar, jami taomlar va barcha buyurtmalar statistikasi.
- **Boshqaruv:** Restoranlarni tahrirlash yoki o'chirish.

---

## 🚀 Loyihani Ishga Tushirish

### 1. Kutubxonalarni o'rnatish
Terminalda (loyihaning asosiy papkasida):
```bash
npm install
```

### 2. Serverni yoqish
```bash
npm start
```
yoki:
```bash
node server.js
```

Server ishga tushgach, brauzerda quyidagi manzillarni ochishingiz mumkin:
- **Asosiy sahifa:** [http://localhost:3000](http://localhost:3000)
- **Mijoz menyusi namunasi:** [http://localhost:3000/r/rayhon?table=1](http://localhost:3000/r/rayhon?table=1)
- **Restoran Admin paneli:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Super Admin paneli:** [http://localhost:3000/super-admin](http://localhost:3000/super-admin)

---

## 🔑 Dastlabki Kirish Ma'lumotlari

Tizimda boshlang'ich 2 ta namunaviy restoran tayyorlab qo'yilgan:

1. **Rayhon Milliy Taomlar**
   - Identifikator (slug): `rayhon`
   - Parol: `123`
   - Menyu havolasi: `http://localhost:3000/r/rayhon?table=1`

2. **Max Burger & Fast Food**
   - Identifikator (slug): `max-burger`
   - Parol: `123`
   - Menyu havolasi: `http://localhost:3000/r/max-burger?table=1`

---

## 📁 Fayllar Tuzilmasi

```
QR-menyu-main/
├── package.json              # Kutubxonalar va loyiha sozlamalari
├── server.js                 # Express server va REST API
├── database.js               # Ma'lumotlar bazasi moduli (JSON fayllar)
├── seed.js                   # Boshlang'ich restoranlar va taomlar
├── data/                     # Ma'lumotlar saqlanadigan joy
│   ├── restaurants.json
│   ├── categories.json
│   ├── menu_items.json
│   └── orders.json
├── public/                   # Frontend
│   ├── index.html            # Asosiy sayt (barcha restoranlar katalogi)
│   ├── r/                    # Mijozlar menyusi
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── app.js
│   │   └── i18n.js
│   ├── admin/                # Restoran admin kabineti
│   │   ├── index.html
│   │   ├── admin.css
│   │   └── admin.js
│   ├── super-admin/          # Super Admin paneli
│   │   ├── index.html
│   │   ├── super.css
│   │   └── super.js
│   └── uploads/              # Yuklangan taom rasmlari
└── README.md                 # Qo'llanma
```
