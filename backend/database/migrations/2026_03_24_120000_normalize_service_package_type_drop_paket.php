<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Tipe layanan hanya kiloan & satuan; data lama bertipe paket dipetakan ke kiloan.
     */
    public function up(): void
    {
        DB::table('service_packages')
            ->where('type', 'paket')
            ->update(['type' => 'kiloan']);
    }

    public function down(): void
    {
        // Tidak mengembalikan ke paket (tidak ada informasi mana yang dulu paket).
    }
};
