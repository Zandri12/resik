<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'name', 'phone', 'email', 'address', 'note',
        'is_member', 'member_discount', 'member_valid_from', 'member_valid_until',
        'is_blacklisted',
        'points', 'birthday', 'referral_code', 'tags',
    ];

    protected $casts = [
        'tags' => 'array',
        'birthday' => 'date',
        'member_valid_from' => 'date',
        'member_valid_until' => 'date',
        'is_member' => 'boolean',
        'is_blacklisted' => 'boolean',
        'member_discount' => 'decimal:2',
    ];

    protected $appends = ['member_benefits_active'];

    public function getMemberBenefitsActiveAttribute(): bool
    {
        if (! $this->is_member) {
            return false;
        }
        $today = now()->toDateString();
        if ($this->member_valid_from && $today < $this->member_valid_from->toDateString()) {
            return false;
        }
        if ($this->member_valid_until && $today > $this->member_valid_until->toDateString()) {
            return false;
        }

        return true;
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
