<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            OrderStatusSeeder::class,
            ExpenseCategorySeeder::class,
            ServicePackageSeeder::class,
            OutletSettingSeeder::class,
            RolePermissionSeeder::class,
        ]);

        User::updateOrCreate(
            ['email' => 'owner@resik.local'],
            [
                'name' => 'Owner Resik',
                'password' => bcrypt('password'),
                'role' => 'owner',
            ]
        );

        Customer::firstOrCreate(
            ['phone' => '08123456789'],
            ['name' => 'Pelanggan Contoh', 'phone' => '08123456789']
        );

        $this->call(DashboardDemoSeeder::class);
    }
}
