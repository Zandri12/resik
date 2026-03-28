<?php

namespace Database\Seeders;

use App\Models\ServicePackage;
use Illuminate\Database\Seeder;

class ServicePackageSeeder extends Seeder
{
    public function run(): void
    {
        $packages = [
            ['name' => 'Cuci Kiloan', 'type' => 'kiloan', 'price_per_unit' => 7000, 'unit' => 'kg', 'estimate_minutes' => 120],
            ['name' => 'Setrika Kiloan', 'type' => 'kiloan', 'price_per_unit' => 5000, 'unit' => 'kg', 'estimate_minutes' => 60],
            ['name' => 'Cuci + Setrika Kiloan', 'type' => 'kiloan', 'price_per_unit' => 10000, 'unit' => 'kg', 'estimate_minutes' => 180],
            ['name' => 'Express (per kg)', 'type' => 'kiloan', 'price_per_unit' => 15000, 'unit' => 'kg', 'estimate_minutes' => 60],
        ];

        foreach ($packages as $p) {
            ServicePackage::firstOrCreate(
                ['name' => $p['name'], 'type' => $p['type']],
                $p
            );
        }
    }
}
