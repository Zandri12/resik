<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OutletSetting;
use App\Support\OrderNotificationMessageFormatter;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramNotificationService
{
    public function sendTestMessage(?string $token = null, ?string $chatId = null): bool
    {
        $token = $token ?? $this->getBotToken();
        $chatId = $chatId ?? $this->getChatId();

        if (empty($token) || empty($chatId)) {
            return false;
        }

        $outletName = OutletSetting::get('outlet_name', 'Resik Laundry');
        $message = implode("\n", [
            'Pesan uji coba',
            '---',
            'Notifikasi Telegram Resik berfungsi dengan baik.',
            date('d/m/Y H:i'),
            '---',
            $outletName,
        ]);

        $url = "https://api.telegram.org/bot{$token}/sendMessage";

        try {
            $response = Http::timeout(10)->post($url, [
                'chat_id' => $chatId,
                'text' => $message,
            ]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('Telegram test failed', ['error' => $e->getMessage()]);

            return false;
        }
    }

    public function sendOrderNotification(Order $order): bool
    {
        if (! $this->isEnabled()) {
            return false;
        }

        return $this->sendOrderNotificationManual($order);
    }

    public function sendOrderNotificationManual(Order $order): bool
    {
        $token = $this->getBotToken();
        $chatId = $this->getChatId();

        if (empty($token) || empty($chatId)) {
            Log::warning('Telegram notification skipped: missing bot token or chat_id');

            return false;
        }

        $message = OrderNotificationMessageFormatter::format($order);
        $url = "https://api.telegram.org/bot{$token}/sendMessage";

        try {
            $response = Http::timeout(10)->post($url, [
                'chat_id' => $chatId,
                'text' => $message,
            ]);

            if (! $response->successful()) {
                Log::warning('Telegram sendMessage failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            // Kirim foto bukti jika ada
            $images = $order->images ?? collect();
            foreach ($images as $img) {
                $fullPath = storage_path('app/public/'.$img->path);
                if (file_exists($fullPath)) {
                    $label = match ($img->type) {
                        'karyawan_ambil' => 'Bukti barang diambil karyawan',
                        'pelanggan_terima' => 'Bukti barang diterima pelanggan',
                        default => 'Bukti transaksi',
                    };
                    $this->sendPhoto($fullPath, $label.' - '.$order->order_number);
                }
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('Telegram notification failed', ['error' => $e->getMessage()]);

            return false;
        }
    }

    private function isEnabled(): bool
    {
        return (bool) OutletSetting::get('telegram_enabled', false);
    }

    private function getBotToken(): ?string
    {
        return OutletSetting::get('telegram_bot_token');
    }

    private function getChatId(): ?string
    {
        return OutletSetting::get('telegram_chat_id');
    }

    public function sendPhoto(string $filePath, ?string $caption = null): bool
    {
        $token = $this->getBotToken();
        $chatId = $this->getChatId();

        if (empty($token) || empty($chatId) || ! file_exists($filePath)) {
            Log::warning('Telegram sendPhoto skipped: missing token, chat_id, or file');

            return false;
        }

        $url = "https://api.telegram.org/bot{$token}/sendPhoto";

        try {
            $response = Http::timeout(30)
                ->attach('photo', file_get_contents($filePath), basename($filePath))
                ->post($url, [
                    'chat_id' => $chatId,
                    'caption' => $caption ?? '',
                ]);

            if (! $response->successful()) {
                Log::warning('Telegram sendPhoto failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('Telegram sendPhoto failed', ['error' => $e->getMessage()]);

            return false;
        }
    }

    public function sendDocument(string $filePath, string $filename, ?string $caption = null): bool
    {
        $token = $this->getBotToken();
        $chatId = $this->getChatId();

        if (empty($token) || empty($chatId) || ! file_exists($filePath)) {
            Log::warning('Telegram sendDocument skipped: missing token, chat_id, or file');

            return false;
        }

        $url = "https://api.telegram.org/bot{$token}/sendDocument";

        try {
            $response = Http::timeout(30)
                ->attach('document', file_get_contents($filePath), $filename)
                ->post($url, [
                    'chat_id' => $chatId,
                    'caption' => $caption ?? '',
                ]);

            if (! $response->successful()) {
                Log::warning('Telegram sendDocument failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('Telegram sendDocument failed', ['error' => $e->getMessage()]);

            return false;
        }
    }
}
