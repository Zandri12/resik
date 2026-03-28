<?php

namespace App\Support;

use App\Models\Order;
use Carbon\Carbon;

/**
 * Kas masuk: jumlah `paid` pada order yang pembayaran penuhnya terjadi di periode
 * (paid_at), dengan fallback legacy (lunas tanpa paid_at → taken_at).
 */
class Cashflow
{
    public static function cashReceivedBetween(Carbon $start, Carbon $end): float
    {
        $from = $start->copy()->startOfDay();
        $to = $end->copy()->endOfDay();

        $fromPaidAt = (float) Order::query()
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from, $to])
            ->sum('paid');

        $fromTakenFallback = (float) Order::query()
            ->whereNull('paid_at')
            ->whereColumn('paid', '>=', 'total')
            ->where('total', '>', 0)
            ->whereNotNull('taken_at')
            ->whereBetween('taken_at', [$from, $to])
            ->sum('paid');

        return $fromPaidAt + $fromTakenFallback;
    }

    public static function cashReceivedOnDate(Carbon $date): float
    {
        return self::cashReceivedBetween($date->copy()->startOfDay(), $date->copy()->endOfDay());
    }
}
