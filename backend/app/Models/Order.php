<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'order_number', 'customer_id', 'status_id', 'created_by',
        'total', 'paid', 'discount', 'notes', 'cancellation_reason', 'payment_method',
        'paid_at', 'receipt_number', 'transaction_category', 'service_speed',
        'whatsapp_order_sent_at', 'whatsapp_done_sent_at', 'is_reconciled',
        'estimate_ready_at', 'taken_at',
    ];

    protected $casts = [
        'total' => 'decimal:2',
        'paid' => 'decimal:2',
        'discount' => 'decimal:2',
        'estimate_ready_at' => 'datetime',
        'taken_at' => 'datetime',
        'paid_at' => 'datetime',
        'whatsapp_order_sent_at' => 'datetime',
        'whatsapp_done_sent_at' => 'datetime',
        'is_reconciled' => 'boolean',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(OrderStatus::class, 'status_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(OrderImage::class);
    }
}
