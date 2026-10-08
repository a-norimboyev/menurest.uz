# MENUREST.UZ: Testlarni Bajarish Yo'riqnomasi va Haqiqiy Natija Loglari

Ushbu hujjat MENUREST.UZ tizimining arxitektura va xavfsizlik testlarini ishga tushirish bo'yicha to'liq yo'riqnoma hisoblanadi.

---

## 1. Tizim Talablari va Ishga Tushirish Tartibi

1. **Muhit:** Node.js v18+ yoki v20+ (tavsiya etiladi), SQLite (lokal dev).
2. **Kutubxonalarni o'rnatish:**
   ```bash
   npm install
   ```
3. **Prisma Client generatsiyasi:**
   ```bash
   npx prisma generate
   ```
4. **Asosiy serverni ishga tushirish:**
   ```bash
   npm run start
   ```
   *Eslatma:* Integratsiyalashgan HTTP testlar ishlashi uchun server `http://127.0.0.1:3000` portida ishlab turgan bo'lishi kerak.

---

## 2. Testlarni Bajarish Buyruqlari

### A. Asosiy QA Test To'plami (20 ta Test)
Ushbu test idempotency xavfsizligi (takroriy so'rov, turli taomli so'rovlar uchun 409 xatosi), kassa parallel to'lovlari, ofitsiant atomik chaqiruvlari, qisman to'lovlar va yopiq tashrif JWT cheklovlarini qamrab oladi.
```bash
node tests/deep_qa_verification.test.js
```

### B. Database Darajasidagi Optimistik Concurrency Testi (Mutexsiz)
Ushbu test Node.js mutexidan foydalanmasdan, to'g'ridan-to'g'ri Prisma interaktiv tranzaksiyalari va `Bill.version` orqali ikkita kassir parallel ravishda to'lov yuborganida ikkinchi to'lov rad etilishini va bazada jami faqat bitta to'lov yozilishini isbotlaydi.
```bash
node tests/db_optimistic_locking.test.js
```

### C. Menyu Narxi O'zgarganda Idempotency Xavfsizligi Testi
Ushbu test mijoz buyurtma berganidan so'ng admin menyudagi narxni oshirsa yoki o'zgartirsa, tarmoq uzilishi tufayli qayta yuborilgan dastlabki so'rov (retry) xato bermasdan avvalgi buyurtmani qaytarishini tasdiqlaydi.
```bash
node tests/idempotency_price_change.test.js
```

### D. 13 Bosqichli To'liq Xizmat Sikli Simulyatsiyasi (API / DB)
Ushbu test stol ochilishidan tortib savatcha yig'ish, kod bilan ulanish, oshxona (PREPARING, READY), yetkazish (DELIVERED), ofitsiant chaqiruvlari, qo'shimcha buyurtma yetkazilishi, kassa hisob-kitobi, qisman va to'liq to'lov, xodim tomonidan tashrifni yopish, DIRTY holati, tozalash va yangi toza tashrif ochilishini to'liq tekshiradi.
```bash
node tests/full_e2e_session_simulation.test.js
```

---

## 3. Haqiqiy Test Natijalari (Terminal Loglari)

