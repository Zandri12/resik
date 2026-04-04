<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OutletSetting;
use App\Services\TelegramNotificationService;
use App\Services\WhatsAppNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OutletSettingController extends Controller
{
    public function __construct(
        protected TelegramNotificationService $telegram,
        protected WhatsAppNotificationService $whatsApp
    ) {}

    public function index()
    {
        return OutletSetting::pluck('value', 'key');
    }

    /** Profil outlet untuk halaman landing (tanpa auth). */
    public function publicProfile()
    {
        $address = trim((string) (OutletSetting::get('address') ?? ''));
        if ($address === '') {
            $address = OutletSetting::DEFAULT_LANDING_ADDRESS;
        }

        $heroRaw = trim((string) (OutletSetting::get('landing_hero_url', '') ?? ''));
        $landingHeroUrl = $heroRaw !== '' ? $this->resolvePublicMediaUrl($heroRaw) : null;

        return response()->json([
            'outlet_name' => OutletSetting::get('outlet_name', 'Resik Laundry'),
            'address' => $address,
            'phone' => (string) (OutletSetting::get('phone', '') ?? ''),
            'landing_hero_url' => $landingHeroUrl,
        ]);
    }

    /** URL absolut https atau path di disk `public` (mis. hasil unggah ke storage). */
    private function resolvePublicMediaUrl(string $raw): ?string
    {
        if (preg_match('#^https?://#i', $raw)) {
            return $raw;
        }

        $path = str_replace('\\', '/', $raw);
        $path = ltrim($path, '/');
        if (str_starts_with($path, 'storage/')) {
            $path = substr($path, strlen('storage/'));
        }
        if ($path === '' || str_contains($path, '..')) {
            return null;
        }

        return Storage::disk('public')->url($path);
    }

    public function update(Request $request)
    {
        if (! $request->user()?->hasPermission('settings.edit')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'nullable',
        ]);

        foreach ($request->settings as $s) {
            OutletSetting::set($s['key'], $s['value']);
        }

        return OutletSetting::pluck('value', 'key');
    }

    public function testTelegram(Request $request)
    {
        $token = $request->input('token') ?: OutletSetting::get('telegram_bot_token');
        $chatId = $request->input('chat_id') ?: OutletSetting::get('telegram_chat_id');

        if (empty($token) || empty($chatId)) {
            return response()->json(['success' => false, 'message' => 'Token dan Chat ID wajib diisi'], 400);
        }

        $ok = $this->telegram->sendTestMessage($token, $chatId);

        return response()->json(['success' => $ok]);
    }

    public function testWhatsApp(Request $request)
    {
        if (! $request->user()?->hasPermission('settings.edit')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $r = $this->whatsApp->sendTestMessage();

        return response()->json([
            'success' => $r['success'],
            'reason' => $r['reason'],
            'message' => $r['success']
                ? 'Pesan uji coba terkirim lewat Fonnte. Cek WhatsApp pada nomor di pengaturan.'
                : ($r['reason'] ?? 'Pastikan token Fonnte benar, perangkat terhubung di Fonnte, dan nomor (Owner atau Telepon landing) terisi.'),
        ]);
    }
}
