<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderImage;
use App\Models\OutletSetting;
use App\Support\OrderNotificationMessageFormatter;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class WhatsAppNotificationService
{
    private const FONNTE_SEND_URL = 'https://api.fonnte.com/send';

    public function sendOrderNotification(Order $order): bool
    {
        if (! $this->isEnabled()) {
            return false;
        }

        return $this->sendOrderNotificationManual($order)['success'];
    }

    /**
     * Dipanggil setelah foto bukti diunggah — order baru belum punya foto saat notifikasi pertama,
     * jadi foto dikirim ke WA di sini (selain saat tombol "Kirim Fonnte").
     */
    public function notifyProofImageUploaded(Order $order, OrderImage $image): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $phone = $this->getOwnerPhone();
        $token = $this->getFonnteToken();
        if (empty($phone) || empty($token)) {
            return;
        }

        if (! Storage::disk('public')->exists($image->path)) {
            return;
        }

        $fullPath = Storage::disk('public')->path($image->path);
        if (! is_file($fullPath) || ! is_readable($fullPath)) {
            return;
        }

        $target = $this->normalizePhone($phone);
        if ($target === '') {
            return;
        }

        $label = match ($image->type) {
            'karyawan_ambil' => 'Bukti barang diambil karyawan',
            'pelanggan_terima' => 'Bukti barang diterima pelanggan',
            default => 'Bukti transaksi',
        };
        $caption = "{$label} — {$order->order_number}";

        $result = $this->sendViaFonnteWithUploadedFile($target, $token, $fullPath, $caption);
        if (! $result['success']) {
            $publicUrl = $this->publicUrlForStoragePath($image->path);
            if ($publicUrl !== null && $this->isUrlAllowedForFonnte($publicUrl)) {
                $result = $this->sendViaFonnte($target, $token, [
                    'url' => $publicUrl,
                    'message' => $caption,
                ]);
            }
        }
        if (! $result['success']) {
            $link = $this->publicUrlForStoragePath($image->path);
            if ($link !== null) {
                $this->sendViaFonnte($target, $token, [
                    'message' => $caption."\n\n".$link,
                ]);
            } else {
                Log::warning('WhatsApp Fonnte: bukti tidak terkirim (unggah)', [
                    'order' => $order->order_number,
                    'reason' => $result['reason'] ?? null,
                ]);
            }
        }
    }

    /**
     * Sama perilaku Telegram: teks order lengkap, lalu foto bukti dari disk (upload `file` ke Fonnte).
     * Jika upload gagal, dicoba fallback `url` bila ada URL publik (bukan localhost).
     *
     * @return array{success: bool, reason: string|null}
     */
    public function sendOrderNotificationManual(Order $order): array
    {
        $phone = $this->getOwnerPhone();
        $token = $this->getFonnteToken();

        if (empty($phone) || empty($token)) {
            Log::warning('WhatsApp Fonnte manual skipped: missing owner phone or Fonnte token');

            return ['success' => false, 'reason' => 'Nomor penerima atau token Fonnte belum diatur.'];
        }

        $order->loadMissing(['customer', 'items.servicePackage', 'images']);
        $message = OrderNotificationMessageFormatter::format($order);
        $message = $this->appendProofLinksToMessage($message, $order);
        $target = $this->normalizePhone($phone);

        if ($target === '') {
            return ['success' => false, 'reason' => 'Nomor tidak valid.'];
        }

        $textResult = $this->sendViaFonnte($target, $token, ['message' => $message]);
        if (! $textResult['success']) {
            return $textResult;
        }

        // Kirim foto bukti dari file lokal (seperti Telegram), lalu fallback URL publik jika perlu
        foreach ($order->images ?? [] as $img) {
            if (! Storage::disk('public')->exists($img->path)) {
                continue;
            }
            $fullPath = Storage::disk('public')->path($img->path);
            if (! is_file($fullPath) || ! is_readable($fullPath)) {
                continue;
            }
            if (filesize($fullPath) > 4 * 1024 * 1024) {
                Log::warning('WhatsApp Fonnte skip image: file > 4MB', ['path' => $img->path]);

                continue;
            }
            $label = match ($img->type) {
                'karyawan_ambil' => 'Bukti barang diambil karyawan',
                'pelanggan_terima' => 'Bukti barang diterima pelanggan',
                default => 'Bukti transaksi',
            };
            $caption = $label.' - '.$order->order_number;

            $imgResult = $this->sendViaFonnteWithUploadedFile($target, $token, $fullPath, $caption);
            if (! $imgResult['success']) {
                $publicUrl = $this->publicUrlForStoragePath($img->path);
                if ($publicUrl !== null && $this->isUrlAllowedForFonnte($publicUrl)) {
                    $imgResult = $this->sendViaFonnte($target, $token, [
                        'url' => $publicUrl,
                        'message' => $caption,
                    ]);
                }
            }
            if (! $imgResult['success']) {
                Log::warning('WhatsApp Fonnte kirim foto bukti gagal', [
                    'reason' => $imgResult['reason'],
                    'path' => $img->path,
                ]);
            }
        }

        return ['success' => true, 'reason' => null];
    }

    /**
     * Format uji coba selaras dengan Telegram (blok: judul, pemisah, status, waktu, outlet).
     *
     * @return array{success: bool, reason: string|null}
     */
    public function sendTestMessage(): array
    {
        $phone = $this->getOwnerPhone();
        $token = $this->getFonnteToken();

        if (empty($phone) || empty($token)) {
            return ['success' => false, 'reason' => 'Nomor penerima atau token Fonnte belum diatur.'];
        }

        $target = $this->normalizePhone($phone);
        $outletName = OutletSetting::get('outlet_name', 'Resik Laundry');
        $message = implode("\n", [
            'Pesan uji coba',
            '---',
            'Notifikasi WhatsApp (Fonnte) Resik berfungsi dengan baik.',
            now()->timezone(config('app.timezone'))->format('d/m/Y H:i'),
            '---',
            $outletName,
        ]);

        if ($target === '') {
            return ['success' => false, 'reason' => 'Nomor tidak valid.'];
        }

        return $this->sendViaFonnte($target, $token, ['message' => $message]);
    }

    /**
     * Upload file ke Fonnte memakai cURL + CURLFile seperti dokumentasi resmi Fonnte.
     * Laravel Http::attach() sering tidak kompatibel dengan multipart yang diharapkan API ini.
     *
     * @return array{success: bool, reason: string|null}
     */
    private function sendViaFonnteWithUploadedFile(
        string $target,
        string $token,
        string $absolutePath,
        string $caption
    ): array {
        if (! is_file($absolutePath) || ! is_readable($absolutePath)) {
            return ['success' => false, 'reason' => 'Berkas bukti tidak ada atau tidak bisa dibaca.'];
        }

        if (class_exists(\CURLFile::class)) {
            $result = $this->sendViaFonnteCurlFile($target, $token, $absolutePath, $caption);
            if ($result['success']) {
                return $result;
            }
            Log::notice('WhatsApp Fonnte cURL upload tidak sukses, coba fallback Laravel', [
                'reason' => $result['reason'],
            ]);
        }

        return $this->sendViaFonnteWithUploadedFileHttpAttach($target, $token, $absolutePath, $caption);
    }

    /**
     * @return array{success: bool, reason: string|null}
     */
    private function sendViaFonnteCurlFile(
        string $target,
        string $token,
        string $absolutePath,
        string $caption
    ): array {
        $mime = @mime_content_type($absolutePath);
        if (! is_string($mime) || $mime === '') {
            $mime = 'image/jpeg';
        }

        $basename = basename($absolutePath);
        if ($basename === '') {
            $basename = 'bukti.jpg';
        }

        try {
            $file = new \CURLFile($absolutePath, $mime, $basename);
        } catch (\Throwable $e) {
            return ['success' => false, 'reason' => $e->getMessage()];
        }

        $postFields = [
            'target' => $target,
            'message' => $caption,
            'connectOnly' => 'false',
            'file' => $file,
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => self::FONNTE_SEND_URL,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postFields,
            CURLOPT_HTTPHEADER => [
                'Authorization: '.$token,
                'Accept: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 90,
            CURLOPT_CONNECTTIMEOUT => 20,
        ]);

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $errstr = curl_error($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno !== 0) {
            Log::warning('WhatsApp Fonnte cURL error', ['errno' => $errno, 'error' => $errstr]);

            return ['success' => false, 'reason' => $errstr !== '' ? $errstr : 'Koneksi ke Fonnte gagal.'];
        }

        if (! is_string($raw)) {
            return ['success' => false, 'reason' => 'Respons Fonnte kosong.'];
        }

        $body = json_decode($raw, true);

        if ($httpCode >= 400) {
            Log::warning('WhatsApp Fonnte HTTP (cURL upload)', ['code' => $httpCode, 'body' => $raw]);

            return [
                'success' => false,
                'reason' => $this->extractFonnteReason(is_array($body) ? $body : null) ?? 'HTTP '.$httpCode,
            ];
        }

        if ($this->isFonnteSuccess(is_array($body) ? $body : null, $raw)) {
            return ['success' => true, 'reason' => null];
        }

        return [
            'success' => false,
            'reason' => $this->extractFonnteReason(is_array($body) ? $body : null) ?? 'Fonnte menolak upload file.',
        ];
    }

    /**
     * Fallback jika cURL/CURLFile tidak tersedia atau gagal.
     *
     * @return array{success: bool, reason: string|null}
     */
    private function sendViaFonnteWithUploadedFileHttpAttach(
        string $target,
        string $token,
        string $absolutePath,
        string $caption
    ): array {
        $contents = @file_get_contents($absolutePath);
        if ($contents === false || $contents === '') {
            return ['success' => false, 'reason' => 'Berkas bukti tidak bisa dibaca.'];
        }

        $filename = basename($absolutePath) ?: 'bukti.jpg';

        try {
            $response = Http::timeout(90)
                ->connectTimeout(20)
                ->withHeaders([
                    'Authorization' => $token,
                    'Accept' => 'application/json',
                ])
                ->attach('file', $contents, $filename)
                ->post(self::FONNTE_SEND_URL, [
                    'target' => $target,
                    'message' => $caption,
                    'connectOnly' => 'false',
                ]);

            $raw = $response->body();
            $body = $response->json();

            if (! $response->successful()) {
                Log::warning('WhatsApp Fonnte HTTP error (upload file, fallback)', [
                    'status' => $response->status(),
                    'body' => $raw,
                ]);

                return [
                    'success' => false,
                    'reason' => $this->extractFonnteReason($body) ?? 'HTTP '.$response->status(),
                ];
            }

            if ($this->isFonnteSuccess($body, $raw)) {
                return ['success' => true, 'reason' => null];
            }

            return [
                'success' => false,
                'reason' => $this->extractFonnteReason($body) ?? 'Fonnte menolak upload file.',
            ];
        } catch (\Throwable $e) {
            Log::error('WhatsApp Fonnte upload exception (fallback)', ['error' => $e->getMessage()]);

            return ['success' => false, 'reason' => $e->getMessage()];
        }
    }

    /**
     * @param  array<string, string>  $fields  minimal salah satu: message, atau url (+ message sebagai caption)
     * @return array{success: bool, reason: string|null}
     */
    private function sendViaFonnte(string $target, string $token, array $fields): array
    {
        try {
            $payload = array_merge([
                'target' => (string) $target,
                'connectOnly' => 'false',
            ], $fields);

            $response = Http::timeout(25)
                ->connectTimeout(10)
                ->withHeaders([
                    'Authorization' => $token,
                    'Accept' => 'application/json',
                ])
                ->asForm()
                ->post(self::FONNTE_SEND_URL, $payload);

            $raw = $response->body();
            $body = $response->json();

            if (! $response->successful()) {
                Log::warning('WhatsApp Fonnte HTTP error', [
                    'status' => $response->status(),
                    'body' => $raw,
                ]);

                return [
                    'success' => false,
                    'reason' => $this->extractFonnteReason($body) ?? 'HTTP '.$response->status(),
                ];
            }

            if ($this->isFonnteSuccess($body, $raw)) {
                return ['success' => true, 'reason' => null];
            }

            $reason = $this->extractFonnteReason($body) ?? 'Fonnte menolak permintaan.';
            Log::warning('WhatsApp Fonnte rejected', ['body' => $body, 'raw' => $raw]);

            return ['success' => false, 'reason' => $reason];
        } catch (\Throwable $e) {
            Log::error('WhatsApp Fonnte exception', ['error' => $e->getMessage()]);

            return ['success' => false, 'reason' => $e->getMessage()];
        }
    }

    private function publicUrlForStoragePath(string $path): ?string
    {
        if (! Storage::disk('public')->exists($path)) {
            return null;
        }

        return url(Storage::disk('public')->url($path));
    }

    /**
     * Tambahkan link bukti di akhir teks (terbuka di HP) jika file bisa di-URL-kan.
     */
    private function appendProofLinksToMessage(string $body, Order $order): string
    {
        $order->loadMissing('images');
        $lines = [];
        foreach ($order->images ?? [] as $img) {
            if (! Storage::disk('public')->exists($img->path)) {
                continue;
            }
            $url = $this->publicUrlForStoragePath($img->path);
            if ($url === null || $url === '') {
                continue;
            }
            $label = match ($img->type) {
                'karyawan_ambil' => 'Diambil karyawan',
                'pelanggan_terima' => 'Diterima pelanggan',
                default => 'Bukti',
            };
            $lines[] = '• '.$label.': '.$url;
        }

        if ($lines === []) {
            return $body;
        }

        return $body."\n\n--------------------------------\nLink bukti foto (buka di browser):\n".implode("\n", $lines);
    }

    /** Fonnte menolak localhost / private IP untuk parameter url. */
    private function isUrlAllowedForFonnte(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (! is_string($host) || $host === '') {
            return false;
        }
        $h = strtolower($host);
        if ($h === 'localhost' || str_starts_with($h, '127.') || $h === '::1') {
            return false;
        }

        return str_starts_with($url, 'https://') || str_starts_with($url, 'http://');
    }

    /**
     * @param  array<string, mixed>|null  $body
     */
    private function isFonnteSuccess(?array $body, string $raw): bool
    {
        if ($body !== null) {
            $status = $body['status'] ?? $body['Status'] ?? null;
            if ($status === true || $status === 'true' || $status === 1) {
                return true;
            }
        }

        if (str_contains($raw, '"status":true') || str_contains($raw, '"status": true')) {
            return true;
        }

        return false;
    }

    /**
     * @param  array<string, mixed>|null  $body
     */
    private function extractFonnteReason(?array $body): ?string
    {
        if ($body === null) {
            return null;
        }
        $r = $body['reason'] ?? $body['Reason'] ?? $body['detail'] ?? $body['Detail'] ?? null;

        return is_string($r) && $r !== '' ? $r : null;
    }

    private function isEnabled(): bool
    {
        return (bool) OutletSetting::get('whatsapp_enabled', false);
    }

    private function getOwnerPhone(): ?string
    {
        $owner = OutletSetting::get('whatsapp_owner_phone');
        if (is_string($owner) && trim($owner) !== '') {
            return trim($owner);
        }

        $landing = OutletSetting::get('phone');
        if (is_string($landing) && trim($landing) !== '') {
            return trim($landing);
        }

        return null;
    }

    private function getFonnteToken(): ?string
    {
        $fromDb = OutletSetting::get('whatsapp_fonnte_token');
        if (is_string($fromDb) && trim($fromDb) !== '') {
            return trim($fromDb);
        }

        $fromEnv = config('services.fonnte.token');
        if (is_string($fromEnv) && trim($fromEnv) !== '') {
            return trim($fromEnv);
        }

        return null;
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if ($digits === '') {
            return '';
        }
        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }
        if (str_starts_with($digits, '62')) {
            return $digits;
        }

        return '62'.$digits;
    }
}
