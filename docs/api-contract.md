# MENUREST.UZ — API Shartnomasi va Xatolar Standarti (API Contract)

Ushbu hujjat **menurest.uz** REST API so'rovlari va javoblarining yagona formati, HTTP status kodlari, xatoliklar standarti, sahifalash (pagination) va idempotentlik qoidalarini belgilaydi.

---

## 1. Yagona Javob Zarfı (Response Envelopes)

Barcha API javoblari yagona JSON strukturasiga ega bo'ladi.

### 1.1. Muvaffaqiyatli Javob (Success Envelope)
```json
{
  "success": true,
  "data": {
    "id": "vis_01j7abc123",
    "status": "ACTIVE",
    "tableId": "tbl_01j7xyz456"
  },
  "meta": {
    "timestamp": "2026-10-08T20:55:00.000+05:00",
    "requestId": "req_01j7req789"
  }
}
```

Ro'yxatlar (List) uchun sahifalash metama'lumotlari:
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "timestamp": "2026-10-08T20:55:00.000+05:00",
    "requestId": "req_01j7req789",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 45,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 1.2. Xatolik Javobi (Error Envelope)
Har bir xatolik mashina o'qishi uchun barqaror `code` va foydalanuvchi interfeysida ko'rsatish uchun tushunarli o'zbek tilidagi `message`ga ega:
```json
{
  "success": false,
  "error": {
    "code": "VISIT_NOT_PAYABLE",
    "message": "Tashrifda yetkazilmagan taomlar mavjud. Avval taomlar yetkazilishi yoki bekor qilinishi shart.",
    "details": [
      {
        "field": "unservedItems",
        "issue": "OrderItem #12 holati PREPARING"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-10-08T20:55:00.000+05:00",
    "requestId": "req_01j7req789"
  }
}
```

---

## 2. HTTP Status Kodlari va Mashina Xato Kodlari

