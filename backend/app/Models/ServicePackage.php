<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServicePackage extends Model
{
    protected $fillable = [
        'name',
        'category',
        'sort_order',
        'group_slug',
        'group_title',
        'variant_label',
        'speed',
        'type',
        'price_per_unit',
        'unit',
        'estimate_minutes',
        'is_active',
    ];

    protected $casts = [
        'price_per_unit' => 'decimal:2',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /** Simpan selalu lowercase (kiloan|satuan) agar konsisten dengan validasi API. */
    protected function type(): Attribute
    {
        return Attribute::make(
            set: fn (?string $value) => $value !== null && $value !== ''
                ? strtolower(trim($value))
                : $value,
        );
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
