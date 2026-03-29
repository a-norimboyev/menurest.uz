# 365_day (React + Vite)

Haftalik reja ilovasi (web + PWA) endi cloud sync bilan telefon va kompyuter orasida ma'lumot almasha oladi.

## Ishga tushirish

1. `npm install`
2. `npm run dev`

## Sifat tekshiruvi

1. `npm run lint`
2. `npm run test`
3. `npm run build`

## Cloud Sync (Supabase)

Cloud sync yoqish uchun `.env` fayl yarating va quyidagilarni kiriting:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_PLANNER_SYNC_USER_ID=Azizjon
VITE_SYNC_BACKEND_URL=
```

`VITE_PLANNER_SYNC_USER_ID=Azizjon` bo'lsa (telefon va kompyuterda), ma'lumotlar sinxron bo'ladi.

Supabase SQL Editor'da quyidagi jadvalni yarating:

```sql
create table if not exists public.planner_sync (
	user_id text primary key,
	payload jsonb not null,
	updated_at timestamptz not null default now()
);

alter table public.planner_sync enable row level security;

-- Bu loyiha uchun qiymatni 'Azizjon' qilib qo'ying.
create policy "allow scoped anon read" on public.planner_sync
for select
to anon
using (user_id = 'Azizjon');

create policy "allow scoped anon insert" on public.planner_sync
for insert
to anon
with check (user_id = 'Azizjon');

create policy "allow scoped anon update" on public.planner_sync
for update
to anon
using (user_id = 'Azizjon')
with check (user_id = 'Azizjon');
```

Muhim: `.env` ichidagi `VITE_PLANNER_SYNC_USER_ID=Azizjon` va policy ichidagi `user_id = 'Azizjon'` bir xil bo'lishi kerak.

Eslatma: bu authsiz minimal xavfsiz variant. Katta loyiha uchun Supabase Auth bilan `auth.uid()` asosidagi RLS ishlatish tavsiya etiladi.

## Cloud Sync (Custom Backend)

Supabase policy bilan ishlash o'rniga o'zingizning backend API orqali sync qilishingiz ham mumkin.

1. `backend/.env.example` asosida `backend/.env` yarating.
2. Backendni ishga tushiring:

```bash
cd backend
npm install
npm run dev
```

3. Frontend `.env` ichida backend URL ni kiriting:

```env
VITE_SYNC_BACKEND_URL=http://localhost:8787
VITE_PLANNER_SYNC_USER_ID=Azizjon
```

Agar `VITE_SYNC_BACKEND_URL` berilsa, frontend avval backend API orqali sync qiladi.

## Sync ishlash tartibi

1. Ilova cloud holatini headerda ko'rsatadi: syncing/synced/error/local.
2. Yangi o'zgarishlar debounce bilan cloudga yoziladi.
3. Tab qayta ochilganda va davriy intervalda clouddan yangilanish olinadi.
4. Konflikt bo'lsa clouddagi eng yangi versiya ustun qo'yiladi va statusda ogohlantirish chiqadi.