| HTTP Status | Standart Xato Kodi | Tavsifi va Qachon Ishlatilishi |
| :---: | :--- | :--- |
| **`400`** | `BAD_REQUEST` | So'rov sintaksisi xato, noto'g'ri JSON formati. |
| **`422`** | `VALIDATION_ERROR` | Maydonlar noto'g'ri to'ldirilgan (masalan, telefon formati xato, manfiy narx). |
| **`401`** | `UNAUTHORIZED` | Avtorizatsiya tokeni berilmagan, eskirgan yoki haqiqiy emas. |
| **`403`** | `FORBIDDEN` | Foydalanuvchida ushbu amalni bajarishga yetarli vakolat (rol) yo'q. |
| **`404`** | `NOT_FOUND` | Resurs topilmadi yoki ushbu tenantga (`restaurantId`) tegishli emas. |
| **`409`** | `STATE_CONFLICT` | Ob'yektning joriy holati o'zgargan (masalan, yopilgan tashrifga to'lov urish, stol allaqachon band). |
| **`409`** | `IDEMPOTENCY_CONFLICT` | Bir xil `Idempotency-Key` bilan boshqa parametrli so'rov yuborildi. |
| **`429`** | `RATE_LIMIT_EXCEEDED` | So'rovlar soni cheklovdan oshib ketdi. |
| **`500`** | `INTERNAL_SERVER_ERROR` | Kutilmagan server xatoligi (batafsil ma'lumot xavfsizlik uchun yashiriladi). |

### Asosiy Domen Xato Kodlari Ro'yxati:
- `AUTH_INVALID_CREDENTIALS`: "Telefon raqami yoki parol noto'g'ri."
- `AUTH_SESSION_EXPIRED`: "Sessiya muddati tugadi. Tizimga qayta kiring."
- `TENANT_INACTIVE`: "Restoran faoliyati vaqtincha to'xtatilgan."
- `TABLE_ALREADY_OCCUPIED`: "Bu stolda faol tashrif mavjud."
- `VISIT_NOT_ACTIVE`: "Tashrif allaqachon yopilgan yoki bekor qilingan."
- `VISIT_HAS_BALANCE`: "Tashrifni yopish uchun qoldiq summa 0 bo'lishi shart."
- `VISIT_HAS_PENDING_CALLS`: "Barcha ofitsiant chaqiruvlari hal qilinmagan."
- `VISIT_HAS_UNSERVED_ITEMS`: "Yetkazilmagan taomlar mavjud."
- `ITEM_CANCELLATION_FORBIDDEN`: "Tayyorlanayotgan taomni faqat Manager yoki Boss bekor qila oladi."
- `SERVED_ITEM_CANNOT_BE_CANCELLED`: "Yetkazilgan taomni bekor qilib bo'lmaydi, moliyaviy tuzatish zarur."
- `PAYMENT_EXCEEDS_BALANCE`: "Kiritilgan to'lov summasi qoldiqdan ko'p."
- `SHIFT_NOT_OPEN`: "Kassirning faol smenasi ochilmagan."

---

## 3. Idempotentlik (Idempotency) Standarti

Pulga va buyurtmaga ta'sir qiluvchi barcha `POST` so'rovlarida `Idempotency-Key` sarlavhasi (header) majburiydir:
- **Header:** `Idempotency-Key: <UUIDv4>` (masalan: `Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`).
- **Ishlash mexanizmi:**
  1. Agar `Idempotency-Key` birinchi marta kelsa: operatsiya bajariladi, natija va hash bazaga saqlanadi.
  2. Agar aynan bir xil kalit va bir xil so'rov tanasi (body hash) bilan takror kelsa: server operatsiyani qayta bajarmasdan o'tgan tayyor javobni qaytaradi.
  3. Agar bir xil kalit bilan boshqacha payload kelsa: server darhol `409 IDEMPOTENCY_CONFLICT` qaytaradi.

---

## 4. Asosiy API Yo'nalishlari (Endpoints Overview)

### 4.1. Auth & Staff (`/api/v1/auth`)
- `POST /auth/login` — Xodim tizimga kirishi (telefon, parol).
- `POST /auth/refresh` — Tokenni yangilash.
- `POST /auth/logout` — Tizimdan chiqish.
- `GET /auth/me` — Joriy xodim profili va rollari.

### 4.2. Guest Session & QR (`/api/v1/guest`)
- `POST /guest/session/join` — QR va PIN orqali faol tashrifga ulanish.
- `GET /guest/menu` — Restoran menyusini ko'rish (UZ/RU).
- `GET /guest/visit/status` — Mehmonning o'z faol stoli va buyurtmalari holati.
- `POST /guest/orders` — Savatdan yangi buyurtma yuborish (`Idempotency-Key` bilan).
- `POST /guest/service-calls` — Ofitsiant yoki hisob chaqirish.

### 4.3. Waiter Operations (`/api/v1/waiter`)
- `GET /waiter/tables` — Stollar ro'yxati va holatlari (`FREE`, `OCCUPIED`, `DIRTY`).
- `POST /waiter/visits/open` — Yangi tashrif ochish (stolda).
- `POST /waiter/orders/{orderId}/confirm` — Mehmon buyurtmasini tasdiqlash.
- `POST /waiter/order-items/{itemId}/serve` — Taomni mehmonga yetkazilgan deb belgilash.
- `POST /waiter/tables/{tableId}/clean` — Stol tozalanganini tasdiqlash (`DIRTY` → `FREE`).
- `POST /waiter/service-calls/{callId}/ack` — Chaqiruvni qabul qilish / hal qilish.

### 4.4. Kitchen Display System (`/api/v1/kds`)
- `GET /kds/tickets` — Stansiyaga tegishli faol taomlar chiptalari.
- `POST /kds/order-items/{itemId}/start` — Taomni tayyorlashni boshlash (`PREPARING`).
- `POST /kds/order-items/{itemId}/ready` — Taomni tayyor deb belgilash (`READY`).

### 4.5. Cashier & Shifts (`/api/v1/cashier`)
- `POST /cashier/shifts/open` — Yangi kassa smenasini ochish.
- `POST /cashier/shifts/close` — Smenani yopish va Z-report shakllantirish.
- `GET /cashier/visits/{visitId}/bill` — Tashrif hisob-kitob varaqasi (Subtotal, xizmat haqi, chegirma, to'langan, qoldiq).
- `POST /cashier/visits/{visitId}/payments` — To'lov qabul qilish (Naqd/Terminal/Aralash).
- `POST /cashier/visits/{visitId}/close` — Tashrifni to'liq yopish (barcha shartlar bajarilganda).

### 4.6. Manager & Boss (`/api/v1/management`)
- `GET /management/reports/summary` — Kunlik moliyaviy tahlil.
- `POST /management/order-items/{itemId}/cancel` — Tayyorlanayotgan taomni asosli sabab bilan bekor qilish.
- `POST /management/visits/{visitId}/adjustments` — SERVED taomga auditli moliyaviy tuzatish kiritish.
- `CRUD /management/menu/*` — Taomlar, kategoriyalar, narxlar va qo'shimchalar.
- `CRUD /management/tables/*` — Stollar va zonalar.
- `CRUD /management/staff/*` — Xodimlar va rollar.
