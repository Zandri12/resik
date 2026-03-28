<?php

namespace App\Support;

class PaymentMethodNormalizer
{
    /** Normalize client/Excel variants (e.g. cash → tunai). */
    public static function normalize(?string $method): ?string
    {
        if ($method === null || $method === '') {
            return null;
        }
        $m = strtolower(trim($method));

        return match ($m) {
            'cash' => 'tunai',
            default => $m,
        };
    }
}
