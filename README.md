# MENUREST.UZ (V2.0) — Multi-Restaurant QR Menu & Dining SaaS Platform

Restoranlar uchun QR menyu, mehmon buyurtmalari, ofitsiant, oshxona (KDS), kassa (POS), boshqaruv paneli (Boss/Manager) va platforma administratsiyasini (Super Admin) birlashtirgan to'liq funktsional veb platforma.

---

## 1. Asosiy Xususiyatlar va Imkoniyatlar

- **Mehmon Menyusi va Sessiyasi (GUEST):**
  - Hech qanday mobil ilova o'rnatmasdan brauzer orqali foydalanish.
  - Ommaviy statik QR kod orqali menyuni ko'rish.
  - Stolga xavfsiz ulanish: 4-xonali kirish PIN kodi va SHA-256 xeshli sessiya.
  - Taom variantlari (yarim/to'liq porsiya) va qo'shimchalar (qazi, tuxum modifikatorlari).
  - Server-authoritative narx snapshotlari va scoped SHA-256 Idempotency (double-click / replay himoyasi).
- **Ofitsiant Paneli (WAITER):**
  - Yangi chaqiruvlar, tayyor taomlar va tasdiq kutayotgan buyurtmalar monitoringi.
  - Conditional update concurrency (bir vaqtning o'zida ikkita ofitsiant bir chaqiruvni ololmaydi).
  - Tayyor bo'lmagan taomni "Yetkazildi" deb belgilashdan server himoyasi.
- **Oshxona va Bar (KITCHEN / KDS):**
  - Stansiyalar izolyatsiyasi: Issiq oshxona oshpazi faqat ovqatlarni, Barman faqat ichimliklarni ko'radi.
  - Taomlar darajasidagi holatlar mashinasi (`ACCEPTED -> PREPARING -> READY`).
  - Masalliq sarflangan taomlar uchun spisanie/menejer tasdig'i himoyasi.
- **Kassa, Hisob va Smena (CASHIER):**
  - Aniq minor unit ($1\text{ UZS} = 100\text{ tiyin}$) pul hisob-kitobi. Floating point yo'q.
  - `SELECT FOR UPDATE` qator darajasidagi qulflar bilan parallel to'lov poygasini to'sish (overpayment yo'q).
  - Qaytim hisobi, to'lovni bekor qilish (reversal), qisman to'lovlar va pul qaytarish (refund).
  - Pre-check hisob varaqasini chop etish.
  - Stol hayot sikli: `FREE -> OCCUPIED -> DIRTY -> FREE`.
- **Boss va Manager Panellari:**
  - Haqiqiy PostgreSQL server agregatsiyalari (soxta foyda raqamlari yo'q).
  - Asia/Tashkent (UTC+5) kun chegarasi bo'yicha hisobotlar.
  - Xodimlar boshqaruvi va huquqlar eskalatsiyasini to'sish (`PRIVILEGE_ESCALATION_FORBIDDEN`).
  - Maxfiylik sanitizatsiyasi va CSV Formula Injection himoyasi bo'lgan Audit jurnali.
- **Super Admin va Platforma Boshqaruvi:**
  - Multi-tenant restoranlar ro'yxati, yangi restoran va Boss akkauntlarini ochish.
  - Restoran xizmatini to'xtatish (`SUSPENDED`): yangi tashrif/buyurtma bloklanadi, mavjudlari xavfsiz yakunlanadi.
  - Vaqtinchalik Yordam Kirishi (Support Mode): sabab, muddat va read-only rejimida auditli kirish.
- **Jonli Yangilanish (Realtime SSE):**
  - Tranzaksion Outbox Pattern (Crash Recovery kafolati bilan).
  - Auditoriya izolyatsiyasi (Oshxona moliyadan to'silgan, mehmonlar faqat o'z stolini ko'radi).

---

## 2. Loyiha Tuzilishi (Monorepo Workspace)

```
menurest.uz-main/
├── apps/
│   ├── api/          # Express + TypeScript + Prisma Backend API (Port: 4000)
│   └── web/          # React + Vite + TailwindCSS Frontend (Port: 3000)
├── packages/
│   └── shared/       # Umumiy turlar, tiyin pul utilitalari va ruxsatlar (RBAC)
├── docs/             # Loyiha hujjatlari va texnik spetsifikatsiyalar
│   ├── product-spec.md   # Asosiy talablar va 14 qat'iy biznes qoidalari
│   ├── architecture.md   # Arxitektura va 13 ta domen modeli
│   ├── permissions.md    # RBAC ruxsatlar matritsasi
│   ├── api-contract.md   # API shartnomasi va holatlar kodi
│   ├── project-state.md  # Loyiha bosqichlari holati
│   ├── qa-report.md      # To'liq avtomatlashtirilgan QA hisoboti (76 ta test)
│   ├── deployment.md     # Staging va Production joylashtirish qo'llanmasi
│   ├── operations.md     # Zaxiralash, monitoring va avariya tiklash yo'riqnomasi
│   └── user-guide-uz.md  # 7 ta rol uchun to'liq o'zbekcha foydalanuvchi qo'llanmasi
├── docker-compose.yml# PostgreSQL lokal serveri
├── package.json      # Root workspace skriptlari
└── .env.example      # Namuna muhit o'zgaruvchilari
```

---

## 3. Ishga Tushirish Bo'yicha Ko'rsatmalar

### 3.1. Dastlabki Talablar
- Node.js v20+ / v22+ LTS
- PostgreSQL 15+ yoki Docker

### 3.2. Bog'liqliklarni O'rnatish
```bash
npm install
```

### 3.3. Ma'lumotlar Bazasini Sozlash va Ishga Tushirish

#### A) Dasturlash va Sinov Muhitida (Development / Testing):
```bash
# Docker orqali PostgreSQL ni yoqish (agar lokal o'rnatilmagan bo'lsa)
docker compose up -d

# .env faylini nusxalash va sozlash
cp .env.example .env

# Prisma migratsiyalarini qo'llash
npm run migrate:deploy

# Demo ma'lumotlarni bazaga yuklash (2 ta restoran, barcha rollar bilan)
npm run seed
```

#### B) Staging va Ishlab Chiqarish Muhitida (Staging / Production):
> [!CAUTION]
> Production muhitida hech qachon `npm run seed` ishlatilmaydi (`NODE_ENV=production` holatida seed server tomonidan bloklangan). Tizimga birinchi va yagona Super Adminni xavfsiz bootstrap vositasi orqali qo'shiladi:

```bash
# Prisma migratsiyalarini oldinga tatbiq etish
npm run migrate:deploy

# Bir martalik xavfsiz Super Admin yaratish (kamida 10 ta belgili kuchli parol bilan):
npm run bootstrap:superadmin -- --phone="+998901234567" --password="SuperSecurePassword123!" --name="Platform Administrator"
```

### 3.4. Dasturni Ishga Tushirish
```bash
# Backend API serverini ishga tushirish (http://localhost:4000)
npm run dev

# Frontend ilovasini ishga tushirish (http://localhost:3000)
npm run dev:web
```

---

## 4. Testlash va Sifat Nazorati (QA)

Barcha tekshiruvlar haqiqiy PostgreSQL ma'lumotlar bazasi bilan avtomatlashtirilgan:

```bash
# Barcha 78 ta integratsiya, xavfsizlik, concurrency va invariant testlari:
npm run test

# 28 ta majburiy QA ssenariylari va multi-process concurrency poyga testlari:
npm run test:qa

# Server yuklama va kechikish (latency) bo'yicha performance smoke testi:
npm run perf:smoke

# Barcha paketlar bo'yicha TypeScript tip tekshiruvi:
npm run typecheck

# Ishlab chiqarish build tekshiruvi:
npm run build
```

---

## 5. Standart Demo Akkauntlar (Faqat Development/Testing uchun)

| Rol | Telefon | Parol | Ruxsat Doirasi |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `+998901111111` | `Demo12345!` | Barcha platforma, restoranlar va monitoring |
| **Boss (Rayhon)** | `+998902222222` | `Demo12345!` | To'liq restoran boshqaruvi va hisobotlar |
| **Manager (Rayhon)** | `+998903333333` | `Demo12345!` | Zal, stollar, xodimlar va bekor qilishlar |
| **Cashier (Rayhon)** | `+998904444444` | `Demo12345!` | Kassa, to'lovlar, pre-check va smena |
| **Waiter (Rayhon)** | `+998905555555` | `Demo12345!` | Stollar, chaqiruvlar, buyurtma va yetkazish |
| **Oshpaz (Kitchen)** | `+998906666666` | `Demo12345!` | Issiq oshxona stansiyasi taomlari |
| **Boss (G'ijduvon)** | `+998907777777` | `Demo12345!` | 2-restoran (Multi-tenant izolyatsiyasi tekshiruvi) |

---

## 6. Muallif va Litsenziya

- **Loyiha:** Menurest.uz V2.0
- **Litsenziya:** ISC
