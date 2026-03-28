<?php

use App\Models\RolePermission;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $keys = ['landing_content', 'landing_content.create', 'landing_content.edit', 'landing_content.delete'];

        foreach (['owner', 'admin'] as $role) {
            foreach ($keys as $feature) {
                RolePermission::updateOrCreate(
                    ['role' => $role, 'feature_key' => $feature],
                    ['enabled' => true]
                );
            }
        }

        foreach ($keys as $feature) {
            RolePermission::updateOrCreate(
                ['role' => 'karyawan', 'feature_key' => $feature],
                ['enabled' => false]
            );
        }
    }

    public function down(): void
    {
        RolePermission::whereIn('feature_key', [
            'landing_content',
            'landing_content.create',
            'landing_content.edit',
            'landing_content.delete',
        ])->delete();
    }
};
