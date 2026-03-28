<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RolePermission extends Model
{
    protected $fillable = ['role', 'feature_key', 'enabled'];

    protected $casts = ['enabled' => 'boolean'];

    public const ROLES = ['owner', 'admin', 'karyawan'];

    /** Menu + sub-fitur per modul */
    public const FEATURES = [
        'dashboard' => 'Dashboard',
        'orders' => 'Orders',
        'orders.create' => 'Tambah Order',
        'orders.edit' => 'Edit Order',
        'orders.delete' => 'Hapus Order',
        'customers' => 'Pelanggan',
        'customers.create' => 'Tambah Pelanggan',
        'customers.edit' => 'Edit Pelanggan',
        'customers.delete' => 'Hapus Pelanggan',
        'layanan' => 'Layanan',
        'layanan.create' => 'Tambah Layanan',
        'layanan.edit' => 'Edit Layanan',
        'layanan.delete' => 'Hapus Layanan',
        'expenses' => 'Pengeluaran',
        'expenses.create' => 'Tambah Pengeluaran',
        'expenses.edit' => 'Edit Pengeluaran',
        'expenses.delete' => 'Hapus Pengeluaran',
        'reports' => 'Rekapan',
        'reports.download' => 'Unduh Laporan',
        'employee_performance' => 'Kinerja Karyawan',
        'settings' => 'Pengaturan',
        'settings.edit' => 'Edit Pengaturan',
        'users' => 'Manajemen User',
        'users.create' => 'Tambah User',
        'users.edit' => 'Edit User',
        'users.delete' => 'Hapus User',
        'landing_content' => 'Konten Landing',
        'landing_content.create' => 'Tambah Konten Landing',
        'landing_content.edit' => 'Edit Konten Landing',
        'landing_content.delete' => 'Hapus Konten Landing',
    ];

    /** Grup untuk UI: modul => [sub-fitur] */
    public const FEATURE_GROUPS = [
        'dashboard' => [],
        'orders' => ['orders.create', 'orders.edit', 'orders.delete'],
        'customers' => ['customers.create', 'customers.edit', 'customers.delete'],
        'layanan' => ['layanan.create', 'layanan.edit', 'layanan.delete'],
        'expenses' => ['expenses.create', 'expenses.edit', 'expenses.delete'],
        'reports' => ['reports.download'],
        'employee_performance' => [],
        'settings' => ['settings.edit'],
        'users' => ['users.create', 'users.edit', 'users.delete'],
        'landing_content' => ['landing_content.create', 'landing_content.edit', 'landing_content.delete'],
    ];

    public static function isAllowed(string $role, string $feature): bool
    {
        if (in_array($role, ['owner', 'admin'])) {
            return true;
        }

        $perm = static::where('role', $role)
            ->where('feature_key', $feature)
            ->first();

        if ($perm !== null) {
            return $perm->enabled;
        }

        $parent = self::getParentFeature($feature);
        if ($parent) {
            return self::isAllowed($role, $parent);
        }

        return true;
    }

    protected static function getParentFeature(string $feature): ?string
    {
        if (str_contains($feature, '.')) {
            return explode('.', $feature)[0];
        }
        return null;
    }

    public static function getForRole(string $role): array
    {
        $perms = static::where('role', $role)->get()->keyBy('feature_key');
        $result = [];
        foreach (array_keys(self::FEATURES) as $key) {
            $result[$key] = $perms->get($key)?->enabled ?? true;
        }
        return $result;
    }

    public static function getAllGroupedByRole(): array
    {
        $result = [];
        foreach (self::ROLES as $role) {
            $result[$role] = self::getForRole($role);
        }
        return $result;
    }

    public static function updateForRole(string $role, array $permissions): void
    {
        foreach ($permissions as $featureKey => $enabled) {
            if (!array_key_exists($featureKey, self::FEATURES)) {
                continue;
            }
            static::updateOrCreate(
                ['role' => $role, 'feature_key' => $featureKey],
                ['enabled' => (bool) $enabled]
            );
        }
    }
}
