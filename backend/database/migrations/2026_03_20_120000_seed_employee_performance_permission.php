<?php

use App\Models\RolePermission;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['owner', 'admin'] as $role) {
            RolePermission::updateOrCreate(
                ['role' => $role, 'feature_key' => 'employee_performance'],
                ['enabled' => true]
            );
        }
        RolePermission::updateOrCreate(
            ['role' => 'karyawan', 'feature_key' => 'employee_performance'],
            ['enabled' => false]
        );
    }

    public function down(): void
    {
        RolePermission::where('feature_key', 'employee_performance')->delete();
    }
};
