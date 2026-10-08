# MENUREST.UZ: Chuqur Audit, Concurrency, API/Baza Simulyatsiyasi va Dizayn Dalillari (V5)

Ushbu hujjat loyihadagi backend himoyasi, relyatsion tranzaksiyalar, migratsiya holati, 13 bosqichli xizmat sikli (API va DB simulyatsiyasi) hamda mobil/desktop ko'rinishining xolis, ochiq va faktlarga asoslangan yakuniy hisobotidir.

---

## 1. MAVJUD FAYLLAR VA HUJJATLAR RO'YXATI

| Fayl | Joylashuvi | Vazifasi |
|---|---|---|
| **Audit Hisoboti** | [docs/audit-report.md](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/docs/audit-report.md) | Texnik tahlil, cheklovlar va QA dalillari |
| **Prisma Schema** | [schema.prisma](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/schema.prisma) | Relyatsion ma'lumotlar bazasi modellari |
| **Baseline Migratsiya** | [prisma/migrations/0_init/migration.sql](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/prisma/migrations/0_init/migration.sql) | Yangi bazani ko'tarish uchun SQL DDL skripti |
| **Buyurtma & Kassa Controller** | [src/controllers/order.controller.js](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/src/controllers/order.controller.js) | Idempotency, kassa to'lovi, chaqiruvlar, tashrif yopish |
| **Ofitsiant Controller** | [src/controllers/waiter.controller.js](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/src/controllers/waiter.controller.js) | Chaqiruvlarni tasdiqlash, stolni tozalash (`cleanTable`) |
| **Tashrif Controller** | [src/controllers/visit.controller.js](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/src/controllers/visit.controller.js) | Tashrif ochish, ulanish (JWT) va yopish |
| **Mijoz Auth Middleware** | [src/middlewares/clientAuth.middleware.js](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/src/middlewares/clientAuth.middleware.js) | JWT tekshiruvi va DB dagi `ACTIVE` holat nazorati |
| **Master QA Test Suite (20 test)** | [tests/deep_qa_verification.test.js](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/tests/deep_qa_verification.test.js) | Idempotency, kassa, poygalar, chaqiruvlar va JWT |
| **DB Concurrency Test** | [tests/db_optimistic_locking.test.js](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/tests/db_optimistic_locking.test.js) | Node.js mutexsiz DB darajasidagi parallel to'lov testi |
| **Narx O'zgarishi Testi** | [tests/idempotency_price_change.test.js](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/tests/idempotency_price_change.test.js) | Menyu narxi o'zgarganda dastlabki so'rovning xavfsiz retry testi |
| **13-Bosqichli Xizmat Sikli Testi** | [tests/full_e2e_session_simulation.test.js](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/tests/full_e2e_session_simulation.test.js) | Stol ochishdan kassa, tozalash va yangi tashrifgacha API/DB simulyatsiyasi |
| **Test Yo'riqnomasi & Loglar** | [tests/README_TESTS.md](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/tests/README_TESTS.md) | Testlarni ishga tushirish yo'riqnomasi va to'liq terminal loglari |
| **Namuna Muhit Fayli** | [.env.example](file:///c:/Users/user/OneDrive/Desktop/menurest.uz-main/.env.example) | Maxfiy kalitsiz xavfsiz o'zgaruvchilar andozasi |

---

## 2. BESHTA ANIQ TEXNIK SAVOL BO'YICHA ANIQ DALILLAR

### 1. `db push --accept-data-loss` qaysi bazada ishlatilgan?
- **Qaysi baza:** Ushbu buyruq faqat mahalliy ishlab chiqish muhitidagi SQLite faylida (`dev.db`) yangi ustunlarni (`activeCallKey`, `paidAmount`, `version`) kiritish uchun ishlatilgan.
- **Zaxira (Backup):** Buyruqni bajarishdan oldin ma'lumotlar bazasining zaxira nusxasi (SQL dump / backup fayl) olinmagan.
- **Yozuvlar va moliyaviy summalar solishtirilganmi:** Oldingi va keyingi yozuvlar soni hamda moliyaviy summalar avtomatlashtirilgan tarzda solishtirilmagan.
- **Xulosa va dalil:** "Mavjud ma'lumotlar saqlangani tekshirildi" deb da'vo qilib bo'lmaydi. Ishlab chiqarish (Production) muhitida `db push --accept-data-loss` aslo ishlatilmasligi kerak; real bazada faqat zaxira olingandan so'ng `prisma migrate deploy` qo'llanishi shart.

### 2. 13 bosqichli test: Brauzer avtomatizatsiyasimi yoki API/Baza simulyatsiyasimi?
- **Haqiqiy holat:** `tests/full_e2e_session_simulation.test.js` testi **Node.js HTTP API va Prisma ma'lumotlar bazasi integratsiyalashgan simulyatsiyasi** hisoblanadi.
- Playwright, Cypress yoki Puppeteer orqali brauzer DOM hodisalari (tugma bosish, form to'ldirish, sahifadagi real vizual o'zgarishlar) to'liq avtomatlashtirilmagan.
- Shu sababli, "brauzerdagi jarayon to'liq isbotlandi" degan mubolag'ali jumla bekor qilinadi. To'g'ri ifoda: **"API va ma'lumotlar bazasi darajasidagi to'liq 13 bosqichli restoran xizmat sikli simulyatsiya qilindi va isbotlandi"**. Brauzer interfeysi esa alohida olingan screenshotlar orqali tekshirilgan.

### 3. Qo'shimcha buyurtmaning yetkazilishi tashrif yopilishidan oldin tekshirilganmi?
- **Dastlabki kamchilik:** Dastlabki test skriptida 7-qadamda qo'shimcha buyurtma (order2) yaratilgandan so'ng, uning oshxonada tayyorlanishi va ofitsiant tomonidan yetkazilishi (`DELIVERED`) tekshirilmasdan to'g'ridan-to'g'ri kassa to'loviga va tashrifni yopishga o'tilgan edi.
- **Backend mantiqi:** `src/controllers/order.controller.js` dagi `adminCloseVisit` funksiyasi tashrifni yopishda faqat to'lov balansini (`remaining === 0`) tekshiradi, lekin barcha buyurtmalar `DELIVERED` yoki `CANCELLED` bo'lganini qat'iy tekshirmaydi.
- **Yangilangan test:** Testga `Qadam 7b` kiritildi: qo'shimcha buyurtma oshxona orqali `READY` qilinadi va ofitsiant tomonidan `DELIVERED` qilingani tekshiriladi. Tashrif faqat barcha buyurtmalar yetkazilgandan va to'liq to'langandan so'ng yopiladi.

### 4. Chaqiruvning `activeCallKey` qiymati qabul qilingandami yoki bajarilgan/bekor qilingan holatdami bo'shatiladi?
- **Kod tahlili:**
  - `src/controllers/order.controller.js` ichida `adminUpdateStatus` da: faqat `DELIVERED` yoki `CANCELLED` statuslarida `activeCallKey = null` qilinadi.
  - `adminAcknowledgeCall` va `waiter.controller.js` dagi `acknowledgeCall` funksiyalarida: ofitsiant chaqiruvni "qabul qildim" (acknowledge) deb tasdiqlaganida, buyurtma statusi to'g'ridan-to'g'ri `DELIVERED` ga o'tkaziladi va shu paytning o'zida `activeCallKey = null` qilinadi.
- **Xulosa:** Chaqiruv buyurtmalari (`CALL_WAITER`, `BILL_REQUEST`) oraliq tayyorlanish bosqichiga ega bo'lmagani sababli, ofitsiant uni tasdiqlashi bilanoq u **bajarilgan (`DELIVERED`) deb hisoblanadi va shu zahoti slot bo'shatiladi**. Agar ofitsiant stolga borishidan oldin slot bo'shatilishi xohlanmasa, kelgusida oraliq status (`IN_PROGRESS`) joriy etilib, slot faqat ofitsiant stolga yetib borganida bo'shatilishi lozim.

### 5. Hali Bajarilmagan Talablar Ro'yxati (Unimplemented Requirements)
Quyidagi funksional talablar hali **bajarilmagan** va kelgusi arxitektura bosqichi uchun vazifa sifatida qoladi:
1. **Taom Variantlari va Qo'shimchalar (Variants & Addons):** `schema.prisma` da va menyu modellarida `Variant` hamda `Addon` relyatsion jadvallari mavjud emas. Buyurtma faqat asosiy taom, narx va izoh darajasida saqlanadi.
2. **Brauzer Darajasidagi To'liq E2E Avtomatizatsiyasi:** Mijoz savatchasidan tortib kassagacha bo'lgan jarayon Playwright/Cypress yordamida brauzer darajasida to'liq avtomatlashtirilmagan.
3. **Multi-Server Concurrency (PostgreSQL):** SQLite optimistik blokirovkasi bitta instansiyada ishlaydi. Ko'p jarayonli muhit uchun PostgreSQL qator blokirovkasi (`SELECT FOR UPDATE`) hali o'rnatilmagan.
4. **Tashrifni yopishda yetkazilmagan taomlarni majburiy tekshirish:** `adminCloseVisit` da to'lanmagan qoldiq tekshiriladi, ammo yetkazilmagan (`NEW`, `PREPARING`) buyurtmalar bo'lsa ogohlantirish berish backendda qat'iy bloklanmagan.

---

## 3. QA VA ARXITEKTURA TESTLARI NATIJALARI

Barcha testlar to'liq va muvaffaqiyatli yakunlandi:

| Test Fayli | Qamrovi | Natija |
|---|---|---|
| `tests/deep_qa_verification.test.js` | Idempotency (409 konflikt), 2 ta kassir poygasi, atomik chaqiruv, yopiq tashrif JWT bloki | **20 PASSED, 0 FAILED** |
| `tests/db_optimistic_locking.test.js` | Node.js mutexsiz DB darajasidagi optimistik lock (`version`) isboti | **PASS (1 muvaffaqiyatli, 1 rad etildi)** |
| `tests/idempotency_price_change.test.js` | Menyu narxi admin tomonidan oshirilganda dastlabki so'rovning xavfsiz qaytarilishi | **PASS** |
| `tests/full_e2e_session_simulation.test.js` | 13 bosqichli to'liq xizmat sikli (stol ochish, buyurtma, 7b qo'shimcha yetkazish, kassa, tozalash, yangi tashrif) | **13/13 BOSQICH PASSED** |

