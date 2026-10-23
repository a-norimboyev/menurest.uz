# MENUREST.UZ — Ekspluatatsiya va Operatsion Xizmat Qo'llanmasi (Operations Guide)

Ushbu qo'llanma tizim ma'murlari (DevOps/SRE) va texnik qo'llab-quvvatlash muhandislari uchun zaxiralash (backup), tiklash (restore), sog'lik monitoringi, audit va uzilishlardan keyingi tiklanish jarayonlarini belgilaydi.

---

## 1. Ma'lumotlar Bazasi Zaxiralash (Database Backup)

### Avtomatik Kundalik Zaxira Skripti
PostgreSQL ma'lumotlar bazasini har kuni Asia/Tashkent vaqti bilan 04:00 da zaxiralash (cron):

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/menurest/postgres"
DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/menurest_prod_$DATE.dump"
DB_NAME="menurest_prod"
DB_USER="menurest_prod_user"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Zaxiralash boshlandi: $FILENAME"
pg_dump -U "$DB_USER" -h localhost -p 5432 -d "$DB_NAME" -F c -b -v -f "$FILENAME"

# 14 kundan eski zaxira nusxalarini o'chirish (retention policy)
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +14 -delete
echo "[$(date)] Zaxiralash muvaffaqiyatli yakunlandi."
```

### Zaxira Nusxani Qayta Tiklash (Database Restore)

> [!WARNING]
> Tiklash jarayoni joriy ma'lumotlar bazasini to'liq qayta yozishi mumkin. Avval mavjud holatning snapshotini saqlab oling.

```bash
# 1. Tiklanadigan yangi bo'sh bazani yaratish yoki mavjud ulanishlarni uzish
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'menurest_prod';"

# 2. pg_restore orqali ma'lumotlarni qayta tiklash
pg_restore -U menurest_prod_user -h localhost -p 5432 -d menurest_prod -v --clean --if-exists /var/backups/menurest/postgres/menurest_prod_20261009_040000.dump

# 3. Prisma migratsiyalarining to'g'riligini tekshirish
npx prisma migrate status
```

---

## 2. Rasmlar va Statik Fayllarni Zaxiralash (Uploads Backup)

Taomlar va restoran logotiplari saqlanadigan `uploads/` katalogini zaxiralash:

```bash
# Rclone yoki rsync orqali sovuq xotiraga (S3/Object Storage) uzatish:
rsync -avz --delete /var/www/menurest/apps/api/uploads/ /var/backups/menurest/uploads/
```

Tiklash:
```bash
rsync -avz /var/backups/menurest/uploads/ /var/www/menurest/apps/api/uploads/
```

---

## 3. Tizim Monitoringi va Sog'lik Tekshiruvlari (Health & Monitoring)

### 3.1. Liveness va Readiness Endpoints
- **Liveness:** `GET /health` — Node.js jarayoni tirikligini tekshiradi (Uptime).
- **Readiness:** `GET /ready` — PostgreSQL ulanishi, tranzaksiyalar tayyorligi va outbox holatini tekshiradi. Agar baza uzilgan bo'lsa `503 SERVICE_UNAVAILABLE` qaytaradi.
- **Platform Texnik Monitoring:** `GET /api/v1/platform/overview` — Super Admin uchun DB latency, memory usage (heap), faol restoranlar va Outbox queue monitoringi.

### 3.2. Sekin So'rovlar va Kechikish Nazorati (Slow Query & Performance Alerting)
- **API Darajasida:** Express request correlation middleware har bir so'rov bajarilish vaqtini o'lchaydi. Agar so'rov 1000 ms dan ortiq davom etsa, konsolga darhol `[SLOW_QUERY_ALERT]` ogohlantirish logi chiqariladi (so'rov yo'li, metod, bajarilish vaqti va korrelyatsiya IDsi bilan).
- **PostgreSQL Darajasida:** `postgresql.conf` da:
```ini
log_min_duration_statement = 200 # 200 ms dan uzoq davom etgan querylarni logga yozish
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

### 3.3. So'rovlarni Bog'lash va Kuzatuvchanlik (Request Correlation: `X-Request-Id`)
- Har bir kiruvchi HTTP so'rovga noyob UUID v4 `X-Request-Id` biriktiriladi (agar mijoz sarlavhada yuborgan bo'lsa, mavjud ID saqlanadi).
- Mazkur ID barcha server loglariga kiritiladi va HTTP javob sarlavhasi sifatida mijozga qaytariladi (`res.setHeader('X-Request-Id', requestId)`).
- Front-end va mobil mijozlar xatolik yuz berganda ushbu `X-Request-Id` orqali server loglaridagi aynan o'sha hodisani aniq izlab topishlari mumkin.

### 3.4. Loglarda Maxfiylik Kafolati (No Secrets in Logs)
- Foydalanuvchi parollari (`password`, `passwordHash`), JWT tokenlar (`authorization`, `menurest_session`), mehmon sessiya tokenlari va kirish PIN kodlari hech qachon server loglariga yoki audit jurnallariga ochiq matn (plain-text) ko'rinishida yozilmaydi.
- Loglovchi middleware va audit jurnali nozik qiymatlarni avtomatik tarzda `[REDACTED]` belgisi bilan almashtiradi.

### 3.5. Yengil Yuklama va Kechikish Smoke Testi (`npm run perf:smoke`)
Tizim ishga tushirilishidan oldin va yangilanishlardan so'ng quyidagi amaliy kechikish testi yuritiladi:
```bash
npm run perf:smoke
```
Ushbu skript:
1. Public ochiq menyu o'qish (p50: ~15-20ms).
2. Stol holati va tashrif o'qish (p50: ~15-25ms).
3. Super admin sahifalangan platforma querylari (p50: ~20-30ms).
4. Bir vaqtning o'zida 10 ta parallel ommaviy menyu so'rovlari (p95: ~50-85ms).
5. Kassa hisob-kitob va yig'ma moliyaviy so'rovlar (N+1 muammosisiz).
Kechikish ko'rsatkichlari (p50, p95, p99) va xatoliklar sonini o'lchab, hisobot beradi.

---

## 4. Uzilishlardan Keyingi Tiklanish (Disaster Recovery & Crash Recovery)

### 4.1. Tranzaksion Outbox Crash Recovery
Agar server kutilmaganda restart bo'lsa yoki tok uzilsa:
- Barcha real-vaqt hodisalari PostgreSQL tranzaksiyasi bilan birga `outbox_events` jadvaliga `PENDING` holatida yozilgan bo'ladi.
- Server qayta ko'tarilgach, `outboxService` 300 ms intervaldagi foniy worker bilan qolib ketgan hodisalarni FIFO tartibida qayta o'qib, mijozlarga tarqatadi va holatini `PROCESSED` ga o'zgartiradi.
- Hech bir hisob-kitob, chaqiruv yoki buyurtma hodisasi yo'qolmaydi.

### 4.2. Tarmoq Uzilishida Reconnect Siyosati
- Mijoz qurilmasi (mobil telefon yoki planshet) tarmoqqa qayta ulanganda `Last-Event-ID` orqali o'tkazib yuborilgan hodisalar qayta so'raladi.
- Agar hodisalar kursor bo'yicha bazada bo'lmasa, mijoz avtomatik `sync.required` buyrug'ini qabul qilib, serverdan to'liq yangi REST snapshot oladi.
