<?php

namespace App\Support;

use App\Models\Order;
use App\Models\OutletSetting;
use Carbon\Carbon;

/**
 * Teks notifikasi order (Telegram & WhatsApp/Fonnte) — satu format.
 */
class OrderNotificationMessageFormatter
{
    public static function format(Order $order): string
    {
        $order->loadMissing(['customer', 'items.servicePackage']);

        $outletName = OutletSetting::get('outlet_name', 'Resik Laundry');
        $customerName = $order->customer?->name ?? 'Pelanggan';
        $customerPhone = $order->customer?->phone ?? '';

        $total = (float) $order->total;
        $paid = (float) $order->paid;
        $sisa = max(0, $total - $paid);

        $dateStr = Carbon::parse($order->created_at)->locale('id_ID')->translatedFormat('d M Y, H.i');
        $estimateStr = $order->estimate_ready_at
            ? Carbon::parse($order->estimate_ready_at)->locale('id_ID')->translatedFormat('D, d M, H.i')
            : '-';

        $lines = [
            $outletName,
            '',
            '--------------------------------',
            '',
            'No. Order',
            $order->order_number,
            '',
            'Tanggal',
            $dateStr,
            '',
            'Pelanggan',
            $customerName,
        ];

        if ($customerPhone) {
            $lines[] = '';
            $lines[] = 'Telepon';
            $lines[] = $customerPhone;
        }

        $paymentMethod = self::paymentMethodLabel($order->payment_method);
        if ($paymentMethod) {
            $lines[] = '';
            $lines[] = 'Metode Pembayaran';
            $lines[] = $paymentMethod;
        }

        $lines[] = '';
        $lines[] = '--------------------------------';
        $lines[] = '';

        foreach ($order->items as $item) {
            $pkg = $item->servicePackage;
            $name = $pkg?->name ?? 'Layanan';
            $qty = (float) $item->quantity;
            $unit = $pkg?->unit ?? 'kg';
            $qtyStr = number_format($qty, 2, '.', '');
            $subtotal = (float) $item->subtotal;
            $lines[] = "{$name} ({$qtyStr} {$unit})";
            $lines[] = 'Rp '.number_format($subtotal, 0, ',', '.');
            $lines[] = '';
        }

        $lines[] = '--------------------------------';
        $lines[] = '';
        $lines[] = 'TOTAL';
        $lines[] = 'Rp '.number_format($total, 0, ',', '.');
        $lines[] = '';
        $lines[] = 'DP Terbayar';
        $lines[] = 'Rp '.number_format($paid, 0, ',', '.');
        $lines[] = '';
        $lines[] = 'Sisa Tagihan';
        $lines[] = 'Rp '.number_format($sisa, 0, ',', '.');
        $lines[] = '';
        $lines[] = '--------------------------------';
        $lines[] = '';
        $lines[] = "Estimasi selesai: {$estimateStr}";
        $lines[] = '';
        $lines[] = 'Scan QR / Cek status di aplikasi';
        $lines[] = '';
        $lines[] = 'Terima kasih atas kunjungannya';

        return implode("\n", $lines);
    }

    public static function paymentMethodLabel(?string $value): string
    {
        if (empty($value)) {
            return '';
        }
        $map = [
            'tunai' => 'Tunai',
            'transfer' => 'Transfer',
            'qris' => 'QRIS',
            'e_wallet' => 'E-Wallet',
            'lainnya' => 'Lainnya',
        ];

        return $map[$value] ?? $value;
    }
}
