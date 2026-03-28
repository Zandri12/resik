<?php

namespace Database\Seeders;

use App\Models\OrderStatus;
use Illuminate\Database\Seeder;

class OrderStatusSeeder extends Seeder
{
    public function run(): void
    {
        $statuses = [
            ['name' => 'diterima', 'sort_order' => 1, 'color' => '#3b82f6'],
            ['name' => 'diproses', 'sort_order' => 2, 'color' => '#0ea5e9'],
            ['name' => 'selesai', 'sort_order' => 3, 'color' => '#22c55e'],
            ['name' => 'batal', 'sort_order' => 4, 'color' => '#ef4444'],
        ];

        foreach ($statuses as $s) {
            OrderStatus::firstOrCreate(['name' => $s['name']], $s);
        }
    }
}
