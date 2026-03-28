<?php

use App\Models\OutletSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            ['key' => 'telegram_enabled', 'value' => '0'],
            ['key' => 'telegram_bot_token', 'value' => ''],
            ['key' => 'telegram_chat_id', 'value' => ''],
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
        OutletSetting::whereIn('key', ['telegram_enabled', 'telegram_bot_token', 'telegram_chat_id'])->delete();
    }
};
