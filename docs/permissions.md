# MENUREST.UZ — Foydalanuvchi Rollari va Vakolatlar Matritsasi (Permissions & RBAC)

Ushbu hujjat **menurest.uz** platformasidagi barcha foydalanuvchi rollari, ruxsatlar matritsasi va xavfsizlik cheklovlarini belgilaydi.

---

## 1. Rollar Tavsifi

| Rol | Qisqa Tavsif | Kirish Doirasi |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | Platforma egasi va bosh ma'muri. Barcha restoranlar, global litsenziyalar va tizim monitoringini boshqaradi. | Global (Barcha platforma). Tenantga texnik yordam uchun kirish majburiy audit qilinadi. |
| **BOSS** | Restoran egasi/ta'sischisi. O'z restoranining barcha moliyaviy ko'rsatkichlari, tahlillari, xodimlari va to'liq auditiga ega. | Faqat o'ziga tegishli restoran(lar). Boshqa restoran ma'lumotlarini mutlaqo ko'ra olmaydi. |
| **MANAGER** | Restoran boshqaruvchisi. Menyu, stollar, xodimlar, smenalar, buyurtmalar operatsiyalarini boshqaradi. Taom bekor qilishni tasdiqlaydi. | Faqat o'z restorani. O'zidan yuqori rol (Boss, Super Admin) bera olmaydi yoki o'zgartira olmaydi. |
| **CASHIER** | Kassir. To'lovlarni (naqd, terminal) qabul qilish, aralash to'lovlar, kassa smenasini yuritish, chek chiqarish va tashrifni yopish. | Faqat o'z restorani kassa va hisob-kitob moduli. Menyu narxlarini yoki tizim sozlamalarini o'zgartira olmaydi. |
| **WAITER** | Ofitsiant. Stolda tashrif ochish, mehmon chaqiruvlarini qabul qilish, buyurtmalarni tasdiqlash, taom yetkazish, stolni tozalash. | Faqat o'z restorani xizmat ko'rsatish zallari. Pul to'lovlarini yopa olmaydi, menyu narxlarini o'zgartira olmaydi. |
| **KITCHEN** | Oshpaz / Barmen. KDS displeyida kelib tushgan taomlarni ko'rish va tayyorlash bosqichlarini belgilash. | Faqat o'ziga biriktirilgan tayyorlash stansiyalari (masalan, faqat Bar yoki faqat Oshxona). Moliyani ko'rmaydi. |
| **GUEST** *(Sessiya)* | Mehmon. Restoranning faol tashrifiga ulangan vaqtinchalik mehmon tokeni. Xodim hisoblanmaydi. | Faqat o'zi o'tirgan stoldagi faol tashrif (`Visit`). Menyu ko'rish, savat, buyurtma yuborish, ofitsiant chaqirish. |

---

## 2. Ko'p Rollilik Modeli (Multi-Role Support)

Bitta xodimga bitta restoran ichida bir nechta rol biriktirilishi mumkin:
- *Misol:* Kichik restoranda bir xodim bir vaqtning o'zida ham `MANAGER`, ham `CASHIER` vazifasini bajarishi mumkin.
- Xodim tizimga kirganda uning foydalanuvchi obyekti aktiv rollar to'plamiga (`roles: ['MANAGER', 'CASHIER']`) ega bo'ladi.
- Qilingan har bir operatsiya xodimning shaxsiy akkaunt identifikatori (`userId`) bilan audit qilinadi.

---

## 3. Vakolatlar Matritsasi (Permission Matrix)

Belgilar:
- **HA:** To'liq ruxsat bor.
- **YO'Q:** Ruxsat yo'q (`403 Forbidden`).
- **SHARTLI:** Faqat maxsus shartlar bajarilganda (quyida izohlangan).

