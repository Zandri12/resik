<?php

use App\Models\OutletSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        OutletSetting::updateOrCreate(
            ['key' => 'whatsapp_fonnte_token'],
            ['value' => '']
        );
    }

    public function down(): void
    {
        OutletSetting::where('key', 'whatsapp_fonnte_token')->delete();
    }
};
