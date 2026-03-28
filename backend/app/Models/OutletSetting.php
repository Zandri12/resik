<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class OutletSetting extends Model
{
    /** Alamat publik landing & embed peta (fallback jika `address` belum diisi). */
    public const DEFAULT_LANDING_ADDRESS = 'Jl. Raya Kalimulya No.33, Kalimulya, Kec. Cilodong, Kota Depok, Jawa Barat 16413';

    protected $fillable = ['key', 'value'];

    public static function get(string $key, mixed $default = null): mixed
    {
        return Cache::rememberForever("outlet_setting_{$key}", function () use ($key, $default) {
            $setting = static::where('key', $key)->first();
            return $setting?->value ?? $default;
        });
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget("outlet_setting_{$key}");
    }
}
