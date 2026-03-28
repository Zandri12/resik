<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderImage extends Model
{
    protected $fillable = ['order_id', 'path', 'type'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