| Amal / Modul | SUPER_ADMIN | BOSS | MANAGER | CASHIER | WAITER | KITCHEN | GUEST |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Restoran yaratish / bloklash** | **HA** | YO'Q | YO'Q | YO'Q | YO'Q | YO'Q | YO'Q |
| **Restoran sozlamalari (xizmat %, nom)** | SHARTLI* | **HA** | SHARTLI (cheklangan) | YO'Q | YO'Q | YO'Q | YO'Q |
| **Xodimlarni boshqarish (qo'shish/o'chirish)** | SHARTLI* | **HA** | SHARTLI** | YO'Q | YO'Q | YO'Q | YO'Q |
| **Menyu: kategoriya va taom CRUD** | SHARTLI* | **HA** | **HA** | YO'Q | YO'Q | YO'Q | YO'Q |
| **Menyu: Stop-listga kiritish** | SHARTLI* | **HA** | **HA** | YO'Q | **HA** | **HA** | YO'Q |
| **Menyu ko'rish (Read)** | **HA** | **HA** | **HA** | **HA** | **HA** | **HA** | **HA** |
| **Stollar yaratish va tartiblash** | SHARTLI* | **HA** | **HA** | YO'Q | YO'Q | YO'Q | YO'Q |
| **Tashrif ochish (Open Visit)** | YO'Q | **HA** | **HA** | **HA** | **HA** | YO'Q | YO'Q |
| **Buyurtma yuborish (SUBMITTED)** | YO'Q | **HA** | **HA** | **HA** | **HA** | YO'Q | **HA** |
| **Buyurtma tasdiqlash (CONFIRMED)** | YO'Q | **HA** | **HA** | **HA** | **HA** | YO'Q | YO'Q |
| **Taom tayyorlash (PREPARING -> READY)** | YO'Q | **HA** | **HA** | YO'Q | YO'Q | SHARTLI*** | YO'Q |
| **Taom yetkazish (SERVED)** | YO'Q | **HA** | **HA** | YO'Q | **HA** | YO'Q | YO'Q |
| **Taom bekor qilish (PENDING/ACCEPTED)** | YO'Q | **HA** | **HA** | **HA** | **HA** | YO'Q | SHARTLI**** |
| **Taom bekor qilish (PREPARING keyin)** | YO'Q | **HA** | **HA** | YO'Q | YO'Q | YO'Q | YO'Q |
| **SERVED taomga moliyaviy tuzatish** | YO'Q | **HA** | **HA** | YO'Q | YO'Q | YO'Q | YO'Q |
| **Ofitsiant chaqirish (Service Call)** | YO'Q | YO'Q | YO'Q | YO'Q | YO'Q | YO'Q | **HA** |
| **Chaqiruvni qabul qilish / hal qilish** | YO'Q | **HA** | **HA** | YO'Q | **HA** | YO'Q | YO'Q |
| **Smena ochish va yopish** | YO'Q | **HA** | **HA** | **HA** | YO'Q | YO'Q | YO'Q |
| **To'lov kiritish (Naqd / Terminal)** | YO'Q | **HA** | **HA** | **HA** | YO'Q | YO'Q | YO'Q |
| **To'lovni qaytarish (Refund / Reversal)** | YO'Q | **HA** | **HA** | YO'Q | YO'Q | YO'Q | YO'Q |
| **Tashrifni yopish (Close Visit)** | YO'Q | **HA** | **HA** | **HA** | YO'Q | YO'Q | YO'Q |
| **Stol tozalanganini tasdiqlash (FREE)**| YO'Q | **HA** | **HA** | YO'Q | **HA** | YO'Q | YO'Q |
| **Moliyaviy hisobotlar va Z-report** | YO'Q | **HA** | **HA** | SHARTLI (faqat o'z smenasi) | YO'Q | YO'Q | YO'Q |
| **Audit loglarini ko'rish** | **HA** | **HA** | YO'Q | YO'Q | YO'Q | YO'Q | YO'Q |

---

## 4. Qat'iy Vakolat Cheklovlari (Enforcement Rules)

1. **Super Admin Tenant Impersonation:**
   Super Admin bevosita tenant ma'lumotlarini o'zgartira olmaydi. Texnik ko'mak (support) maqsadida tenant nomidan kirganda `X-Support-Reason` majburiy talab qilinadi va bu harakat maxsus `AUDIT_IMPERSONATION` logiga yoziladi.
2. **Manager Vakolat Chegarasi (Privilege Escalation Prevention):**
   Menejer yangi xodim qo'shganda yoki rollarni tahrirlaganda faqat o'zidan past yoki teng rollarni (`WAITER`, `CASHIER`, `KITCHEN`) bera oladi. `BOSS` yoki `SUPER_ADMIN` rollarini yaratish, berish yoki tahrirlash qat'iyan taqiqlanadi (`403 Forbidden`).
3. **Kitchen Stansiya Cheklovi:**
   Oshpaz/Barmen faqat o'z profiliga biriktirilgan `KitchenStation` (masalan: `GRILL`, `BAR`, `KITCHEN`) bo'yicha chiptalarni ko'radi va holatini o'zgartira oladi. Boshqa stansiya chiptalariga tegish huquqi berilmaydi.
4. **Taom Bekor Qilish Cheklovi:**
   Taom `PREPARING` holatiga o'tgandan so'ng, ofitsiant uni bekor qila olmaydi. Masalliq sarflanganligi sababli faqat `MANAGER` yoki `BOSS` bekor qilish sababini (`cancellation_reason`) kiritib bekor qiladi.
5. **Yetkazilgan (SERVED) Taom Daxlsizligi:**
   Mehmon stoliga berilgan taom oddiy bekor qilinmaydi. Unga faqat `MANAGER` yoki `BOSS` auditli moliyaviy tuzatish (`Financial Adjustment`) qo'llashi mumkin.
6. **Mehmon (GUEST) Cheklovi:**
   Mehmon o'zining `PENDING` buyurtmasini faqat ofitsiant tasdiqlagunga qadar bekor qilishi mumkin. Tasdiqlangandan so'ng faqat ofitsiant orqali murojaat qiladi.
