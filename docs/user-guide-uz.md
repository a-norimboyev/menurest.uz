# MENUREST.UZ — Foydalanuvchi Qo'llanmasi (User Guide)

Ushbu qo'llanma restoran xodimlari (Boss, Manager, Cashier, Waiter, Kitchen), platforma administratori (Super Admin) va mehmonlar uchun tizimdan foydalanish bo'yicha to'liq o'zbekcha yo'riqnomadir.

---

## 1. Mehmon (Guest) Uchun Qo'llanma

### 1.1. Menyuni Ko'rish va Buyurtma Berish
1. **QR Kodni Skanerlash:** Stol ustidagi statik QR kodni telefon kamerasi bilan skanerlang. Brauzerda restoranning ochiq menyusi ochiladi. Hech qanday mobil ilova o'rnatish shart emas.
2. **Taom Tanlash:** Kategoriyalar yoki qidiruv orqali taomlarni toping. Taom ustiga bosib, porsiya (yarim/to'liq), qo'shimchalar (qazi, tuxum) va oshpazga maxsus izohni kiriting.
3. **Stolga Qo'shilish (PIN Kod):** Savatchadan buyurtma yuborish uchun ofitsiant bergan **4-xonali kirish kodi (PIN)** ni kiriting. Kod kiritilgach telefoningiz ushbu stolning faol tashrifiga ulanadi.
4. **Buyurtma Yuborish:** "Buyurtmani yuborish" tugmasini bosing. Buyurtma holati avval `NEW` bo'lib, ofitsiant tasdig'ini kutadi.
5. **Ofitsiant Chaqirish va Hisob So'rash:** "Xizmat" bo'limidan bitta tugma bilan ofitsiantni chaqirishingiz yoki hisob-kitobni so'rashingiz mumkin.
6. **Jonli Hisob:** "Hisob" bo'limida barcha berilgan buyurtmalar, chegirmalar, xizmat haqi va qoldiq real vaqtda ko'rinib turadi.

---

## 2. Ofitsiant (Waiter) Uchun Qo'llanma

### 2.1. Mobil Ofitsiant Paneli
- **Stolga Tashrif Ochish:** Bo'sh (`FREE`) stol ustiga bosib "Tashrif ochish" tugmasini bosing. Tizim stolni band (`OCCUPIED`) qiladi va mehmonga berish uchun 4-xonali PIN kod ko'rsatadi.
- **Buyurtmalarni Tasdiqlash:** Mehmon telefonidan kelgan buyurtmalar "Tasdiq kutayotgan buyurtmalar" bo'limida chiqadi. Ofitsiant taomlarni ko'rib "Tasdiqlash" tugmasini bosadi; taomlar oshxonaga (`ACCEPTED`) yuboriladi. Agar taom mavjud bo'lmasa, sababini ko'rsatib rad etadi.
- **Mehmon Nomidan Buyurtma Olish:** Mehmon telefon ishlatishni istamasa, ofitsiant o'z telefonidan "Yangi buyurtma" tugmasi orqali mehmon nomidan taomlarni kiritadi.
- **Tayyor Taomni Yetkazish:** Oshxonada tayyor bo'lgan taomlar "Tayyor taomlar" bo'limida yashil bo'lib chiqadi. Ofitsiant taomni mehmonga olib borgach, "Yetkazildi" (`SERVED`) tugmasini bosadi. *Diqqat: oshxonada tayyor bo'lmagan taomni "Yetkazildi" deb belgilash tizim tomonidan taqiqlangan.*
- **Chaqiruvlarni Qabul Qilish:** Mehmon chaqiruvi tushganda "Qabul qilish" (`CLAIM`) tugmasini bosadi, xizmat ko'rsatgach "Yakunlash" (`RESOLVED`) qiladi.

---

## 3. Oshxona va Bar (Kitchen / KDS) Uchun Qo'llanma

### 3.1. Oshxona Displeyi
- **Stansiyalar Ajratilishi:** Oshpaz o'ziga biriktirilgan "Issiq Oshxona" taomlarini, Barman esa faqat "Ichimliklar Bari" taomlarini ko'radi.
- **Taom Holatlari:**
  1. `Qabul qilingan (ACCEPTED)`: Taom chiptada yangi buyurtma sifatida ko'rinadi.
  2. `Tayyorlanmoqda (PREPARING)`: Taomni pishirish boshlanganda oshpaz taom ustiga bosadi. Kutish vaqti taymeri ishga tushadi.
  3. `Tayyor (READY)`: Taom tayyor bo'lgach "Tayyor" tugmasi bosiladi. Ofitsiant telefonida darhol xabar va ovozli signal chiqadi.
- **"Tayyorlab Bo'lmaydi" (Cannot Prepare):**
  - Agar taom endigina qabul qilingan bo'lsa, oshpaz sabab ko'rsatib rad etadi (ofitsiantga ogohlantirish boradi).
  - Agar taom pishirish jarayonida (`PREPARING`) masalliq sarflanib buzilgan bo'lsa (spisanie), oshpaz uni o'zboshimchalik bilan bekor qilolmaydi; tizim shoshilinch menejer chaqiruvini hosil qiladi va menejer tasdiqlagach taom bekor qilinadi.

---

## 4. Kassa (Cashier) Uchun Qo'llanma

### 4.1. Kassa Amallari va Smena
- **Smena Ochish:** Kassa bilan ishlashni boshlashdan oldin kassir kassadagi boshlang'ich naqd pulni kiritib smena ochadi. Faol smenasiz to'lov qabul qilib bo'lmaydi.
- **Hisob-Kitob va To'lov Qabul Qilish:**
  - Ochiq hisoblar ro'yxatidan kerakli stol tanlanadi.
  - To'lov usuli tanlanadi: **Naqd pul** yoki **Terminal** (Humo/Uzcard).
  - Naqd to'lovda mijoz bergan pul kiritilganda tizim avtomatik qaytimni hisoblab ko'rsatadi.
  - Aralash to'lov (split payment) qilish mumkin: masalan 300 000 hisobga 100 000 naqd + 200 000 terminal.
- **Pre-Check Chekini Chop Etish:** Mijoz hisob so'raganda xomaki hisob varaqasi (pre-check) chiqariladi. Mazkur hujjat fiskal chek hisoblanmaydi.
- **To'lovni Bekor Qilish (Reversal) va Pul Qaytarish (Refund):** Adashib kiritilgan to'lov sabab ko'rsatilib bekor qilinadi.
- **Tashrifni Yopish (Close Visit):** To'lov to'liq amalga oshirilgach, barcha taomlar yetkazilgan va barcha chaqiruvlar hal etilgan bo'lsa, "Tashrifni yopish" tugmasi bosiladi. Stol statusi darhol **DIRTY (Tozalash kerak)** ga o'tadi. Tozalangach **FREE** bo'ladi.
- **Smenani Yopish:** Kun oxirida kassir kassadagi sanalgan naqd pulni kiritadi; tizim kutilgan kassa balansi bilan taqqoslab farqni (ortiqcha yoki kamomad) hisobotga chiqaradi.

---

## 5. Menejer (Manager) Uchun Qo'llanma

### 5.1. Jonli Operatsion Nazorat
- **Zal Xaritasi:** Barcha stollarning real vaqtdagi holati (Bo'sh, Band, Tozalanishi kerak).
- **Kechikkan Taomlar Nazorati:** 20 daqiqadan ortiq tayyorlanayotgan taomlar qizil ogohlantirish bilan ko'rinadi.
- **Javobsiz Chaqiruvlar:** 3 daqiqadan ortiq ofitsiant qabul qilmagan chaqiruvlar alohida ko'rsatiladi. Menejer chaqiruvni boshqa ofitsiantga audit bilan qayta biriktirishi mumkin.
- **Taomni "Tugagan" Qilish:** Biror taom masallig'i tugaganda menejer yoki oshpaz uni vaqtincha nofaol qiladi (narxni o'zgartirish ruxsatisiz).

---

## 6. Restoran Egasi (Boss) Uchun Qo'llanma

### 6.1. Moliyaviy Boshqaruv va Sozlamalar
- **Moliyaviy KPIlar:** Bugungi buyurtmalar hajmi, berilgan chegirmalar, xizmat haqi, qabul qilingan yalpi to'lovlar, qaytarishlar, sof tushum, faol qarzdorlik va qaytarilishi kerak bo'lgan qoldiq. *Haqiqiy server hisob-kitoblari (soxta sof foyda yasalmaydi).*
- **Menyu Boshqaruvi:** Taomlar, narxlar, variantlar, qo'shimcha guruhlari, allergenlar va taom rasmlarini boshqarish.
- **Xodimlar:** Yangi xodim qo'shish, parolini o'zgartirish, stansiya biriktirish va faolsizlantirish.
- **Restoran Sozlamalari:** Restoran nomi, ish vaqti, logotip, xizmat haqi foizi (serviceChargeBps). *Eslatma: xizmat haqi o'zgartirilganda eski ochiq tashriflarning snapshot foizi o'zgarmaydi.*
- **Audit Jurnali va Eksport:** Barcha muhim harakatlar tarixi; CSV formatida xavfsiz (formula injectiondan himoyalangan) eksport.

---

## 7. Super Admin (Platforma Ma'muri) Uchun Qo'llanma

### 7.1. Global Platforma Boshqaruvi
- **Texnik Monitoring:** Barcha restoranlar soni, faol va to'xtatilgan restoranlar, server sog'ligi, xotira, uptime va xatoliklar navbati.
- **Restoran Yaratish:** Yangi restoran ochish, slug berish, tarif rejasini tanlash va restoran egasini (Boss) biriktirish.
- **Restoran Xizmatini To'xtatish (SUSPENDED):** Obuna to'lovi qilinmaganda sabab ko'rsatilib restoran to'xtatiladi. To'xtatilgan restoranda yangi tashrif va buyurtma ochilmaydi; faqat mavjud faol mehmonlarning hisobi xavfsiz yakunlanadi.
- **Yordam Rejimi (Support Mode):** Restoranga texnik yordam ko'rsatish uchun Super Admin aniq sabab va muddat (15/30/60 min) ko'rsatib, faqat o'qish (read-only) rejimida audit jurnali bilan restoran kontekstiga kiradi.