```text
====================================================
MENUREST.UZ DEEP QA TEST SUITE STARTING
====================================================

--- 1. IDEMPOTENCY CONTENT & CONFLICT TESTS ---
[PASS] 1a. Order 1 created successfully with Key1
[PASS] 1b. Replay identical content with same key returns original order
[PASS] 1c. Same key + same subtotal + DIFFERENT dish returns 409 Conflict
[PASS] 1d. Parallel conflicting orders with same key: exactly 1 succeeds, 1 returns 409 Conflict
[PASS] 1e. Database holds exactly 1 order for parallelKey

--- 2. CONCURRENT CASHIER PAYMENTS (DIFFERENT KEYS) ---
[PASS] 2a. Parallel payments of full balance: one succeeds (200), one rejects with 409 Conflict
[PASS] 2b. Rejected cashier receives updated remaining = 0 so'm
[PASS] 2c. Database contains exactly 1 payment totaling 100,000 so'm (no double payment!)

--- 3. ATOMIC OPEN WAITER CALL TESTS ---
[PASS] 3a. Both concurrent call requests respond with 200
[PASS] 3b. Exactly 1 active CALL_WAITER order exists in DB despite concurrent requests
[PASS] 3c. BILL_REQUEST can be placed alongside CALL_WAITER without interference

--- 4. VISIT CLOSING & PREPAID EXTRA ORDERS FLOW ---
[PASS] 4a. Initial 100,000 order prepaid
[PASS] 4b. Prepaid visit remains ACTIVE while customer is dining
[PASS] 4c. Extra order updates debt: Gross=130k, Paid=100k, Remaining=30k, isPaid=false
[PASS] 4d. Closing visit with unpaid remaining debt rejected with 400
[PASS] 4e. Cashier pays 30k debt with 50k cash: actualPayment=30k, changeAmount=20k
[PASS] 4f. Staff explicitly closes fully paid visit
[PASS] 4g. Visit is CLOSED and Table status is DIRTY

--- 5. JWT VALIDATION AGAINST CLOSED VISITS ---
[PASS] 5a. Request with signed JWT for a CLOSED visit immediately rejected with 403
[PASS] 5b. Request with forged/tampered JWT rejected with 403

====================================================
SUMMARY: 20 PASSED, 0 FAILED
====================================================

--- TESTING DATABASE-LEVEL OPTIMISTIC CONCURRENCY WITHOUT NODE.JS MUTEX ---
Created Bill 49841488-f6cf-4eab-84b1-a3f4cbf85c7b with initial version = 0
Result 1: rejected Hisob allaqachon to'liq to'langan
Result 2: fulfilled Kassir-B

DB Check:
- Final Bill Version in DB: 1
- Final Bill Status in DB: PAID
- Total Payments Created in DB: 1
- Total Paid Amount: 100000 so'm

[PASS] Database-level optimistic locking prevented concurrent duplicate payments without mutex!

--- TESTING IDEMPOTENCY WHEN MENU PRICE CHANGES LATER ---
1. Initial Order Created: 200 55121576-5d12-4be1-873b-ac0c7c67e35a Total: 40000
2. Admin updated dish menu price from 40,000 to 80,000 so'm in DB.
3. Client Retry Result: 200 55121576-5d12-4be1-873b-ac0c7c67e35a Takroriy so'rov, buyurtma avval qabul qilingan
[PASS] Subsequent menu price change did NOT interfere with idempotency retry of previous order!

================================================================
TO'LIQ END-TO-END SESSIYA SINOVI: 13 TA QADAM
================================================================

Qadam 1: Xodim stol #7 uchun tashrif ochmoqda...
[PASS] 1. Tashrif ochildi! ID: 5ea3512f-9a53-4281-b0dc-9417ca0701a8, Kod (joinToken): 880261
Qadam 2: Mijoz kod kiritmasdan savatcha yig'moqda...
[PASS] 2. Savatchada 1 ta taom (76000 so'm). Kod kiritilishi talab qilinmadi.
Qadam 3: Mijoz stol kodini kiritib ulanmoqda...
[PASS] 3a. Mijoz tasdiqlandi va JWT oldi. Endi savatchadagi buyurtmani yubormoqda...
[PASS] 3b. Buyurtma qabul qilindi! Order ID: f3b48c2c-efa4-44b2-8eb6-f5132e3eb54c, Summa: 76000 so'm
Qadam 4: Ofitsiant buyurtmani tasdiqlamoqda (PREPARING)...
[PASS] 4. Buyurtma statusi: PREPARING
Qadam 5: Oshxona taomni tayyorladi (READY)...
[PASS] 5. Oshxona statusi: READY
Qadam 6: Ofitsiant taomni stolga yetkazdi (DELIVERED)...
[PASS] 6. Yetkazildi statusi: DELIVERED
Bonus: Mijoz ofitsiant chaqirmoqda va hisob so'ramoqda...
[PASS] Chaqiruv yuborildi: CALL_WAITER (Xabar ofitsiantga yetkazildi)
[PASS] Chaqiruv ofitsiant tomonidan qabul qilindi va slot bo'shatildi.
Qadam 7: Mijoz yana qo'shimcha taom buyurtma qilmoqda...
[PASS] 7a. Qo'shimcha buyurtma qabul qilindi! Order ID: 47bbfdfb-6c98-463c-98bd-ca9b571e17b7, Summa: 15000 so'm
Qadam 7b: Qo'shimcha buyurtma oshxonada tayyorlanib, yetkazilmoqda...
[PASS] 7b. Qo'shimcha buyurtma to'liq yetkazildi (status: DELIVERED).
Qadam 8: Kassada stol #7 uchun faol tashrif ma'lumotlari tekshirilmoqda...
[PASS] 8. Kassa ko'rinishi to'g'ri! Jami buyurtmalar: 2 ta, Jami summa: 91000 so'm
Qadam 9a: Qisman to'lov qabul qilinmoqda (20 000 so'm)...
[PASS] 9a. Qisman to'lov qabul qilindi. Qoldiq: 71000 so'm, isFullyPaid: false
Qadam 9b: Qolgan 71000 so'm to'liq to'lanmoqda...
[PASS] 9b. Yakuniy to'lov qabul qilindi! Qoldiq: 0 so'm, isFullyPaid: true
Qadam 10: Xodim tashrifni yakunlamoqda...
[PASS] 10. Tashrif yopildi: Stol 7 tashrifi muvaffaqiyatli yopildi. Stol holati 'DIRTY' (tozalash kutilmoqda) ga o'tkazildi.
Qadam 11: Stol holati tekshirilmoqda...
[PASS] 11. Stol holati kutilganidek DIRTY (tozalash kutilmoqda).
Qadam 12: Xodim stolni tozalangan deb belgilamoqda...
[PASS] 12. Stol holati tozalangandan so'ng FREE ga o'tdi.
Qadam 13: Shu stol #7 ga yangi tashrif ochilmoqda...
[PASS] 13. Yangi tashrif (ID: e634eacf-1b53-428e-a85d-615008bbb39e) ochildi: Buyurtmalar = 0 ta, Qarzdorlik = 0 so'm. Eski tashrif ma'lumotlari mutlaqo aralashmadi!

================================================================
BARCHA 13 TA QADAM MUVAFFAQIYATLI O'TDI! SESSIYA TO'LIQ ISBOTLANDI.
================================================================
```
