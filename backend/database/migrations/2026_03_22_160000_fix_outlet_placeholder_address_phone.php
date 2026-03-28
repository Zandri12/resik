<?php

use App\Models\OutletSetting;
use Illuminate\Database\Migrations\Migration;

/**
 * Seed awal memakai alamat/nomor contoh; instal yang sudah jalan tidak ikut seeder ulang.
 * Perbaiki agar landing & peta tidak lagi menampilkan placeholder.
 */
return new class extends Migration
{
    public function up(): void
    {
        $placeholderAddresses = [
            'Jl. Contoh No. 123',
            'Jl Contoh No. 123',
        ];

        $address = trim((string) OutletSetting::where('key', 'address')->value('value'));
        if ($address === '' || in_array($address, $placeholderAddresses, true)) {
            OutletSetting::set('address', OutletSetting::DEFAULT_LANDING_ADDRESS);
        }

        $digits = preg_replace('/\D/', '', (string) OutletSetting::where('key', 'phone')->value('value'));
        if ($digits === '08123456789' || $digits === '628123456789') {
            OutletSetting::set('phone', '0813-1389-7633');
        }
    }

    public function down(): void
    {
        // tidak mengembalikan placeholder
    }
};
