# Resik — Laundry Management

Aplikasi manajemen laundry: Laravel API + React SPA.

## Stack
- Backend: Laravel 12, Sanctum, PostgreSQL
- Frontend: React 19, Vite, Tailwind CSS, React Router

## Setup

### 1. Database
Buat database PostgreSQL:
```sql
CREATE DATABASE resik;
CREATE USER resik WITH PASSWORD '151001';
GRANT ALL ON DATABASE resik TO resik;
```
Atau gunakan user `postgres` (sudah dikonfigurasi di .env).

### 2. Backend (Laravel)
```bash
cd backend
composer install
# .env sudah dikonfigurasi: DB_DATABASE=resik, DB_USERNAME=postgres, DB_PASSWORD=151001
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
php artisan serve
```
Backend: http://localhost:8000

**Agar summary card dashboard terisi** (Order Hari Ini, Pendapatan, dll.), jalankan seeder demo:
```bash
php artisan db:seed --class=DashboardDemoSeeder
# atau
php artisan dashboard:seed-demo
```
Pastikan `APP_TIMEZONE=Asia/Jakarta` di `.env`.

### 3. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
Frontend: http://localhost:5173 (proxy API ke backend)

### Login
- Email: `owner@resik.local`
- Password: `password`

## Fitur
- Dashboard (order, pendapatan, pengeluaran, profit)
- CRUD Pelanggan
- Buat order baru (pilih pelanggan, layanan, hitung total)
- Daftar order + filter status + ubah status
- Pengeluaran + kategori
- Layanan (cuci kiloan, setrika, dll)
- QR cek status: GET /api/orders/{id}/status (public)

## API
- POST /api/login — login
- GET /api/user — user (auth)
- CRUD: /api/customers, /api/orders, /api/expenses, /api/service-packages, dll.