---

## 4. MOBIL VA DESKTOP EKRANLARINI TEKSHIRISH (HEADLESS SCREENSHOTLAR)

1. **Mobil (390 px) — `tests/screenshots/mobile_menu.png` & `mobile_waiter.png`**:
   - Mijoz menyusi va "Stolga ulanish" modali 390px ekran o'lchamiga to'liq sig'adi, matnlar va tugmalar kesilmagan, gorizontal scroll yo'q.
   - Ofitsiant paneli ixcham, stollar holati piktogrammalar bilan ko'rsatilgan.
2. **Desktop (1280 px) — `tests/screenshots/desktop_admin.png`**:
   - Stol kartalarida "TO'LANGAN" (yashil) va "QOLDIQ" (to'q sariq) indikatorlari aniq ranglarda chiqadi.
   - To'langan stolda "Tashrifni yakunlash (Bo'shatish)" tugmasi ko'rinadi.
3. **Desktop (1280 px) — `tests/screenshots/desktop_kds.png`**:
   - Oshxona KDS paneli buyurtmalarni blok shaklida ko'rsatadi, statuslar bitta klik bilan yangilanadi.

---

## 5. XULOSA: 1 TA RESTORANDA NAZORAT OSTIDAGI PILOTGA TAYYORLIK

- **Backend va Ma'lumotlar Butunligi:** Idempotency xavfsizligi, parallel to'lovlarda ortiqcha pul olinmasligi va tashrif sessiyalari nazorati isbotlangan.
- **Joriy Cheklovlar:** SQLite va dev muhiti, variantlar/addonlarning yo'qligi, hamda testlarning brauzer emas balki API/DB simulyatsiyasi ekanligi hisobga olingan holda:
- **Xulosa:** Tizim marketing da'volarisiz, bitta restoranda xodimlar nazorati ostida **Controlled Pilot (Nazoratli Sinov)** bosqichini o'tkazish uchun yaroqlidir.
