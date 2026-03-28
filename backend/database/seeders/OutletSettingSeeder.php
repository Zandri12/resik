<?php

namespace Database\Seeders;

use App\Models\OutletSetting;
use Illuminate\Database\Seeder;

class OutletSettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            ['key' => 'outlet_name', 'value' => 'Resik Laundry'],
            ['key' => 'address', 'value' => OutletSetting::DEFAULT_LANDING_ADDRESS],
            ['key' => 'phone', 'value' => '0813-1389-7633'],
            ['key' => 'theme_primary', 'value' => '#0da6f2'],
            ['key' => 'whatsapp_enabled', 'value' => '0'],
            ['key' => 'whatsapp_owner_phone', 'value' => ''],
            ['key' => 'whatsapp_callmebot_apikey', 'value' => ''],
            ['key' => 'whatsapp_fonnte_token', 'value' => ''],
            ['key' => 'telegram_enabled', 'value' => '0'],
            ['key' => 'telegram_bot_token', 'value' => ''],
            ['key' => 'telegram_chat_id', 'value' => ''],
            ['key' => 'expense_budget_target', 'value' => '6000000'],
        ];

        foreach ($settings as $s) {
            OutletSetting::updateOrCreate(
                ['key' => $s['key']],
                ['value' => $s['value']]
            );
        }
    }
}
