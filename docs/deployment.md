# MENUREST.UZ — Joylashtirish va Ishga Tushirish Qo'llanmasi (Deployment Guide)

Ushbu hujjat `menurest.uz` platformasini Staging va Production server muhitlarida xavfsiz va barqaror joylashtirish tartibini belgilaydi.

---

## 1. Arxitektura va Tizim Talablari

- **Backend:** Node.js v20+ / v22+ LTS (Express + TypeScript + Prisma)
- **Frontend:** Vite + React + TypeScript (SPA)
- **Ma'lumotlar Bazasi:** PostgreSQL 15+ (ishlab chiqarishda Connection Pooling tavsiya etiladi)
- **Konteynerlashtirish:** Docker & Docker Compose
- **Teskari Proksi (Reverse Proxy):** Nginx yoki Caddy (HTTPS, SSL sertifikati, HTTP/2, SSE buffer disabling)

---

## 2. Muhit O'zgaruvchilari (Environment Variables)

`.env` fayli ishlab chiqarishda repositoryga qo'shilmaydi. `.env.example` asosida serverda xavfsiz yaratiladi:

```env
# Server Sozlamalari
NODE_ENV=production
PORT=4000
BASE_URL=https://menurest.uz
API_ORIGIN=https://menurest.uz
FRONTEND_URL=https://menurest.uz

# Ma'lumotlar Bazasi
DATABASE_URL="postgresql://menurest_prod_user:StrongPasswordHere@localhost:5432/menurest_prod?schema=public&sslmode=prefer"

# JWT va Xavfsizlik
JWT_SECRET="kuchli-kamida-64-belgili-tasodifiy-kriptografik-sirli-kalit-2026"
SESSION_COOKIE_DOMAIN=".menurest.uz"
COOKIE_SECURE=true

# CORS va Ishonchli Originlar (Guest QR va API ulanishlari uchun)
CORS_ORIGIN="https://menurest.uz"
ALLOWED_ORIGINS="https://menurest.uz,https://admin.menurest.uz"

# Fayllarni Saqlash
STORAGE_DRIVER=local
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=5
```

---

## 3. Ishlab Chiqarish Build Jarayoni

```bash
# 1. Bog'liqliklarni o'rnatish (Clean Install)
npm ci

# 2. Umumiy paketlarni build qilish
npm run build --workspace=@menurest/shared

# 3. Prisma Clientni generatsiya qilish
npm run generate

# 4. Frontend SPA ni ishlab chiqarishga paketlash
npm run build --workspace=@menurest/web

# 5. Typecheck va barcha xavfsizlik testlarini tekshirish
npm run typecheck
npm run test
```

---

## 4. Ma'lumotlar Bazasi Migratsiyasi va Boshlang'ich Sozlash

> [!CAUTION]
> Production muhitida hech qachon `prisma migrate reset` yoki `db push` buyrug'ini ishlatmang! Faqat oldinga yo'naltirilgan `migrate deploy` qo'llanadi. `npm run seed` skripti ham ishlab chiqarish muhitida (`NODE_ENV=production`) avtomatik bloklangan.

```bash
# 1. Zaxira nusxa olish (Pre-migration Backup)
pg_dump -U menurest_prod_user -d menurest_prod -F c -b -v -f /backups/menurest_pre_migration_$(date +%Y%m%d_%H%M%S).dump

# 2. Migratsiyalarni xavfsiz oldinga tatbiq etish
npm run migrate:deploy
```

### Super Adminni Xavfsiz Bootstrap Qilish

Birinchi marta ishga tushirishda platforma Super Adminini CLI vositasi orqali xavfsiz yaratish buyrug'i:

```bash
# Kuchli parol talabi (kamida 10 belgi, katta-kichik harf, son, maxsus belgi):
npm run bootstrap:superadmin -- --phone="+998901234567" --password="SecureGeneratedPassword123!" --name="Platform Administrator"

# Yoki muhit o'zgaruvchilari orqali:
SUPERADMIN_PHONE="+998901234567" SUPERADMIN_NAME="Platform Administrator" SUPERADMIN_PASSWORD="SecureGeneratedPassword123!" npm run bootstrap:superadmin
```

> [!NOTE]
> Agar bazada Super Admin allaqachon mavjud bo'lsa, xavfsizlik yuzasidan yangi super admin yaratilmaydi. Mavjud admin parolini yangilash talab etilsa, `--force` kaliti kiritiladi va tizim audit jurnaliga `SUPER_ADMIN_BOOTSTRAPPED` hodisasi qayd etiladi.

---

## 5. Nginx Teskari Proksi Sozlamalari (Reverse Proxy & SSE)

Server Sent Events (SSE) uzluksiz ishlashi uchun Nginx'da javoblarni buferlash o'chirilishi shart (`proxy_buffering off`):

```nginx
server {
    listen 80;
    server_name menurest.uz www.menurest.uz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name menurest.uz www.menurest.uz;

    ssl_certificate /etc/letsencrypt/live/menurest.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/menurest.uz/privkey.pem;

    # Xavfsizlik sarlavhalari
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static uploads
    location /uploads/ {
        alias /var/www/menurest/apps/api/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # API va Realtime SSE marshruti
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE (Server-Sent Events) uchun zarur:
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Frontend SPA (HTML5 History API fallback)
    location / {
        root /var/www/menurest/apps/web/dist;
        try_files $uri $uri/ /index.html;
        expires -1;
    }
}
```

---

## 6. Qaytarish (Rollback) Rejasi

Agar yangi versiyada kutilmagan regressiya aniqlansa:
1. Docker konteynerni avvalgi barqaror tegga qaytarish: `docker compose up -d app:previous_tag`.
2. Agar DB migratsiyasi xato kiritgan bo'lsa: eng so'nggi `pg_dump` faylini test serverida tekshirib, xavfsiz tiklash.
3. Outbox worker qayta ishga tushganda `PENDING` eventlarni navbatdagi tsiklda davom ettiradi.
