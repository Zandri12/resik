<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Midtrans\Config;
use Midtrans\Notification;
use Midtrans\Snap;

class MidtransController extends Controller
{
    public function __construct(
        protected OrderService $orderService
    ) {
        Config::$serverKey = config('midtrans.server_key');
        Config::$isProduction = config('midtrans.is_production');
        Config::$isSanitized = config('midtrans.is_sanitized');
        Config::$is3ds = config('midtrans.is_3ds');
    }

    /**
     * Return client key for frontend (safe to expose).
     */
    public function config()
    {
        $key = config('midtrans.client_key');
        if (! $key) {
            return response()->json(['enabled' => false, 'client_key' => null]);
        }

        return response()->json([
            'enabled' => true,
            'client_key' => $key,
            'is_production' => config('midtrans.is_production'),
        ]);
    }

    /**
     * Create Snap token for an order. Order must exist and use payment_method=midtrans.
     */
    public function createSnapToken(Order $order)
    {
        if (! config('midtrans.server_key')) {
            return response()->json(['error' => 'Midtrans tidak dikonfigurasi'], 500);
        }

        $order->load('customer');

        $params = [
            'transaction_details' => [
                'order_id' => $order->order_number,
                'gross_amount' => (int) round($order->total),
            ],
            'customer_details' => [
                'first_name' => $order->customer->name,
                'email' => $order->customer->email ?? 'customer@resik.local',
                'phone' => $order->customer->phone ?? '08123456789',
            ],
            'credit_card' => [
                'secure' => true,
            ],
        ];

        try {
            $snapToken = Snap::getSnapToken($params);

            return response()->json([
                'token' => $snapToken,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ]);
        } catch (\Throwable $e) {
            Log::error('Midtrans snap token error: ' . $e->getMessage());

            return response()->json(['error' => 'Gagal membuat token pembayaran'], 500);
        }
    }

    /**
     * Handle Midtrans HTTP notification (webhook). No auth - called by Midtrans server.
     */
    public function webhook(Request $request)
    {
        try {
            $notification = new Notification();

            $orderId = $notification->order_id;
            $transactionStatus = $notification->transaction_status;
            $fraudStatus = $notification->fraud_status ?? null;

            $order = Order::where('order_number', $orderId)->first();
            if (! $order) {
                Log::warning("Midtrans webhook: order not found: {$orderId}");

                return response()->json(['message' => 'Order not found'], 404);
            }

            if ($transactionStatus === 'capture') {
                if ($fraudStatus === 'accept') {
                    $order->update(['paid' => $order->total]);
                    $order->refresh();
                    $this->orderService->syncPaidAtIfFullyPaid($order);
                    Log::info("Midtrans: Order {$orderId} paid (capture)");
                }
            } elseif ($transactionStatus === 'settlement') {
                $order->update(['paid' => $order->total]);
                $order->refresh();
                $this->orderService->syncPaidAtIfFullyPaid($order);
                Log::info("Midtrans: Order {$orderId} paid (settlement)");
            } elseif ($transactionStatus === 'pending') {
                Log::info("Midtrans: Order {$orderId} pending payment");
            } elseif (in_array($transactionStatus, ['deny', 'cancel', 'expire'])) {
                Log::info("Midtrans: Order {$orderId} {$transactionStatus}");
            }

            return response()->json(['message' => 'OK']);
        } catch (\Throwable $e) {
            Log::error('Midtrans webhook error: ' . $e->getMessage());

            return response()->json(['error' => 'Webhook failed'], 500);
        }
    }
}
