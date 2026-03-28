<?php

namespace Database\Seeders;

use App\Models\RolePermission;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $features = array_keys(RolePermission::FEATURES);

        foreach (['owner', 'admin'] as $role) {
            foreach ($features as $feature) {
                RolePermission::updateOrCreate(
                    ['role' => $role, 'feature_key' => $feature],
                    ['enabled' => true]
                );
            }
        }

        $karyawanDefaults = [
            'dashboard' => true,
            'orders' => true,
            'orders.create' => true,
            'orders.edit' => true,
            'orders.delete' => false,
            'customers' => true,
            'customers.create' => true,
            'customers.edit' => true,
            'customers.delete' => false,
            'layanan' => true,
            'layanan.create' => false,
            'layanan.edit' => false,
            'layanan.delete' => false,
            'expenses' => true,
            'expenses.create' => true,
            'expenses.edit' => true,
            'expenses.delete' => false,
            'reports' => true,
            'reports.download' => true,
            'employee_performance' => false,
            'settings' => true,
            'settings.edit' => false,
            'users' => false,
            'users.create' => false,
            'users.edit' => false,
            'users.delete' => false,
            'landing_content' => false,
            'landing_content.create' => false,
            'landing_content.edit' => false,
            'landing_content.delete' => false,
        ];

        foreach ($karyawanDefaults as $feature => $enabled) {
            RolePermission::updateOrCreate(
                ['role' => 'karyawan', 'feature_key' => $feature],
                ['enabled' => $enabled]
            );
        }
    }
}
