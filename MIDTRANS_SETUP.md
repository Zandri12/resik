# Setup Midtrans Payment Gateway

## 1. Daftar & Ambil API Key

1. Daftar di [Midtrans](https://dashboard.midtrans.com/register)
2. Login ke [Dashboard Midtrans](https://dashboard.midtrans.com)
3. Buka **Settings** → **Access Keys**
4. Salin **Server Key** dan **Client Key** (Sandbox untuk testing)

## 2. Konfigurasi Backend

Tambahkan ke file `backend/.env`:

```env
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
MIDTRANS_IS_PRODUCTION=false
```

- **Sandbox:** `MIDTRANS_IS_PRODUCTION=false` (untuk testing)
- **Production:** `MIDTRANS_IS_PRODUCTION=true` (transaksi asli)

## 3. Webhook URL (Notification)

Di Dashboard Midtrans → **Settings** → **Configuration** → **Notification URL**, set:

```
https://domain-anda.com/api/midtrans/webhook
```

Untuk development lokal, gunakan [ngrok](https://ngrok.com) agar Midtrans bisa mengakses webhook:

```bash
ngrok http 8000
# Gunakan URL ngrok, misal: https://abc123.ngrok.io/api/midtrans/webhook
```

## 4. Testing Pembayaran (Sandbox)

| Metode | Keterangan |
|--------|------------|
| **Kartu Kredit** | No: `4811 1111 1111 1114`, CVV: `123`, Exp: `02/25`, OTP: `112233` |
| **GoPay** | Pilih simulasi sukses di sandbox |
| **Transfer Bank** | Pilih simulasi sukses di sandbox |

## 5. Alur Pembayaran

1. Kasir pilih **Bayar Online (Midtrans)** di form order
2. Klik **Bayar dengan Midtrans**
3. Order dibuat → popup Midtrans Snap muncul
4. Pelanggan bayar (GoPay, QRIS, transfer, kartu, dll.)
5. Webhook otomatis update `paid` di order saat pembayaran berhasil
