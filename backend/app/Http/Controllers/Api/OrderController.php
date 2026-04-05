<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderImage;
use App\Models\ServicePackage;
use App\Services\OrderService;
use App\Services\TelegramNotificationService;
use App\Services\WhatsAppNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function __construct(
        protected OrderService $orderService,
        protected TelegramNotificationService $telegram,
        protected WhatsAppNotificationService $whatsApp
    ) {}

    public function index(Request $request)
    {
        $query = Order::with(['customer', 'status', 'items.servicePackage', 'createdBy']);

        if ($request->filled('status_id')) {
            $query->where('status_id', $request->status_id);
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->to);
        }
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($qry) use ($q) {
                $qry->where('order_number', 'ilike', "%{$q}%")
                    ->orWhere('receipt_number', 'ilike', "%{$q}%")
                    ->orWhereHas('customer', function ($cq) use ($q) {
                        $cq->where('name', 'ilike', "%{$q}%")
                            ->orWhere('phone', 'ilike', "%{$q}%");
                    });
            });
        }

        $perPage = (int) $request->get('per_page', 15);
        $perPage = max(1, min(50, $perPage));

        $sort = $request->query('sort', 'newest');
        $allowedSorts = ['newest', 'oldest', 'total_high', 'total_low', 'customer_az'];
        if (! in_array($sort, $allowedSorts, true)) {
            $sort = 'newest';
        }

        if ($sort === 'customer_az') {
            $query->leftJoin('customers', 'orders.customer_id', '=', 'customers.id')
                ->orderBy('customers.name')
                ->orderByDesc('orders.created_at')
                ->select('orders.*');
        } else {
            match ($sort) {
                'oldest' => $query->orderBy('orders.created_at'),
                'total_high' => $query->orderByDesc('orders.total'),
                'total_low' => $query->orderBy('orders.total'),
                default => $query->orderByDesc('orders.created_at'),
            };
        }

        return $query->paginate($perPage);
    }

    public function store(Request $request)
    {
        if (! $request->user()?->hasPermission('orders.create')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $valid = $request->validate([
            'customer_id' => [
                'required',
                Rule::exists('customers', 'id')->where(fn ($query) => $query->where('is_blacklisted', false)),
            ],
            'status_id' => 'nullable|exists:order_statuses,id',
            'items' => 'required|array|min:1',
            'items.*.service_package_id' => 'required|exists:service_packages,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'paid' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'payment_method' => 'nullable|string|max:50',
            'paid_at' => 'nullable|date',
            'receipt_number' => 'nullable|string|max:50',
            'transaction_category' => 'nullable|string|max:150',
            'service_speed' => 'nullable|in:reguler,express',
            'whatsapp_order_sent_at' => 'nullable|date',
            'whatsapp_done_sent_at' => 'nullable|date',
            'is_reconciled' => 'sometimes|boolean',
            'estimate_ready_at' => 'nullable|date',
        ], [
            'customer_id.exists' => 'Pelanggan ini tidak dapat digunakan untuk order baru (blacklist).',
        ]);

        $serviceSpeed = $valid['service_speed'] ?? null;
        if ($serviceSpeed !== null) {
            foreach ($valid['items'] as $item) {
                $pkg = ServicePackage::find($item['service_package_id']);
                if (! $pkg) {
                    continue;
                }
                $sp = $pkg->speed;
                if ($sp === null || $sp === '') {
                    continue;
                }
                if ($serviceSpeed === 'reguler' && $sp !== 'reguler') {
                    throw ValidationException::withMessages([
                        'items' => 'Ada layanan yang hanya untuk Express; tidak cocok dengan tipe order Reguler.',
                    ]);
                }
                if ($serviceSpeed === 'express' && $sp !== 'express') {
                    throw ValidationException::withMessages([
                        'items' => 'Ada layanan yang hanya untuk Reguler; tidak cocok dengan tipe order Express.',
                    ]);
                }
            }
        }

        $order = $this->orderService->create($valid, $request->user()?->id);

        return response()->json($order, 201);
    }

    public function show(Order $order)
    {
        return $order->load(['customer', 'status', 'items.servicePackage', 'createdBy', 'images']);
    }

    public function publicStatus(Order $order)
    {
        return response()->json([
            'order_number' => $order->order_number,
            'status' => $order->status->name,
            'customer' => $order->customer->name,
            'total' => $order->total,
            'estimate_ready_at' => $order->estimate_ready_at,
        ]);
    }

    public function update(Request $request, Order $order)
    {
        if (! $request->user()?->hasPermission('orders.edit')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        if ($request->has('status_id')) {
            $request->validate([
                'status_id' => 'required|exists:order_statuses,id',
                'paid' => 'nullable|numeric|min:0',
                'payment_method' => 'nullable|string|max:50',
                'cancellation_reason' => 'nullable|string|max:500',
            ]);

            $paymentPatch = [];
            if ($request->exists('paid')) {
                $paymentPatch['paid'] = round((float) $request->input('paid'), 2);
            }
            if ($request->has('payment_method')) {
                $raw = $request->input('payment_method');
                $paymentPatch['payment_method'] = $this->orderService->normalizePaymentMethod(
                    is_string($raw) && $raw !== '' ? $raw : null
                );
            }

            if ($paymentPatch !== []) {
                $order->update($paymentPatch);
                $order->refresh();
                if (! $request->exists('paid_at')) {
                    $this->orderService->syncPaidAtIfFullyPaid($order);
                }
            }

            return $this->orderService->updateStatus(
                $order,
                (int) $request->status_id,
                $request->user(),
                $request->input('cancellation_reason')
            );
        }

        $valid = $request->validate([
            'paid' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'payment_method' => 'nullable|string|max:50',
            'paid_at' => 'nullable|date',
            'taken_at' => 'nullable|date',
            'receipt_number' => 'nullable|string|max:50',
            'transaction_category' => 'nullable|string|max:150',
            'whatsapp_order_sent_at' => 'nullable|date',
            'whatsapp_done_sent_at' => 'nullable|date',
            'is_reconciled' => 'sometimes|boolean',
        ]);

        if (array_key_exists('payment_method', $valid)) {
            $valid['payment_method'] = $this->orderService->normalizePaymentMethod($valid['payment_method']);
        }
        if (array_key_exists('receipt_number', $valid) && $valid['receipt_number'] !== null) {
            $valid['receipt_number'] = trim((string) $valid['receipt_number']) ?: null;
        }
        if (array_key_exists('transaction_category', $valid) && $valid['transaction_category'] !== null) {
            $valid['transaction_category'] = trim((string) $valid['transaction_category']) ?: null;
        }

        $order->update($valid);
        $order->refresh();

        if (! array_key_exists('paid_at', $valid)) {
            $this->orderService->syncPaidAtIfFullyPaid($order);
        }

        return $order->fresh(['customer', 'status', 'items.servicePackage', 'createdBy', 'images']);
    }

    public function destroy(Request $request, Order $order)
    {
        if (! $request->user()?->hasPermission('orders.delete')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $order->delete();

        return response()->json(null, 204);
    }

    public function sendToTelegram(Order $order)
    {
        $order->load(['customer', 'items.servicePackage', 'images']);
        $ok = $this->telegram->sendOrderNotificationManual($order);

        return response()->json(['success' => $ok]);
    }

    public function sendToWhatsApp(Order $order)
    {
        $order->load(['customer', 'items.servicePackage', 'images']);
        $r = $this->whatsApp->sendOrderNotificationManual($order);

        return response()->json([
            'success' => $r['success'],
            'reason' => $r['reason'],
        ]);
    }

    public function uploadImage(Request $request, Order $order)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:5120',
            'type' => 'nullable|string|in:bukti,karyawan_ambil,pelanggan_terima',
        ]);

        $file = $request->file('image');
        $path = $file->store('order-images/'.$order->id, 'public');

        $image = OrderImage::create([
            'order_id' => $order->id,
            'path' => $path,
            'type' => $request->input('type', 'bukti'),
        ]);

        $this->whatsApp->notifyProofImageUploaded($order, $image);

        return response()->json($image, 201);
    }

    public function deleteImage(Order $order, int $image)
    {
        $img = OrderImage::where('order_id', $order->id)->findOrFail($image);
        Storage::disk('public')->delete($img->path);
        $img->delete();

        return response()->json(null, 204);
    }
}
