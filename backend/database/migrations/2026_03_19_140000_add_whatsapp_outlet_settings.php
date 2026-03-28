<?php

use App\Models\OutletSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            ['key' => 'whatsapp_owner_phone', 'value' => ''],
            ['key' => 'whatsapp_callmebot_apikey', 'value' => ''],
        ];

        foreach ($settings as $s) {
            OutletSetting::updateOrCreate(
                ['key' => $s['key']],
                ['value' => $s['value']]
            );
        }
    }

    public function down(): void
    {
        OutletSetting::whereIn('key', ['whatsapp_owner_phone', 'whatsapp_callmebot_apikey'])->delete();
    }
};
