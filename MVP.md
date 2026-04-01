# 365 Reja — MVP

## Loyiha haqida
**365 Reja** — shaxsiy haftalik rejalashtirish ilovasi (PWA).
Har hafta 7 kun uchun vazifalar belgilash, kuzatish va tahlil qilish imkonini beradi.

## Texnologiyalar
- **Frontend:** React 18 + Vite 5, React Router (HashRouter)
- **Backend:** Express.js + PostgreSQL (cloud sync uchun)
- **Saqlash:** localStorage (asosiy), IndexedDB (media), Supabase/PostgreSQL (cloud)
- **PWA:** Service Worker, manifest.webmanifest

## MVP funksiyalari

### 1. Haftalik reja (Asosiy)
- 7 kunlik vazifa jadvali (Dushanba–Yakshanba)
- Har bir kunga 10 tagacha vazifa qo'shish
- Checkbox bilan bajarilganini belgilash
- Vazifa prioriteti (Past / O'rta / Yuqori)
- Hafta almashtirish (Oldingi / Keyingi)

### 2. Oylik vazifalar
- Har oyda takrorlanadigan vazifalar ro'yxati
- Bajarilgan kunlar soni ko'rsatiladi

### 3. Bugun kuni (Kunlik yozuv)
- Har kun uchun matnli yozuv
- Rasm va video yuklash (IndexedDB'da saqlanadi)
- Yozuvlar tarixi + qidiruv
- Streak (ketma-ket kunlar) hisobi

### 4. Statistika
- Haftalik bajarilish foizi
- Kunlik bar chart (grafik)
- Trend chizig'i (haftalik dinamika)
- Maqsad belgilash + progress bar
- Goal status (Yaxshi / Ogohlantirish)

### 5. Tarix
- Barcha haftalar tarixi
- Har hafta uchun bajarilish ko'rsatkichi

### 6. Autentifikatsiya
- Login/parol bilan kirish
- SessionStorage orqali sessiya boshqaruvi

### 7. Cloud sync
- Qurilmalar orasida ma'lumot sinxronlash
- Supabase REST yoki Express+PostgreSQL backend

### 8. Mavzular (Temalar)
- 5 ta tema: Premium, Minimal, Forest, Rose, Sky
- Har biri o'ziga xos ranglar va gradient

### 9. PWA
- Offline ishlash (Service Worker)
- Ilovani o'rnatish imkoniyati

## Arxitektura

```
365 day/
├── index.html            # Kirish nuqtasi + Google Fonts
├── src/
│   ├── main.jsx          # React mount
│   ├── App.jsx           # Barcha sahifalar + logika
│   ├── App.css           # Yagona CSS fayl (~1500 qator)
│   ├── components/
│   │   ├── Header.jsx    # Sarlavha, tema, hafta navigatsiya
│   │   ├── DayCards.jsx  # Kun kartalari + vazifa qatorlari
│   │   ├── StatsCard.jsx # Statistika kartalari
│   │   └── MonthlyCard.jsx # Oylik vazifalar
│   └── lib/
│       └── mediaStore.js # IndexedDB media helper
├── backend/
│   └── server.js         # Express + pg sync API
├── public/
│   ├── sw.js             # Service Worker
│   └── manifest.webmanifest
└── package.json
```

## Ma'lumot saqlash
| Tur | Texnologiya | Maqsad |
|-----|------------|--------|
| Vazifalar | localStorage | Asosiy saqlash |
| Media (rasm/video) | IndexedDB | Kunlik yozuv rasmlari |
| Cloud sync | PostgreSQL | Qurilmalar sinxroni |
| Sessiya | sessionStorage | Login holati |

## Sync identifikator
`azizjon-365-sync` — barcha qurilmalar uchun yagona profil ID.

## Status: ✅ MVP TAYYOR
