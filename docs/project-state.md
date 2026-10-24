# MENUREST.UZ — Loyiha Holati va Bosqichlar Rejasi (Project State)

Ushbu hujjat loyihaning har bir bosqichining joriy holatini, qabul qilingan arxitektura qarorlarini va keyingi qadamlarni kuzatib boradi.

---

## Bosqichlar Jadvali

| Bosqich | Nomi | Holat | Yakuniy Natija |
| :--- | :--- | :---: | :--- |
| **0** | **Asosiy loyiha topshirig'i** | **BAJARILDI** | Mahsulot spetsifikatsiyasi, doira, rollar va 14 qat'iy biznes qoidalari belgilandi (`docs/product-spec.md`). |
| **1** | **Audit va arxitektura** | **BAJARILDI** | Modulli monolit (13 domen), ruxsatlar matritsasi, taom/buyurtma holatlari va API shartnomasi qabul qilindi (`docs/architecture.md`, `docs/permissions.md`, `docs/api-contract.md`). |
| **2** | **Dastur asosi va ma'lumotlar bazasi** | **BAJARILDI** | Monorepo workspace (`shared`, `api`, `web`), 27 ta PostgreSQL model va migratsiyalar, composite FK tenant kafolatlari, partial unique indexlar, minor unit pul hisobi, dev seed va testlar ishga tushirildi. |
| **3** | **Kirish, rollar va restoranlar ajratilishi** | **BAJARILDI** | HttpOnly Secure sessiya cookie, CSRF himoyasi, darhol sessiyani bekor qilish (`tokenVersion`), 17 ta aniq RBAC permission, eskalatsiyadan himoyalanish, cross-tenant 404 nazorati, login va restoran tanlash modalari ishga tushirildi. |
| **4** | **Dizayn tizimi va ekranlar asosi** | **BAJARILDI** | Oq-yashil dizayn tizimi tokenlari (#F5F7F6, #0F5C3C, #17241E, #E2E9E4), to'liq UI komponentlar kutubxonasi va 7 ta rol uchun ekranlar asosi (Guest, Waiter, Kitchen, Cashier, Manager, Boss, SuperAdmin) hamda 320–1440px moslashuvchanlik. |
| **5** | **Menyu boshqaruvi** | **BAJARILDI** | Taom, kategoriya, variant va qo'shimchalar CRUD amallari, allergenlar, rasm yuklashda magic bytes xavfsizligi, availability ruxsati (narx tamirlashdan himoyalangan), buyurtma snapshotlarini saqlovchi arxivlash, narx/menyu versiyalash va ochiq public read API. |
| **6** | **Stollar, tashrif va QR** | **BAJARILDI** | Zal va stol boshqaruvi, ommaviy opaque QR, FREE/OCCUPIED/DIRTY lifecycle, atomik tashrif ochish, 4-xonali kirish kodi rate-limitingi (5 urinishdan so'ng 2 min lockout), SHA-256 hash, xavfsiz mehmon sessiyasi va faol buyurtmali stolni yopishdan DB himoyasi. |
| **7** | **Mehmon menyusi va buyurtma** | **BAJARILDI** | Mehmon savatchasi, taom tafsiloti modali (variantlar, addon min/max tekshiruvi, quantity 1-50, izohlar), server-authoritative narx snapshotlari (mijoz narxiga ishonilmaydi), default NEW/PENDING holatlari, scoped SHA-256 idempotency (double-click himoyasi, replay vs 409 conflict), menyu versiyasi ziddiyati (409 PRICE_VERSION_CONFLICT), buyurtmalarim, xizmat va hisob ekranlari. |
| **8** | **Ofitsiant paneli** | **BAJARILDI** | Mobil Waiter paneli, chaqiruvlar (OPEN/CLAIMED/RESOLVED/CANCELLED), anti-spam/cooldown duplicate himoyasi, DB atomik update parallel claim poygasi (winner 200, loser 409), biriktirilmagan ofitsiant 403 siyosati, menejer reassign (audit logli), buyurtmani tasdiqlash (NEW->CONFIRMED, PENDING->ACCEPTED) va sabab bilan rad etish (CANCELLED), tayyor bo'lmagan taomni serve qilishdan qat'iy 400 invariant himoyasi va to'lov tasdiqlashdan 403 RBAC blokirovkasi. |
| **9** | **Oshxona va bar** | **BAJARILDI** | KDS displeyi, stansiyalar izolyatsiyasi (Issiq oshxona vs Bar), taom darajasidagi holat sikli (`ACCEPTED -> PREPARING -> READY`), server-authoritative `deriveOrderStatus`, sababli "Tayyorlab bo'lmaydi" (spisanie/menejer himoyasi), optimistic versioning (409 conflict), idempotent replay va ofitsiant bilan integratsiya. |
| **10** | **Jonli yangilanish va ulanish tiklanishi** | **BAJARILDI** | SSE (Server-Sent Events) protokoli, Tranzaksion Outbox Pattern (process crash recovery), 13 ta RealtimeEventType, qat'iy Auditoriya va Scope izolyatsiyasi (Oshxona moliyadan to'liq to'silgan, stansiya va tashrif izolyatsiyasi), Last-Event-ID cursor replay, oflayn ogohlantirish banneri va Web Audio sintezatori. |
| **11** | **Kassa, hisob va smena** | **BAJARILDI** | Minor unit (tiyin) hisob-kitobi, chegirma va xizmat haqi formulalari, smena boshqaruvi va reconcile, row-level locks (SELECT FOR UPDATE) concurrency poygasi (overpayment rad etilishi), berilgan naqd pul vs kassa kirimi, reversal, refund (yopiq tashrifga kompensatsiya bilan), split to'lovlar, pre-check cheki va DIRTY stollar. |
| **12** | **Boss va Manager** | **BAJARILDI** | Boss moliyaviy KPIlari (real agregatsiyalar, soxta foyda yo'q), Manager jonli zali/kechikishlar/chaqiruvlar, xodimlar boshqaruvi va eskalatsiya himoyasi, sozlamalar va o'zgarmaslik, Asia/Tashkent kun chegarasi hisobotlari, sanitizatsiya va formula injectiondan himoyalangan audit jurnali. |
| **13** | **Super admin va platforma boshqaruvi** | **BAJARILDI** | Platforma monitoringi, yangi restoranlar yaratish, subscription va suspension siyosati (graceful wind-down), support mode (read-only guard) va platforma auditi to'liq joriy qilindi va testlandi. |
| **14** | **To'liq jarayonni tekshirish** | **BAJARILDI** | Haqiqiy PostgreSQL va barcha APIlar bilan 15 bosqich to'liq E2E integratsiyasi, concurrency (poyga holatlari) va invariantlar sinovdan o'tkazildi (78/78 test ALL PASSED). |
| **15** | **Ishga tushirishga tayyorlash** | **BAJARILDI** | Production & Staging arxitekturasi, Nginx + SSE proxy, zaxiralash (pg_dump/restore, uploads), monitoring (/health, /ready), outbox crash recovery va 7 ta rol uchun to'liq foydalanuvchi qo'llanmasi yaratildi. |

---

## Bosqich 3 Tafsilotlari va Xulosalari

- **Autentifikatsiya va Sessiyalar:**
  - `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/switch-restaurant`, `POST /api/v1/auth/change-password`.
  - `HttpOnly`, `SameSite='lax'`, `Secure` (production) cookie sessiyalari.
  - Cookie mutatsiyalarida `X-CSRF-Token` orqali CSRF himoyasi.
  - Xodim faolsizlantirilganda yoki paroli o'zgarganda `tokenVersion` orqali uning barcha ochiq sessiyalari bir lahzada bekor qilinishi test qilindi va tasdiqlandi.
- **RBAC va Vakolatlar Matritsasi:**
  - 17 ta aniq harakat bo'yicha permissionlar (`menu.manage`, `staff.manage`, `reports.view`, `payments.record`, `items.serve`, va h.k.).
  - Manager o'zidan yuqori rol (Boss, SuperAdmin) bera olmasligi va o'ziga-o'zi vakolat oshira olmasligi (`403 PRIVILEGE_ESCALATION_FORBIDDEN` va `403 SELF_ESCALATION_FORBIDDEN`) isbotlandi.
  - Waiter va Cashier o'z doirasidan tashqari amallarni bajara olmasligi test bilan tasdiqlandi.
- **Multi-Tenant Izolyatsiyasi:**
  - Server har bir so'rovda tenant ruxsatini tekshiradi (`requireTenant`). Boshqa restoranning IDsi bilan yuborilgan so'rovlar resursni oshkor qilmasdan `404 NOT_FOUND` bilan rad etildi.
- **Frontend Interfeysi:**
  - Tezkor demo loginlar bilan `LoginModal`.
  - Ko'p restoranga ega xodimlar uchun `RestaurantSelectorModal`.
  - Faol restoran, foydalanuvchi va server tasdiqlagan huquqlar ko'rsatilgan boshqaruv paneli.
  - Real-vaqtda boshqa tenantga hujumni simulyatsiya qilib tekshirish imkoniyati.
- **Sifat Nazorati:**
  - Barcha 9 ta unit, integratsiya, RBAC va tenant xavfsizlik testlari muvaffaqiyatli o'tdi (**PASSED**).
  - Typecheck va Build 100% toza (**Exit code: 0**).

## Bosqich 4 Tafsilotlari va Xulosalari

- **Dizayn Tizimi Tokenlari va Uslubi:**
  - `background`: `#F5F7F6` (`bg-bg`)
  - `surface`: `#FFFFFF` (`bg-surface`)
  - `asosiy green`: `#0F5C3C` (`brand`), `hover`: `#0B462E` (`brand-hover`)
  - `text`: `#17241E` (`ink-main`), `secondary text`: `#68756E` (`ink-secondary`)
  - `border`: `#E2E9E4` (`line`)
  - Semantik holatlar: Ogohlantirish (Amber), Xato (Red), Axborot (Blue), Muvaffaqiyat (Green) va neytral.
  - Kartalar 16–20px burchak radiusi, 8px spacing tizimi, yengil soyalar (`shadow-subtle`), Inter shrifti.
- **Standart UI Komponentlar Kutubxonasi (`apps/web/src/components/ui/`):**
  - `Button`: 44px min-height touch target, variantlar (`primary`, `secondary`, `outline`, `ghost`, `danger`), yuklanish indikatori.
  - `Input` & `Select`: Aniq label, yordamchi matn, xatolik holatlari va focus halqalari.
  - `Badge` & `Status`: Matnli va rangli kontrastli holatlar (Table, Item, Order, Visit, Shift holatlari).
  - `Money`: BigInt minor unit (tiyin) xavfsiz valyuta ko'rsatish komponenti.
  - `Dialog` & `Drawer`: Modal va yon/pastdan chiquvchi panellar, ESC tugmasi va backdrop dismiss.
  - `Tabs`, `Table`, `Toast`, `Skeleton`, `EmptyState`, `ImageFallback`: Rasm yuklanmasa proporsiyani saqlovchi zaxira blok.
- **7 ta Rol Ekranlari Asosi (`apps/web/src/views/` va `App.tsx`):**
  1. **Mehmon (GUEST):** Telefon menyusi, restoran banneri, til tugmasi (UZ/RU), sticky qidiruv va kategoriyalar, taom rasmi, narxi va savatchaga qo'shish, to'qnashmaydigan suzuvchi savat va pastki navigatsiya paneli (Menyu, Buyurtmalar, Xizmat, Hisob).
  2. **Ofitsiant (WAITER):** Mobil ekran; faol chaqiruvlar, tayyor taomlar, tasdiq kutayotgan buyurtmalar va biriktirilgan stollar.
  3. **Oshxona & Bar (KITCHEN / KDS):** Katta ekran va planshetga mos masofadan o'qiladigan chiptalar; Issiq oshxona, Bar va Kabob/Mangal stansiya filtrlari, kutish vaqti taymeri, taom holatlarini boshqarish.
  4. **Kassa (CASHIER):** Katta ekranda 3 ustunli kassa (chapda ochiq hisoblar, o'rtada hisob tafsiloti va hisob-kitob, o'ngda to'lov usullari: Naqd, Karta, QR va tashrifni yopish); mobil ekranda 3 bosqichli ketma-ket panel.
  5. **Menejer (MANAGER) & Boss (BOSS):** Yon menyu (sidebar/topbar), bugungi tushum, bandlik va o'rtacha chek ko'rsatkichlari, Asosiy zal va Yozgi terassa stollar xaritasi, xodimlar jadvali, sanalar filtri.
  6. **Super Admin (SUPER_ADMIN):** Multi-tenant restoranlar ro'yxati, platforma xizmatlari holati, platforma audit jurnali va sabab bilan tenantga yordam uchun kirish dialogi.
- **Mobil va Ekran Moslashuvchanligi:**
  - 320px, 375px, 768px, 1024px va 1440px o'lchamlarda to'qnashuvlarsiz tekshirildi.
  - Barcha interaktiv tugma va elementlarda $\ge 44\text{px}$ touch target kafolatlangan.
- **Sifat Nazorati va Build:**
  - `npm run typecheck` — 0 xato (**PASSED**).
  - `npm run build` — Vite va tsc paketlash 100% muvaffaqiyatli (**PASSED**).
  - `npm run test` — Barcha integratsiya va xavfsizlik testlari 100% o'tdi (**PASSED**).

## Bosqich 5 Tafsilotlari va Xulosalari

- **Menyu Boshqaruvi va DB Yangilanishi:**
  - `Category`: `isVisible`, `sort_order` qo'shildi. Kategoriyalar CRUD va tartiblash to'liq ishlaydi.
  - `MenuItem`: `allergens` (string massiv), `sort_order`, `is_archived`, `version` ustunlari qo'shildi.
  - `MenuVariant` & `AddonOption`: `is_available` holati qo'shildi.
  - DB migratsiyasi `20261008170000_step5_menu_enhancements` asosiy va test bazalariga muvaffaqiyatli tatbiq etildi.
- **Variant va Qo'shimchalar (Addon Groups & Options):**
  - Yarim/to'liq porsiya (narx farqi bilan) va qazi/tuxum kabi modifikatorlar.
  - Guruh darajasida `min_select` va `max_select` tekshiruvi; qoidaga zid yozuvlar serverda rad etiladi (`400 BAD_REQUEST`).
  - Narxlar qat'iy ravishda integer minor unit tiyinda saqlanadi.
- **Rasm Yuklash va Xavfsizlik:**
  - Fayl formati faqat MIME sarlavhasi bilan emas, balki real Magic Bytes (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WEBP: `RIFF...WEBP`) orqali tekshiriladi.
  - Soxta fayllar (`.jpg` qilib nomlangan `.php` yoki skriptlar) darhol rad etiladi.
  - Tasodifiy kriptografik UUID nom beriladi, xavfsiz papkada saqlanadi va static `/uploads` orqali tarqatiladi. Maksimal hajm: 5 MB.
- **RBAC va Narx Tamirlashdan Himoyalanish:**
  - Faqat `menu.manage` (Boss/Manager) to'liq tahrirlash huquqiga ega.
  - `menu.availability` ruxsatiga ega xodim (masalan, Waiter/Oshpaz) taomni "Tugagan" (`isAvailable = false`) qila oladi.
  - Agar ushbu xodim narxni o'zgartirishga urinsa, server qat'iy ravishda `403 PRICE_TAMPERING_FORBIDDEN` xatosini qaytaradi.
- **Arxivlash va Tarixiy Xavfsizlik:**
  - Tarixida buyurtmasi mavjud taomlar hard delete qilinmaydi (`isArchived = true`, `isAvailable = false`).
  - Tarixdagi buyurtma snapshotlari (`snapshot_name`, `snapshot_price_tiyin`) butun holda saqlanib qoladi.
  - O'zgartirishlar taomning `version` raqamini oshiradi.
- **Tenant Izolyatsiyasi:**
  - Boshqa restoranning toifasi yoki stansiyasini o'z taomiga bog'lashga uringan so'rovlar rad etiladi (`400 INVALID_CATEGORY_TENANT` / `INVALID_STATION_TENANT`).
- **Ochiq Public Menyu API:**
  - `GET /api/v1/public/restaurants/:slugOrId/menu` — Hech qanday login, cookie yoki telefon raqami talab qilinmaydi.
  - Faqat faol, ko'rinadigan kategoriyalar va arxivlanmagan taomlarni qaytaradi. Ichki xodim yoki maxfiy ma'lumotlar tozalanadi.
- **Frontend Interfeysi:**
  - Menejer/Boss panelida to'liq Menyu boshqaruvi bo'limi: kategoriyalar, taomlar ro'yxati, mavjudlik tugmasi, `MenuItemModal` (tarjimalar, rasmlar, variantlar, qo'shimchalar, allergenlar) va `CategoryModal`.
  - Mehmon menyusida (GuestView) ochiq public API dan o'qish, til almashtirish (UZ/RU), to'liq responsive ko'rinish va zaxira bloklar.
- **Sifat Nazorati va Build:**
  - `npm run typecheck` — 0 xato (**PASSED**).
  - `npm run build` — 100% muvaffaqiyatli (**PASSED**).
  - `npm run test` — Barcha 16 ta bosqich testlari to'liq o'tdi (**PASSED**).

## Bosqich 6 Tafsilotlari va Xulosalari

- **Zal va Stol Boshqaruvi (`halls.manage`, `tables.manage`):**
  - Boss va Manager zal va stollarni yaratish, raqam va sig'im belgilash, ofitsiant biriktirish huquqiga ega.
  - QR kodlar generatsiyasi: SVG va PNG formatida chop etishga tayyor `GET /api/v1/restaurants/:id/tables/:tableId/qr.png|svg`.
  - QR kod faqat ommaviy tasodifiy identifikatorni (`qrToken`) o'z ichiga oladi, faol tashrif sirini (PIN kod) yoki ichki IDlarni oshkor qilmaydi.
- **Stol Lifecycle va Tashrif Ochish:**
  - Stol holatlari: `FREE` -> `OCCUPIED` -> `DIRTY` -> `FREE`.
  - Faqat `FREE` stolga tashrif ochish mumkin (`POST /api/v1/restaurants/:id/tables/:tableId/open-visit`).
  - DB darajasidagi partial unique index (`idx_unique_active_visit_per_table`) va atomik tranzaksiya parallel tashrif ochish poygasidan (race condition) 100% himoya qiladi.
  - Tashrif ochilganda tasodifiy 4-xonali kirish kodi (`pinCode`) chiqariladi va xavfsizlik uchun SHA-256 hashi (`pinCodeHash`) saqlanadi.
- **Kirish Kodi Xavfsizligi va Rate Limiting:**
  - Ommaviy API (`POST /api/v1/public/tables/:qrToken/join`) orqali mehmon kod kiritadi.
  - 5 marta ketma-ket xato kod kiritilganda `lockedUntil` orqali 2 daqiqaga bloklanadi (`429 TOO_MANY_ATTEMPTS`).
  - Xodim istalgan paytda kodni yangilashi (`rotate-code`) mumkin; eski kod darhol bekor bo'ladi.
- **Mehmon Sessiyasi va Ko'p Telefonli Ulanish:**
  - Kod to'g'ri kiritilganda kuchli 256-bit tasodifiy `sessionToken` chiqariladi, DBda faqat SHA-256 hashi saqlanadi.
  - Sessiya `HttpOnly` cookie orqali uzatiladi (shuningdek `Bearer` yoki `x-guest-token` ham qo'llab-quvvatlanadi).
  - Bir nechta telefon bitta tashrifga ulanishi mumkin; barchasi o'sha umumiy tashrifga ulanadi.
- **Tashrifni Yopish va Invariant Himoyasi:**
  - Tashrif yopilganda (`close-visit`) barcha mehmon sessiyalari `isRevoked = true` qilinadi.
  - Stol holati `DIRTY` bo'ladi; tozalangach `FREE` ga o'tadi.
  - **Invariant DB Himoyasi:** Agar stolda yakunlanmagan (`PENDING`, `ACCEPTED`, `PREPARING`) taomlar bo'lsa, tashrifni yopish rad etiladi (`400 ACTIVE_ITEMS_EXIST`).

---

## Bosqich 7 Tafsilotlari va Xulosalari

- **Frontend Interfeysi va Taom Tafsiloti Modali (`DishDetailModal`):**
  - Taom kartasi bosilganda ochiladigan professional modal.
  - Porsiya/variant tanlash (radio), qo'shimcha guruhlari (addon guruhlari bo'yicha dinamik `minSelect` va `maxSelect` tekshiruvi), porsiya miqdori (1 dan 50 gacha) va taomga maxsus oshpaz izohi (maksimal 200 belgi).
  - Savatcha paneli (`Drawer`): barcha tanlangan variantlar, qo'shimcha pufakchalari, izohlar, subtotal, 10% xizmat haqi va umumiy to'lov (tiyin formatida xavfsiz).
  - Buyurtmaga umumiy izoh maydoni (maksimal 500 belgi).
- **Server-Authoritative Narx Snapshotlari:**
  - `POST /api/v1/guest/orders` — Klient yuborgan narxga yoki nomga aslo ishonilmaydi.
  - Server taom bazasidan haqiqiy `MenuItem`, `MenuVariant` va `AddonOption` narxlarini olib `OrderItem` va `OrderItemAddonSnapshot` jadvallariga o'zgarmas narx snapshotlarini yozadi.
  - Klient narxni tamirlashga uringan holatda ham server DBdagi narxni yozadi (test bilan isbotlangan).
- **Default Holatlar Invarianti:**
  - Yaratilgan har bir buyurtma default holatda `Order.status = NEW` (ofitsiant tasdig'ini kutadi).
  - Taomlar esa `OrderItem.status = PENDING` holatida saqlanadi. Tasdiqlanmagan taom oshxonaga ish sifatida bormaydi.
- **Scoped SHA-256 Idempotency Kafolati:**
  - Idempotency kaliti: `restaurantId:guest_order:visitId:clientKey` doirasida saqlanadi (`IdempotencyRecord` jadvali).
  - Kanonik Fingerprint: `visitId`, `currency` va saralangan item parametrlarining (`menuItemId`, `variantId`, saralangan `addonOptionIds`, `notes`, `quantity`) deterministik SHA-256 xeshi.
  - **Replay Kafolati:** Tarmoq uzilishi yoki double-click holatida aynan shu kalit va fingerprint bilan so'rov qayta kelsa, DBga 2-marta yozilmasdan avvalgi buyurtma natijasi qaytariladi (`meta.isIdempotentReplay = true`).
  - **Ziddiyat Himoyasi:** Kalit qayta ishlatilib, lekin savatcha mazmuni o'zgargan bo'lsa, server qat'iy ravishda `409 IDEMPOTENCY_CONFLICT` qaytaradi.
- **Menyu Versiyasi Ziddiyati (`PRICE_VERSION_CONFLICT`):**
  - Agar mehmon savatda turgan vaqtda administrator taom narxini o'zgartirsa (`version` oshsa), server buyurtmani qabul qilmasdan `409 PRICE_VERSION_CONFLICT` qaytaradi va mehmondan savatni qayta tekshirishni so'raydi.
- **Buyurtmalarim, Xizmat va Hisob Ekranlari:**
  - `Buyurtmalarim` tabida (`GET /api/v1/guest/orders`) barcha buyurtmalar real vaqtda ro'yxatda ko'rinadi (buyurtma va taomlar holati badge bilan: `NEW`, `PENDING` va h.k.).
  - `Xizmat` tabida ofitsiant chaqirish, hisob so'rash va tozalash so'rovlari kartalari.
  - `Hisob` tabida barcha buyurtmalarning agregatsiyalangan hisob-kitobi (taomlar yig'indisi, 10% xizmat haqi va yakuniy summa).
- **Sifat Nazorati va Build:**
  - `npm run typecheck` — 0 xato (**PASSED**).
  - `npm run build` — 100% toza production build (**PASSED**).
  - `npm run test` — Barcha 30 ta integratsiya, xavfsizlik va idempotency testlari to'liq o'tdi (**PASSED**).

---

## Bosqich 8 Tafsilotlari va Xulosalari

- **Mobil Waiter Paneli (`WaiterView.tsx`):**
  - **Yuqori Metrika Kartalari:** Yangi chaqiruvlar (`openCallsCount`), Tayyor taomlar (`readyItemsCount`), Tasdiq kutayotgan buyurtmalar (`pendingOrdersCount`), Hisob so'ragan stollar (`billRequestsCount`).
  - **Mening Stollarim:** Stol raqami, faol tashrif PIN kodi, davomiyligi, buyurtmalar soni va jami hisob balansi (tiyin/so'm).
  - **Waiter Amallari:** Tashrif ochish (`open-visit`), mehmon buyurtmasini tasdiqlash (`confirm`), sabab bilan rad etish (`reject`), mehmon nomidan xodim buyurtmasi kiritish (`createStaffOrder`), tayyor taomni mehmonga yetkazish (`serveItem`), xizmat chaqiruvini qabul qilish (`claim`) va yakunlash (`resolve`).
- **Xizmat Chaqiruvlari Lifecycle va Anti-Spam:**
  - Chaqiruv holatlari: `OPEN` (`PENDING`) -> `CLAIMED` (`ACKNOWLEDGED`) -> `RESOLVED` yoki auditli `CANCELLED`.
  - **Anti-Spam / Cooldown:** Bir tashrifda aynan bir turdagi (`WAITER` yoki `BILL`) ochiq chaqiruv mavjud bo'lsa, qayta bosilganda DBda dublikat spam yozuv yaratilmaydi; mavjud chaqiruv `meta.isDuplicate = true` bilan qaytariladi (test bilan tasdiqlangan).
- **Concurrency va Parallel Claim Poygasi (Race Condition):**
  - Ikkala ofitsiant bir vaqtda parallel claim yuborganda, PostgreSQL atomik conditional update (`updateMany` where `status = PENDING`) orqali faqat bitta ofitsiant yutadi (**200 OK**), ikkinchisiga `409 CALL_ALREADY_CLAIMED` ("Boshqa xodim qabul qilgan") qaytariladi.
- **Biriktirilgan Stol Siyosati (Policy Guard):**
  - Agar stol faqat ma'lum bir ofitsiantga biriktirilgan bo'lsa, begona ofitsiantning chaqiruvni claim qilishga urinishi qat'iy rad etiladi (`403 NOT_ASSIGNED_WAITER`).
- **Menejer Reassignment va Huquqni Bekor Qilish:**
  - Manager chaqiruvni boshqa ofitsiantga audit log bilan qayta biriktirishi (`reassign`) mumkin (`SERVICE_CALL_REASSIGNED`).
  - Reassignmentdan so'ng eski ofitsiantning chaqiruv ustidan yozish/yakunlash huquqi darhol bekor qilinadi (`403 FORBIDDEN`); faqat yangi biriktirilgan ofitsiant chaqiruvni `RESOLVED` qila oladi.
- **Buyurtmani Tasdiqlash va Sabab bilan Rad Etish:**
  - Buyurtma tasdiqlanganda: `Order.status = CONFIRMED`, taomlar `OrderItem.status = ACCEPTED` bo'lib oshxonaga yo'naltiriladi. Qayta tasdiqlash idempotent ishlaydi.
  - Buyurtma rad etilganda: majburiy rad etish sababi (`reason`) talab qilinadi, `CANCELLED` holatiga o'tkaziladi va `cancellationReason` saqlanadi.
- **Qat'iy Invariant: Tayyor Bo'lmagan Taomni Serve Qilishni To'xtatish:**
  - Oshxonada tayyor bo'lmagan (`PENDING`, `ACCEPTED`, `PREPARING`) taomni ofitsiant tomonidan yetkazilgan (`SERVED`) deb belgilashga urinish server tomonidan qat'iy to'xtatildi (`400 CANNOT_SERVE_UNREADY_ITEM`). Faqat `READY` holatidagi taom `SERVED` qilinadi.
- **To'lov Tasdiqlash Huquqining Berilmasligi (RBAC Guard):**
  - Ofitsiantda to'lovni tasdiqlash (`payments.record`) vakolati yo'q; to'lov kiritishga uringanda server `403 FORBIDDEN` qaytaradi.
- **Sifat Nazorati va Build:**
  - `npm run typecheck` — `@menurest/shared`, `@menurest/api`, `@menurest/web` -> **0 xato (PASSED)**.
  - `npm run build` — Barcha paketlar ishlab chiqarishga muvaffaqiyatli paketlandi (**dist/assets/..., Exit code: 0**).
  - `npm run test` — Barcha 39 ta integratsiya, xavfsizlik, concurrency va invariant testlari to'liq o'tdi (**PASSED**).

---

## Bosqich 9 Tafsilotlari va Xulosalari

- **Ma'lumotlar Bazasi va Arxitektura Kengaytmasi:**
  - `OrderItem`: `notes` (taom nomidan ajratilgan oshpaz izohi), `version` (optimistic concurrency counter), `prepared_at` (pishirish boshlangan vaqt) va `ready_at` (tayyor bo'lgan vaqt) ustunlari qo'shildi.
  - `StaffStationAssignment`: Oshxona xodimlarini ma'lum stansiyalarga xavfsiz biriktiruvchi jadval (`restaurant_id`, `user_id`, `station_id`), composite foreign keylar bilan tenant kafolati.
  - Migratsiya `20261008200000_step9_kds_station_assignments` muvaffaqiyatli tatbiq etildi va Prisma client yangilandi.
- **KDS Chiptalari (Tickets) va Stansiyalar Izolyatsiyasi:**
  - `GET /api/v1/restaurants/:id/kds/tickets` — Stansiyalar bo'yicha chiptalar va faol taomlar ro'yxati.
  - Oshpaz faqat o'ziga biriktirilgan stansiya (`Issiq Oshxona`) taomlarini, Barman esa faqat o'zining stansiyasi (`Ichimliklar Bari`) taomlarini ko'radi.
  - Begona stansiya taomlari chiptalarga kiritilmaydi; ammo Menejer/Boss barcha stansiyalarni to'liq ko'ra oladi.
  - Taom izohlari (`notes`: "Yog'i kamroq, noxati ko'p bo'lsin") alohida saqlanadi va taom nomidan yo'qolib ketmaydi.
- **Stansiya Xavfsizlik To'sig'i (Security Guard):**
  - Xodim o'ziga biriktirilmagan stansiya taomini pishirishga (`prepare`), tayyorlashga (`ready`) yoki bekor qilishga uringanda server qat'iy ravishda `403 STATION_ACCESS_DENIED` qaytaradi.
- **Taom Holatlarining Mustaqil Sikli (Sibling Independence):**
  - Taomlar darajasida holat mashinasi: `ACCEPTED -> PREPARING -> READY`.
  - Qat'iy invariant: Bir taom `READY` bo'lganda, boshqa qardosh taomlar avtomatik `READY` qilinmaydi! Har bir taom mustaqil pishiriladi.
- **Server-Authoritative `deriveOrderStatus` Qat'iyligi:**
  - Buyurtma holati faqat va faqat serverdagi barcha qardosh taomlar (`OrderItem`) holatlari tahlili asosida avtomatik hisoblanadi.
  - Qo'lda tashqaridan buyurtma holatini buzishning oldi olindi.
  - Osh `SERVED`, Choy `PREPARING` bo'lsa -> buyurtma `SERVED` emas, balki `PARTIALLY_SERVED` bo'ladi.
  - Faqat barcha non-cancelled taomlar `SERVED` bo'lgandagina buyurtma `SERVED` holatiga o'tadi.
- **"Tayyorlab bo'lmaydi" (Cannot Prepare) va Spisanie/Menejer Qoidasi:**
  - `POST /api/v1/restaurants/:id/kds/items/:id/cannot-prepare` — Majburiy rad etish sababi (`reason`) talab qilinadi (`400 REASON_REQUIRED`).
  - **ACCEPTED taom:** Oshxona to'g'ridan-to'g'ri sabab bilan bekor qiladi, `CANCELLED` holatiga o'tadi va ofitsiant/menejer uchun ogohlantiruvchi `ServiceCall` (chaqiruv) yaratiladi.
  - **PREPARING taom (Spisanie qoidasi):** Pishirish jarayonidagi taom uchun masalliq sarflanganligi sababli, oddiy oshxona xodimi uni o'zboshimchalik bilan bekor qila olmaydi. Tizim `isCancellationPending = true` bilan shoshilinch `ServiceCall` yaratadi va taom statusi `PREPARING` ligicha turadi. Faqat Menejer/Boss kelib tasdiqlaganidan so'ng taom bekor qilinadi.
- **Optimistic Concurrency va Idempotent Replay:**
  - Eskirgan versiya bilan so'rov yuborilganda `409 ITEM_VERSION_CONFLICT` qaytariladi.
  - Allaqachon `READY` bo'lgan taomga qayta `ready` bosilganda xato chiqmasdan `200 OK` va `meta.isIdempotentReplay = true` bilan xavfsiz javob qaytariladi.
- **Ofitsiant Paneli Integratsiyasi:**
  - Oshxonada `READY` bo'lgan taomlar bir lahzada ofitsiant dashboardida (`readyItems`) paydo bo'ladi va ofitsiant ularni mehmonga yetkazadi (`SERVED`).
- **Sifat Nazorati va Build:**
  - `npm run typecheck` — Barcha paketlar (`@menurest/shared`, `@menurest/api`, `@menurest/web`) bo'yicha **0 xato (PASSED)**.
  - `npm run build` — 100% toza production build (**dist/assets/..., Exit code: 0**).
  - `npm run test` — Barcha 47 ta integratsiya, xavfsizlik, stansiya izolyatsiyasi, sibling mustaqilligi va concurrency testlari to'liq o'tdi (**PASSED**).

---

## Bosqich 10 Tafsilotlari va Xulosalari

- **Arxitektura va Jonli Yangilanish Yechimi:**
  - Serverdan mijozga real-vaqt ma'lumot uzatish uchun yagona xavfsiz va engil standart — **Server-Sent Events (SSE)** tanlandi.
  - Mijozdan serverga barcha buyurtma, holat o'zgartirish va to'lov mutatsiyalari mavjud idempotency va RBAC bilan himoyalangan **REST API** orqali yuboriladi. Ikkinchi parallel texnologiya (WebSocket) qo'shilmadi, murakkablik orttirilmaydi.
- **Tranzaksion Outbox Pattern (Transactional Outbox):**
  - Har bir real-vaqt hodisasi (`RealtimeEvent`) faqat va faqat o'sha o'zgarishni amalga oshiruvchi PostgreSQL tranzaksiyasi ichida `OutboxEvent` (`status: 'PENDING'`) sifatida yoziladi.
  - Agar DB tranzaksiyasi xatolik sababli rollback bo'lsa, hech qanday soxta outbox hodisasi saqlanmaydi va tarqatilmaydi (Rollback kafolati testlandi).
  - Tranzaksiya commit bo'lishi bilanoq `outboxService.trigger()` orqali <5ms kechikish bilan barcha ulanishlarga tarqatiladi va holat `PROCESSED` ga yangilanadi.
  - **Crash Recovery:** Server kutilmaganda restart bo'lsa, 300ms foniy worker avtomatik ishga tushib, bazadagi barcha `PENDING` eventlarni navbatdagi tsiklda davom ettiradi; xabarlar aslo yo'qolmaydi.
- **13 ta Tizim Realtime Eventlari:**
  - `order.created`, `order.confirmed`, `item.state_changed`, `call.created`, `call.claimed`, `call.resolved`, `payment.recorded`, `refund.recorded`, `bill.updated`, `visit.closed`, `table.state_changed`, `menu.updated`, `access.revoked`.
- **Server Tomonidagi Qat'iy Auditoriya va Scope Izolyatsiyasi:**
  - **Moliyaviy Filtr:** Oshxona xodimlari (`KITCHEN` roli: Oshpaz va Barman) moliyaviy ma'lumotlarni (`payment.recorded`, `refund.recorded`, `bill.updated`, `isFinancial: true`) ASLO qabul qilmaydi (avtomatlashtirilgan xavfsizlik testi bilan isbotlandi).
  - **Stansiyalar Izolyatsiyasi:** Oshxona oshpazi faqat o'ziga biriktirilgan stansiya (`Issiq Oshxona`) taomlari eventlarini oladi; Bar taomlari oshpazga yuborilmaydi va aksincha.
  - **Mehmon Tashrif Izolyatsiyasi:** Mehmon faqat o'zining `visitId` va stoli bilan bog'liq hodisalarni oladi; boshqa stollarning buyurtmalari va chaqiruvlari begona mehmonga yuborilmaydi.
  - **Tenant Izolyatsiyasi:** Begona restoran xodimi yoki mijozi boshqa restoranning SSE oqimiga aslo ulana olmaydi (`404 NOT_FOUND` / filtr).
- **Kirish Huquqi Bekor Qilinganda Darhol Uzish (`access.revoked`):**
  - Xodim faolsizlantirilganda yoki a'zoligi bekor qilinganda, `realtimeService.closeUserConnections(userId)` chaqiriladi.
  - SSE oqimiga darhol `access.revoked` hodisasi yoziladi va `res.end()` orqali ulanish shu zahoti uziladi.
- **Qayta Ulanish va Cursor Replay (`Last-Event-ID`):**
  - Mijoz uzilib qayta ulanganda `Last-Event-ID` sarlavhasi yoki so'rov parametri orqali o'tkazib yuborilgan eventlarni (`getMissedEvents`) so'raydi.
  - Agar hodisalar bazada mavjud bo'lsa, ular FIFO tartibida replay qilinadi. Agar kursor juda eski yoki topilmasa, mijozga `sync.required` yuborilib, to'liq REST snapshot olish buyuriladi.
  - Mijozda `Set<string>` bilan 200 ta so'nggi `eventId` saqlanib, takroriy (duplicate) xabarlar filtrlanadi.
- **Oflayn Holat Xavfsizligi va Web Audio Bildirishnomasi:**
  - Oflayn rejimda buyurtma yoki to'lovlarni ko'r-ko'rona avtomatik yuborish navbati taqiqlandi.
  - Ulanish uzilganda ekranda aniq qizil banner ("Ulanish uzildi, holat yangilanmayapti") paydo bo'ladi.
  - Web Audio API orqali brauzerning audio fayl yuklashiga ehtiyoj qoldirmasdan, ikki tonli (880Hz / 1320Hz) yoqimli chime ovozi sintez qilindi (foydalanuvchi `menurest_sound_enabled` orqali yoqishi/o'chirishi mumkin).
- **Integratsiya Qilingan Ekranlar:**
  - `GuestView` — buyurtmalar va chaqiruvlar jonli yangilanadi.
  - `WaiterView` — yangi chaqiruvlar, tasdiq kutayotgan buyurtmalar va KDS da tayyor bo'lgan taomlar jonli aks etadi.
  - `KitchenView` — yangi tasdiqlangan chiptalar va bekor qilishlar zudlik bilan chiqadi (eskirgan 5 soniyalik poller olib tashlandi).
  - `CashierView` — ochiq hisoblar, buyurtma qo'shilishi va to'lovlar real-vaqtda sinxronlanadi.
  - `ManagerView` — zal holati, stollar va operatsiyalar real-vaqtda aks etadi.
- **Sifat Nazorati va Build:**
  - `npm run typecheck` — Barcha paketlar (`@menurest/shared`, `@menurest/api`, `@menurest/web`) bo'yicha **0 xato (Exit code: 0)**.
  - `npm run build` — 100% toza production build (**dist/assets/index-..., Exit code: 0**).
  - `npm run test` — Barcha 53 ta integratsiya, xavfsizlik, outbox, SSE, auditoriya izolyatsiyasi va moliya testlari to'liq o'tdi (**PASSED, Exit code: 0**).

---

## Bosqich 11 Tafsilotlari va Xulosalari

- **Yagona Moliyaviy Domen va Hisob-Kitob Formulalari (`computeDetailedBill`):**
  - **Minor Unit (Tiyin):** Barcha summa hisob-kitoblari qat'iy $1\text{ UZS} = 100\text{ tiyin}$ (BigInt minor unit) da bajariladi; hech qanday suzuvchi nuqta (float) hisob-kitobga kiritilmaydi.
  - **Subtotal:** Barcha `PENDING`, `ACCEPTED`, `PREPARING`, `READY`, `SERVED` taomlar va addonlar narxi qo'shiladi; `CANCELLED` taomlar qat'iy chiqarib tashlanadi.
  - **Chegirma (Discount):** Faqat food subtotalga tegishli bo'lib, subtotaldan oshmaydi (`discount <= subtotal`).
  - **Xizmat Haqi (Service Fee):** Qat'iy ravishda *chegirmadan keyingi food subtotaldan* hisoblanadi: `serviceFee = calculatePercentTiyin(subtotal - discount, serviceChargeBps)`.
  - **Snapshot Xizmat Stavka:** Xizmat foizi tashrif ochilganda `serviceChargeBpsSnapshot` ga muhrlanadi; restoran sozlamasini o'zgartirish eski tashrif hisobini aslo buzmaydi.
  - **Total Due & Balance:** `totalDue = subtotal - discount + serviceFee + signed adjustments`. `netPaid = posted payments - reversals - refunds`. `balance = totalDue - netPaid`.
  - **Negative Balance & Refund Due:** Agar mijoz ko'proq to'lagan bo'lsa yoki keyinchalik chegirma kiritilib `netPaid > totalDue` bo'lsa, `isRefundDue = true` holatiga o'tadi va balans `Math.max(0, balance)` bilan yashirilmaydi. Mijozga pul qaytarilmaguncha tashrif yopilishi server darajasida rad etiladi (`400 REFUND_DUE`).
- **Smena Boshqaruvi va Kassa Reconcile (`ShiftsService`):**
  - Kassir to'lov qabul qilishi uchun uning faol `OPEN` smenasi bo'lishi shart (`400 CASHIER_SHIFT_REQUIRED`).
  - Smena ochish: `startingCashTiyin`.
  - Smena hisoboti: `cashReceiptsTiyin`, `terminalReceiptsTiyin`, `cashRefundsTiyin`, `terminalRefundsTiyin`, `cashReversalsTiyin`, `cashInTiyin`, `cashOutTiyin`.
  - `expectedCash = startingCash + cashReceipts - cashRefunds - cashReversals + cashIn - cashOut`.
  - Smenani sanalgan naqd pul (`countedCashTiyin`) bilan yopish va farqni (`differenceTiyin = counted - expected`) avtomatik hisoblash. Smenani yopish faol tashriflarni yopmaydi.
- **Concurrency va Row-level Lock (`SELECT ... FOR UPDATE`):**
  - Deadlock oldini olish uchun global tartib: Avval `Shift` qatori `FOR UPDATE`, so'ng `Visit` qatori `FOR UPDATE`.
  - Bir vaqtning o'zida ikkita parallel kassa to'lovi yuborilganda ikkalasi birga overpayment qilmaydi. Ikkinchi tranzaksiya yangilangan balansni ko'radi va ortiqcha summa bo'lsa `400 OVERPAYMENT_REJECTED` bilan rad etiladi.
- **Berilgan Naqd Pul vs Kassa Kirimi (Cash Tendered vs Posted Revenue):**
  - To'lovda `tenderedCashTiyin` va `changeTiyin` audit va kassir qulayligi uchun saqlanadi.
  - Ammo kassa tushumiga (`cashReceiptsTiyin`) faqat haqiqiy qabul qilingan summa (`amountTiyin`) yoziladi; mijozga qaytarilgan qaytim aslo daromadga qo'shilmaydi.
- **Xato To'lovni Bekor Qilish (Payment Reversal):**
  - Adashib kiritilgan to'lov sabab ko'rsatilgan holda `REVERSED` qilinadi.
  - Tashrif hisob balansi qayta tiklanadi va smenadagi kassa naqd puli kamaytiriladi (`cashReversalsTiyin`).
- **Pul Qaytarish (Refund) va Yopiq Tashrifga Qaytarish Kompensatsiyasi:**
  - Taom rad etilganda yoki shikoyat bo'lganda to'lov summasidan oshmagan qism qaytariladi (`refunds.approve` huquqi bilan).
  - **Closed Visit Refund Workflow:** Tashrif allaqachon `CLOSED` bo'lgan holatda pul qaytarilganda, tashrif holati `CLOSED` ligicha qoladi va atomik ravishda manfiy `CORRECTION` `BillAdjustment` (`-amountTiyin`) kiritiladi. Natijada `totalDue` va `netPaid` bir xil miqdorda kamayib, `balance = 0` saqlanadi va yopiq tashrifda soxta yangi qarz paydo bo'lmaydi.
- **Aralash To'lovlar (Split Payments):**
  - Bitta hisobni qisman naqd pul va qisman terminal (Humo/Uzcard) orqali to'lash imkoniyati to'liq ishlaydi.
- **Tashrifni Yopish Invariantlari (Close Visit Invariants):**
  - `balance !== 0n` bo'lsa rad etiladi (`UNPAID_BALANCE` yoki `REFUND_DUE`).
  - Yetkazilmagan (`SERVED` yoki `CANCELLED` bo'lmagan) taom mavjud bo'lsa rad etiladi (`ACTIVE_ITEMS_EXIST`).
  - Ochiq xizmat chaqiruvi bo'lsa rad etiladi (`OPEN_CALLS_EXIST`).
  - Barcha shartlar bajarilganda tashrif `CLOSED` bo'ladi, stol statusi **DIRTY** qilib belgilanadi (tozalashga yo'naltiriladi, hech qachon to'g'ridan-to'g'ri FREE bo'lmaydi) va barcha mehmon sessiyalari bekor qilinadi.
- **Frontend Kassa Paneli (`CashierView`):**
  - Ochiq hisoblar qidiruvi va filtrlari (stol va ofitsiant bo'yicha).
  - To'liq hisob tafsiloti va formulalar taqsimoti.
  - Naqd va terminal tanlovi, berilgan naqd pul va real-vaqt qaytim kalkulyatori, tezkor chip tugmalar (+10k, +50k, +100k, +200k).
  - Smena ochish, smenani kassa harakatlari (kirim/chiqim) va farq hisobi bilan yopish modallari.
  - Chop etishga mos pre-check chek modali (aniq eslatma: "Hisob varaqasi (Pre-check). Mazkur hujjat fiskal chek hisoblanmaydi").
- **Sifat Nazorati va Build:**
  - `npm run test --workspace=@menurest/api` — Barcha **62 ta test** 100% muvaffaqiyatli (**PASSED, Exit code: 0**).
  - `npm run typecheck` — Barcha 3 ta paket bo'yicha **0 xato (Exit code: 0)**.
  - `npm run build --workspace=@menurest/web` — Production build **0 xato (Exit code: 0)**.

---

## Bosqich 12 Tafsilotlari va Xulosalari

- **Boss Boshqaruv Paneli va Haqiqiy Moliyaviy KPIlar (`BossDashboardMetrics`):**
  - **Haqiqiy server agregatsiyalari:** Barcha metrikalar demo yoki taxminiy raqamlar emas, balki PostgreSQL bazasidagi `orders`, `payments`, `refunds`, `visits` jadvallarining haqiqiy agregatsiyalaridan hisoblanadi.
  - **Ko'rsatkichlar:**
    - Bugungi buyurtmalar qiymati: `todayOrdersTotalTiyin` (barcha tasdiqlangan/faol buyurtmalar subtotal yig'indisi).
    - Berilgan chegirmalar: `todayDiscountsTiyin`.
    - Xizmat haqi: `todayServiceChargeTiyin`.
    - Qabul qilingan yalpi to'lov: `grossPaymentsTiyin` (barcha `POSTED` to'lovlar).
    - Qaytarilgan pullar: `refundsTiyin` (barcha tasdiqlangan refundlar).
    - Sof tushum: `netRevenueTiyin = grossPaymentsTiyin - refundsTiyin`.
    - Ochiq qarzdorlik: `openDebtTiyin` (faol tashriflarning to'lanmagan ijobiy qoldig'i).
    - Qaytarilishi kerak bo'lgan qoldiq: `refundDueTiyin` (ortiqcha to'langan yoki buyurtmasi bekor bo'lgan faol tashriflarning manfiy balansi mutlaq qiymati).
    - Faol tashriflar soni: `activeVisitsCount`.
  - **Qat'iy biznes qoidasi:** Xarajat/tannarx (COGS) moduli mavjud bo'lmagani sababli, "sof foyda" (net profit) raqami ASLO yasalmadi va ko'rsatilmadi.
- **Manager Operatsion Paneli va Jonli Zal Nazorati (`ManagerOperationsSummary`):**
  - Jonli zal va stollar xaritasi: `occupiedTables`, `dirtyTables`, `freeTables`.
  - Buyurtmalar monitoringi: `activeOrdersCount`.
  - Kechikkan taomlar: 20 daqiqadan ortiq tayyorlanayotgan taomlar shoshilinch qizil indikator bilan ajratiladi (`delayedOrdersCount`).
  - Javobsiz chaqiruvlar: 3 daqiqadan oshgan ochiq va biriktirilmagan mijoz chaqiruvlari (`unansweredCallsCount`).
  - Stollar bo'yicha ofitsiant biriktirish va menyu mavjudligi (`isAvailable`) nazorati.
  - Moliyaviy vakolatlar: Chegirma (`discounts.approve`) va pul qaytarish (`refunds.approve`) faqat Boss bergan ruxsat doirasida ishlaydi.
- **Xodimlar Boshqaruvi va Huquqlar Eskalatsiyasini To'sish (`StaffService`):**
  - Xodimlarni yaratish, tahrirlash, parolini o'zgartirish va faolsizlantirish.
  - Bitta xodimga bir nechta rol biriktirish (`membershipRoles`).
  - Tayyorlash stansiyalari (`StaffStationAssignment`) va stollarni biriktirish (`assignedWaiterId`).
  - **Eskalatsiyadan Himoyalanish (Security Guards):**
    - Manager boshqa xodimga o'zida yo'q yuqori rolni (Boss, SuperAdmin) bera olmaydi (`403 PRIVILEGE_ESCALATION_FORBIDDEN`).
    - Manager o'z-o'ziga qo'shimcha vakolat qo'sha olmaydi (`403 SELF_ESCALATION_FORBIDDEN`).
    - Xodim huquqi o'zgarganda yoki faolsizlantirilganda uning `tokenVersion` qiymati avtomatik oshirilib, mavjud ochiq JWT sessiyalari darhol `401 UNAUTHORIZED` bilan bekor qilinadi.
- **Restoran Sozlamalari va O'zgarmaslik Kafolati (`SettingsService`):**
  - Restoran nomi, logotipi, banneri, aloqa telefon/manzillari, ish vaqti (`openingHours`), asosiy tili va xizmat haqi stavkasi (`serviceChargeBps`).
  - **Immutability Invariant:** Restoranning xizmat haqi stavkasi (masalan, 10% dan 15% ga) o'zgartirilganda, mavjud ochiq va yopiq tashriflarning snapshot stavkasi (`serviceChargeBpsSnapshot`) aslo o'zgarmaydi! Har bir tashrif o'zi ochilgan paytdagi foiz stavkasini butun saqlab qoladi (test Section 68 bilan isbotlandi).
- **Hisobotlar va Asia/Tashkent Kun Chegarasi (`ReportsService`):**
  - Kun chegarasi qat'iy ravishda `Asia/Tashkent` (UTC+5) kalendar kuni bo'yicha hisoblanadi (Toshkent vaqti bilan 00:00:00 dan 23:59:59.999 gacha).
  - **Sanalarni mustaqil ajratish:** To'lov sanasi (`payment.createdAt`) va buyurtma sanasi (`order.createdAt`) bir-biri bilan aslo adashtirilmaydi. Kecha berilgan buyurtmaga bugun to'langan to'lov bugungi kassa tushumiga kiradi, ammo bugungi buyurtmalar ro'yxatiga kirmaydi.
  - Ommabop taomlar reytingi (miqdor va tushum bo'yicha) hamda ofitsiantlar xizmat ko'rsatkichlari (xizmat ko'rsatilgan stollar, chaqiruvlar va tushum).
- **Audit Jurnali va Formula Injection Himoyasi (`AuditService`):**
  - Kim, qachon, qaysi restoran, qaysi resurs, qanday amal, sabab va holat o'zgarishi jurnali.
  - **Maxfiylik sanitizatsiyasi:** Parol, token, session sirli kalitlar kabi nozik maydonlar skanerlanib, xavfsiz `[REDACTED]` belgisi bilan almashtiriladi.
  - **CSV Export Formula Injection Himoyasi:** `=`, `+`, `-`, `@`, `\t`, `\r`, `%` belgilari bilan boshlanuvchi har qanday yacheyka qiymati oldiga bittalik tirnoq (`'`) qo'shilib zararsizlantiriladi va barcha matnlar qo'sh tirnoq bilan o'raladi (`escapeCsvCell`).
- **Sifat Nazorati va Build:**
  - `npm run test --workspace=@menurest/api` — Barcha **69 ta test** 100% muvaffaqiyatli (**PASSED, Exit code: 0**).
  - `npm run typecheck` — Barcha 3 ta paket bo'yicha **0 xato (Exit code: 0)**.
  - `npm run build --workspace=@menurest/web` — Production build **0 xato (Exit code: 0)**.

---

## Bosqich 13 Tafsilotlari va Xulosalari (Platforma Boshqaruvi va Super Admin)

- **Super Admin Autentifikatsiyasi va Texnik Monitoring (`PlatformService`):**
  - Super admin foydalanuvchisi (`isSuperAdmin = true`) platformaning texnik holatini kuzatadi (`GET /api/v1/platform/overview`).
  - Tizim salomatligi ko'rsatkichlari: PostgreSQL ma'lumotlar bazasi ulanishi holati (`dbConnected`), tizim uptime vaqti (`uptimeSeconds`), jami restoranlar, faol restoranlar, bugungi global buyurtmalar va jami foydalanuvchilar soni.
  - Xatolar va hodisalar jurnali (`recentTechnicalEvents`): Outbox va xatoliklar monitoringi.
  - **Qat'iy xavfsizlik chegarasi:** Oddiy xodimlar yoki restoran egalari (Manager, Waiter, Cashier, Boss) platforma monitoringiga kira olmaydi (`403 SUPER_ADMIN_REQUIRED`).
- **Restoran va Boss Membership Yaratish:**
  - Super admin yangi restoran yaratadi (`POST /api/v1/platform/restaurants`): nomi, takrorlanmas slug, tarif rejasi (manual metadata: `STARTER`, `PRO`, `ENTERPRISE`), xizmat muddati (`subscriptionExpiresAt`) hamda birinchi egasi (`ownerName`, `ownerPhone`, `ownerPassword`).
  - Restoran bilan birga avtomatik ravishda `BOSS` roli va a'zoligi (`RestaurantMembership`) yaratiladi.
  - **Izolyatsiya:** Yangi yaratilgan Boss faqat o'z restoranining ma'lumotlarini ko'ra oladi; boshqa restoran ma'lumotlariga yoki platforma boshqaruviga ruxsatsiz kira olmaydi (`404 NOT_FOUND` va `403 SUPER_ADMIN_REQUIRED`).
- **Restoran Xizmat Holati va To'xtatish (Suspension / Expiry) Siyosati:**
  - Super admin restoranni `ACTIVE` yoki `SUSPENDED` holatiga o'tkazishi mumkin (`PATCH /api/v1/platform/restaurants/:id/status`).
  - Restoranni to'xtatishda majburiy sabab ko'rsatilishi shart (`reason`); sababsiz to'xtatish rad etiladi (`400 REASON_REQUIRED`).
  - **Qat'iy Invariantlar (Graceful Wind-down / Drain):**
    - Suspended restoranda **YANGI** tashrif ochish bloklanadi (`403 RESTAURANT_SUSPENDED`).
    - Suspended restoranda **YANGI** buyurtma kiritish bloklanadi (`403 RESTAURANT_SUSPENDED`).
    - **Ruxsat berilgan operatsiyalar (Xavfsiz yakunlash):** Allaqachon qabul qilingan taomlarni oshxonada tayyorlash (`KDS prepare/ready`), ofitsiant tomonidan mehmonga yetkazish (`serve`), kassada mavjud tashrif hisobiga to'lov qabul qilish (`payment`) va pul qaytarish (`refund`), hamda tashrifni xavfsiz yopish (`close-visit`).
    - Faol ma'lumotlar aslo o'chirilmaydi; xodimlar interfeysida restoran xizmati to'xtatilgani haqida ogohlantirish banneri ko'rinadi.
- **Vaqtinchalik Texnik Yordam Rejimi (Support Mode / Impersonation):**
  - Super admin sessiyasi barcha restoranlarning moliyaviy ma'lumotlariga avtomatik cheksiz kirish huquqiga ega **EMAS**; to'g'ridan-to'g'ri kirish taqiqlanadi (`403 SUPPORT_SESSION_REQUIRED`).
  - Zarurat tug'ilganda Super admin sabab, amal qilish muddati va ruxsat turini ko'rsatib vaqtinchalik yordam sessiyasi ochadi (`POST /api/v1/platform/restaurants/:id/support-session`).
  - Maxsus bir martalik `supportToken` (SHA-256 xesh bilan saqlanuvchi) chiqariladi va HTTP sarlavhasida (`X-Support-Token`) uzatiladi.
  - **Default Read-Only Guard:** Yordam sessiyasi standart holatda faqat o'qish (read-only) huquqiga ega; o'zgartirish (mutatsiya) urinishlari serverda bloklanadi (`403 SUPPORT_READ_ONLY`).
  - Muddati tugagan yoki bekor qilingan (`revoke`) token bilan kirish rad etiladi (`403 SUPPORT_SESSION_EXPIRED`).
  - **Haqiqiy Actor Kafolati:** Barcha audit yozuvlarida haqiqiy bajaruvchi sifatida `SUPER_ADMIN` qayd etiladi; Boss nomidan soxta audit tarixi yozilmaydi.
- **Platforma Boshqaruv Interfeysi (`SuperAdminView.tsx`):**
  - Restoranlar ro'yxati, real vaqtda qidiruv va status bo'yicha filtrlar.
  - Restoran kartasi: egasi, status (`ACTIVE` / `SUSPENDED`), obuna tarifi va amal qilish muddati.
  - Yangi restoran yaratish modali, statusni o'zgartirish (sabab kiritish talabi bilan) modali.
  - Vaqtinchalik support token yaratish va bekor qilish boshqaruvi.
  - Platforma audit jurnali va texnik hodisalar ro'yxati (parollar, sirli tokenlar va nozik ma'lumotlar sanitizatsiya qilingan).
  - **Qat'iy xavfsizlik cheklovi:** Restoranni butunlay o'chirib yuboradigan (hard delete) kundalik xavfli tugma umuman mavjud emas.
- **Sifat Nazorati va Testlar:**
  - `npm run test --workspace=@menurest/api` — Barcha **76 ta integratsiya va invariant testlari** 100% muvaffaqiyatli (**PASSED, Exit code: 0**).
  - `npm run typecheck` — Barcha paketlar bo'yicha **0 xato (Exit code: 0)**.
  - `npm run build` — Barcha paketlar bo'yicha toza production build (**Exit code: 0**).

---

## Bosqich 14 Tafsilotlari va Xulosalari (To'liq Jarayonni Tekshirish va Invariantlar)

- **To'liq Siklli End-to-End Jarayon (Life-cycle verification):**
  - Mehmon menyusi (QR opaque token orqali kirish) -> Stol holati atomik yangilanishi (`FREE -> OCCUPIED`) -> Faol tashrif ochilishi -> 4 xonali kod bilan ko'p telefonli mehmon ulanishi.
  - Server-authoritative narx snapshotlari bilan savatcha va buyurtma yaratish (klient narxiga ishonilmaydi, double-click scoped idempotency).
  - Ofitsiant paneli: yangi buyurtmalarni ko'rish, tasdiqlash (`NEW -> CONFIRMED`), oshxonaga yuborish.
  - KDS (Oshxona va Bar): Stansiyalar bo'yicha mustaqil ajratish (Issiq oshxona va Bar), taom holati sikli (`ACCEPTED -> PREPARING -> READY`), sababli rad etish va hisobdan chiqarish nazorati.
  - Ofitsiant tomonidan tayyor taomni mehmonga yetkazish (`READY -> SERVED`).
  - Kassa va billing: Tiyin minor unit (1 UZS = 100 tiyin) qat'iy hisobi, xizmat haqi va chegirmalar, smena balansi, qisman to'lovlar (split billing), pre-check cheki, kassa tushumi va qaytim hisobi.
  - Tashrifni yopish: To'liq to'langan tashrif yopilganda stol avtomatik ravishda `DIRTY` (tozalash kutilmoqda) holatiga o'tadi; ofitsiant stolni tozalab bo'lgach `FREE` ga o'tkazadi.
  - Boss va Manager paneli: Asia/Tashkent kun chegarasida real kassa tushumi, o'rtacha chek va KPIlar hisoblanishi.
  - Platforma nazorati: Super Admin texnik monitoringi, yangi restoran ochish, suspension siyosati (graceful wind-down) va support mode (read-only guard).
- **Parallel Poyga va Concurrency Sinovlari (Race Conditions):**
  - **Chaqiruvlar (Service Calls):** 2 nafar ofitsiant bir vaqtda bitta chaqiruvni qabul qilishga uringanda, ma'lumotlar bazasi shartli atomik yangilanishi orqali faqat bittasi g'olib chiqadi (`200 OK`), ikkinchisi esa xavfsiz rad etiladi (`409 CALL_ALREADY_CLAIMED`).
  - **Parallel To'lovlar (Overpayment Prevention):** 2 nafar kassir bir vaqtda bitta tashrif hisobiga to'lov qabul qilishga uringanda, `SELECT FOR UPDATE` qator qulfi orqali hisob summasidan ortiq to'lov qabul qilish darhol bloklanadi (`400 OVERPAYMENT_REJECTED`).
  - **Takroriy Tashrif va Smena:** PostgreSQL qisman noyob indekslari (`idx_unique_active_visit_per_table`, `idx_unique_active_shift_per_user`) orqali bitta stolda birdaniga 2 ta faol tashrif yoki bitta foydalanuvchida 2 ta ochiq smena ochilishiga yo'l qo'yilmaydi.
- **Xavfsizlik va Ma'lumotlar Butunligi:**
  - Multi-tenant izolyatsiyasi: boshqa restoranning resurslariga qilingan barcha so'rovlar resursni oshkor qilmasdan `404 NOT_FOUND` bilan rad etiladi.
  - RBAC va eskalatsiya himoyasi: xodimlar o'z huquqidan yuqori rol bera olmaydi yoki o'z vakolatini oshira olmaydi.
  - Audit maxfiyligi: parollar va sirli tokenlar audit jurnalidan sanitizatsiya qilinadi; CSV eksporti formula injectiondan to'liq himoyalangan (`escapeCsvCell`).
- **Sifat Nazorati va Natijalar:**
  - Maxsus QA Runner (`apps/api/src/qa-stage14.ts` - `npm run test:qa`): Barcha 28 ta majburiy QA integratsiya va concurrency poyga ssenariylari to'liq o'tdi (**ALL 28 PASSED, Exit code: 0**).
  - To'liq birlashgan test suite (`apps/api/src/test.ts` - `npm run test`): Barcha 77 ta bo'lim to'liq o'tdi (**ALL 77 PASSED, Exit code: 0**).
  - Multi-process concurrency testi (Ssenariy 17): port 4000 (asosiy server) va port 4099 (mustaqil child OS process) orqali haqiqiy 2 ta DB connection pool bilan parallel to'lov yuborilib, `SELECT FOR UPDATE` va moliyaviy invariantlar (0% overpayment) amalda isbotlandi.
  - QA jarayonida 5 ta kritik defekt aniqlanib tuzatildi (DEF-06 `openVisit` table lock, DEF-07 `recordPayment` closed shift guard, DEF-08 row-locked payment idempotency, DEF-09 `visitsService` va `billingService` moliyaviy arifmetikasi unifikatsiyasi, DEF-10 stale session verification).

---

## Bosqich 15 Tafsilotlari va Xulosalari (Ishga Tushirishga Tayyorlash va Hujjatlar)

- **Ishlab Chiqarish va Staging Arxitekturasi (`docs/deployment.md`):**
  - Server talablari (Staging va Production) va tavsiya etilgan resurslar.
  - Node.js, PM2 klaster boshqaruvi va PostgreSQL 16+ sozlamalari.
  - Nginx Reverse Proxy konfiguratsiyasi:
    - Frontend va Backend marshrutlash.
    - **SSE (Server-Sent Events) Maxsus Sozlamalari:** `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 3600s`, `chunked_transfer_encoding on` orqali real-vaqtda jonli uzilishsiz hodisalar oqimi kafolatlandi.
    - **HTML5 History API Fallback:** `/table/:qrToken` chuqur havolalari (deep links) Nginx `try_files $uri $uri/ /index.html;` orqali to'g'ri ishlaydi.
  - SSL/TLS Let's Encrypt (Certbot) va avtomatlashtirilgan yangilanish.
  - Dinamik CORS va Guest QR Origin: `process.env.CORS_ORIGIN` va `process.env.FRONTEND_URL` bilan sozlangan.
  - Nol uzilishli (Zero-downtime) yangilanish va avariyaviy qaytish (Rollback) rejasi.
- **Xavfsizlik va Bootstrap Vositalari:**
  - **Super Admin Bootstrap CLI (`npm run bootstrap:superadmin`):** Kamida 10 ta belgili kuchli parol validatsiyasi, bcrypt xesh, yagona super admin blokirovkasi (`--force` talabi) va audit jurnali integratsiyasi.
  - **Demo Seed Blokirovkasi:** `NODE_ENV=production` bo'lganda `npm run seed` ishga tushishi to'xtatildi (`DEMO_SEED_BLOCKED_IN_PRODUCTION`).
  - **Kuzatuvchanlik va Sekin So'rovlar:** Har bir so'rovga `X-Request-Id` UUID v4 biriktirildi, 1000ms dan sekin so'rovlar uchun `[SLOW_QUERY_ALERT]` ogohlantirish logi yoqildi, parollar va tokenlar logdan sanitizatsiya qilindi.
- **Operatsiyalar, Zaxiralash va Monitoring Qo'llanmasi (`docs/operations.md`):**
  - PostgreSQL zaxiralash (`pg_dump -Fc` binary custom format) va tiklash (`pg_restore --clean --if-exists`).
  - Foydalanuvchilar yuklagan fayllar (`uploads/`) zaxira nusxasi va tiklanishi.
  - Kunlik avtomatlashtirilgan cron skripti va 14 kunlik rotatsiya siyosati.
  - Texnik salomatlik tekshiruvi: `/health` (liveness) va `/ready` (readiness - DB ulanishi).
  - Outbox Crash Recovery: Server to'xtab qolganda yoki qayta yoqilganda bazadagi yuborilmay qolgan real-time hodisalarni xavfsiz qayta ishlash va tiklash algoritmi.
  - Performance Smoke Test: `npm run perf:smoke` orqali p50: ~25ms, p95: ~86ms, 0 xato o'lchovlari tasdiqlandi.
- **Frontend va Bosma QR Karta:**
  - `@media print` uslubi `#printable-qr-card` uchun sozlandi: stol QR kartasini brauzerdan toza va professional chop etish.
  - Demo ko'rinish va haqiqiy API sessiyasi o'rtasida aniq ajratish (`DEMO PREVIEW (ROL KO'RISH REJIMI)`).
- **Foydalanuvchi Qo'llanmasi (`docs/user-guide-uz.md`):**
  - Barcha 7 ta rol uchun batafsil o'zbek tilidagi bosqichma-bosqich yo'riqnoma:
    1. **Mehmon (Guest):** QR kodni skanerlash, menyuni ko'rish, taom tanlash, buyurtma berish, ofitsiantni chaqirish va hisob so'rash.
    2. **Ofitsiant (Waiter):** Chaqiruvlarni qabul qilish, yangi buyurtmalarni tasdiqlash, tayyor taomlarni yetkazish, stollarni tozalash (`DIRTY -> FREE`).
    3. **Oshxona va Bar (KDS):** Chiptalarni ko'rish, tayyorlashni boshlash (`PREPARING`), tayyor deb belgilash (`READY`), stansiyalar bo'yicha ishlash.
    4. **Kassir (Cashier):** Smenani ochish va yopish, hisobni tekshirish, split to'lovlar, kassa kirimi va qaytim hisobi, pre-check chiqarish, tashrifni yopish.
    5. **Menejer (Manager):** Zaldagi stollar va ofitsiantlar harakati, kechikkan taomlar va javobsiz chaqiruvlar nazorati, menyu availability boshqaruvi, xodimlar smenasi.
    6. **Restoran Egasi (Boss):** Asia/Tashkent kunlik sof tushum, xizmat haqi, o'rtacha chek va KPIlar, restoran sozlamalari, audit jurnali va CSV eksport.
    7. **Platforma Super Admini (Super Admin):** Tizim texnik salomatligi, yangi restoran ochish, to'lov muddati o'tganda xizmatni to'xtatish (suspension), vaqtinchalik yordam sessiyasi (support mode).
- **Loyiha Bosh Hujjati (`README.md`):**
  - Monorepo arxitekturasi, tezkor ishga tushirish qadamlari, muhit o'zgaruvchilari, test buyruqlari, qat'iy biznes qoidalari va xavfsizlik choralari bilan to'liq yangilandi.

---

## Hozirgi Tizim Holati
- **Bajarilgan bosqichlar:** 0 dan 15 gacha bo'lgan barcha 16 ta bosqich to'liq yakunlandi va amaliy test dalillari bilan isbotlandi.
- **Avtomatlashtirilgan testlar:** Barcha 78 ta integratsiya, xavfsizlik, concurrency va invariant testlari hamda 28 ta QA ssenariylari to'liq o'tdi (**ALL PASSED, Exit code: 0**).
- **Kechikish va Yuklama:** `npm run perf:smoke` — p50: ~25ms, p95: ~86ms, 0 ta xatolik (**Exit code: 0**).
- **TypeScript & Build:** Typecheck va Production build barcha 3 ta paket bo'yicha 0 xato bilan o'tdi (**Exit code: 0**).
- **Git Cheklovi:** Hech qanday masofaviy `git push` bajarilmadi (qoidaga 100% qat'iy rioya qilindi; ishlab chiqarishga chiqarish faqat foydalanuvchi roziligi va hosting/domain tasdig'i bilan amalga oshiriladi).





