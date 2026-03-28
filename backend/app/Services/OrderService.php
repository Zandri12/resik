<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatus;
use App\Models\ServicePackage;
use App\Models\User;
use App\Support\OrderNotificationHelper;
use App\Support\PaymentMethodNormalizer;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        protected WhatsAppNotificationService $whatsAppNotification
    ) {}

    /** Normalize client/Excel variants (e.g. cash → tunai). */
    public function normalizePaymentMethod(?string $method): ?string
    {
        return PaymentMethodNormalizer::normalize($method);
    }

    /** Set paid_at once when order becomes fully paid (if not already set). */
    public function syncPaidAtIfFullyPaid(Order $order): void
    {
        if ((float) $order->total <= 0) {
            return;
        }
        if ((float) $order->paid >= (float) $order->total && $order->paid_at === null) {
            $order->paid_at = Carbon::now();
            $order->save();
        }
    }

    public function generateOrderNumber(): string
    {
        $prefix = 'ORD-' . date('Ymd') . '-';
        $last = Order::where('order_number', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('order_number');

        $seq = $last ? (int) substr($last, -3) + 1 : 1;

        return $prefix . str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }

    public function create(array $data, ?int $userId = null): Order
    {
        $order = DB::transaction(function () use ($data, $userId) {
            $statusId = OrderStatus::where('name', 'diterima')->value('id') ?? $data['status_id'] ?? 1;
            $items = $data['items'] ?? [];

            $total = 0;
            $maxMinutes = 0;

            foreach ($items as $item) {
                $pkg = ServicePackage::find($item['service_package_id']);
                $qty = (float) ($item['quantity'] ?? 1);
                $unitPrice = $pkg ? $pkg->price_per_unit : (float) ($item['unit_price'] ?? 0);
                $subtotal = $qty * $unitPrice;
                $total += $subtotal;
                if ($pkg && $pkg->estimate_minutes) {
                    $maxMinutes = max($maxMinutes, $pkg->estimate_minutes);
                }
            }

            $discount = (float) ($data['discount'] ?? 0);
            $total -= $discount;

            $estimateReadyAt = null;
            if (! empty($data['estimate_ready_at'] ?? null)) {
                $estimateReadyAt = Carbon::parse($data['estimate_ready_at']);
            } elseif ($maxMinutes > 0) {
                $estimateReadyAt = Carbon::now()->addMinutes($maxMinutes);
            }

            $paymentMethod = $this->normalizePaymentMethod($data['payment_method'] ?? null);

            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => $data['customer_id'],
                'status_id' => $statusId,
                'created_by' => $userId,
                'total' => $total,
                'paid' => (float) ($data['paid'] ?? 0),
                'discount' => $discount,
                'notes' => $data['notes'] ?? null,
                'payment_method' => $paymentMethod,
                'paid_at' => ! empty($data['paid_at'] ?? null) ? Carbon::parse($data['paid_at']) : null,
                'receipt_number' => array_key_exists('receipt_number', $data)
                    ? (trim((string) ($data['receipt_number'] ?? '')) ?: null) : null,
                'transaction_category' => array_key_exists('transaction_category', $data)
                    ? (trim((string) ($data['transaction_category'] ?? '')) ?: null) : null,
                'service_speed' => in_array($data['service_speed'] ?? null, ['reguler', 'express'], true)
                    ? $data['service_speed']
                    : null,
                'whatsapp_order_sent_at' => ! empty($data['whatsapp_order_sent_at'] ?? null)
                    ? Carbon::parse($data['whatsapp_order_sent_at']) : null,
                'whatsapp_done_sent_at' => ! empty($data['whatsapp_done_sent_at'] ?? null)
                    ? Carbon::parse($data['whatsapp_done_sent_at']) : null,
                'is_reconciled' => (bool) ($data['is_reconciled'] ?? false),
                'estimate_ready_at' => $estimateReadyAt,
            ]);

            foreach ($items as $item) {
                $pkg = ServicePackage::find($item['service_package_id']);
                $qty = (float) ($item['quantity'] ?? 1);
                $unitPrice = $pkg ? $pkg->price_per_unit : (float) ($item['unit_price'] ?? 0);
                $subtotal = $qty * $unitPrice;

                OrderItem::create([
                    'order_id' => $order->id,
                    'service_package_id' => $item['service_package_id'],
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'subtotal' => $subtotal,
                ]);
            }

            $order->load(['customer', 'status', 'items.servicePackage', 'createdBy']);

            $this->syncPaidAtIfFullyPaid($order);

            return $order;
        });

        // In-app dulu agar selalu tercatat; Fonnte/WA tidak boleh memblokir atau mendahului ini.
        OrderNotificationHelper::notifyOrderUsers(
            $order,
            'order_created',
            null,
            $userId !== null ? User::find($userId) : null
        );

        try {
            $this->whatsAppNotification->sendOrderNotification($order);
        } catch (\Throwable $e) {
            Log::warning('WhatsApp order notification failed', ['error' => $e->getMessage()]);
        }
        // Telegram tidak dikirim otomatis di sini — gunakan aksi manual (detail order / daftar order).

        return $order;
    }

    public function updateStatus(Order $order, int $statusId, ?User $actor = null, ?string $cancellationReason = null): Order
    {
        $order->refresh();
        $order->load('status');

        $name = OrderStatus::find($statusId)?->name;
        $currentName = $order->status?->name;

        if ($name === 'batal') {
            $blocked = ['selesai', 'diambil', 'batal', 'siap_diambil'];
            if (in_array($currentName, $blocked, true)) {
                throw ValidationException::withMessages([
                    'status_id' => ['Order yang sudah selesai/diambil atau sudah batal tidak dapat diubah ke Batal.'],
                ]);
            }
        }

        if (in_array($name, ['selesai', 'diambil'], true) && round((float) $order->total, 2) > 0) {
            if (round((float) $order->paid, 2) < round((float) $order->total, 2)) {
                throw ValidationException::withMessages([
                    'status_id' => ['Order belum lunas. Catat pembayaran (total dibayar) sampai penuh sebelum status Selesai.'],
                ]);
            }
        }

        $patch = ['status_id' => $statusId];
        if ($name === 'batal') {
            $trimmed = $cancellationReason !== null ? trim($cancellationReason) : '';
            $patch['cancellation_reason'] = $trimmed !== '' ? $trimmed : null;
        }

        $order->update($patch);

        if ($name === 'selesai' || $name === 'diambil') {
            $order->update(['taken_at' => Carbon::now()]);
        }

        $fresh = $order->fresh(['customer', 'status', 'items.servicePackage', 'createdBy', 'images']);

        OrderNotificationHelper::notifyOrderUsers(
            $fresh,
            'order_status_changed',
            $fresh->status?->name,
            $actor
        );

        return $fresh;
    }
}
