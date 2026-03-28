<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderStatus;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeePerformanceController extends Controller
{
    private const MAX_RANGE_DAYS = 366;

    public function index(Request $request)
    {
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'sort' => 'nullable|string|in:orders,revenue,paid,name,completed',
            'dir' => 'nullable|string|in:asc,desc',
        ]);

        $user = $request->user();
        $fromRaw = $request->get('from', Carbon::now()->startOfMonth()->format('Y-m-d'));
        $toRaw = $request->get('to', Carbon::now()->format('Y-m-d'));

        $fromC = Carbon::parse($fromRaw)->startOfDay();
        $toC = Carbon::parse($toRaw)->endOfDay();

        if ($fromC->gt($toC)) {
            return response()->json(['message' => 'Tanggal awal tidak boleh setelah tanggal akhir'], 422);
        }

        if ($fromC->diffInDays($toC) >= self::MAX_RANGE_DAYS) {
            return response()->json(['message' => 'Rentang maksimal '.self::MAX_RANGE_DAYS.' hari'], 422);
        }

        $completedId = OrderStatus::where('name', 'selesai')->value('id')
            ?? OrderStatus::where('name', 'diambil')->value('id');
        $batalId = OrderStatus::where('name', 'batal')->value('id');

        $sortKey = $request->get('sort', 'orders');
        $dir = strtolower((string) $request->get('dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $orderColumn = match ($sortKey) {
            'revenue' => 'total_revenue',
            'paid' => 'total_paid',
            'name' => 'user_name',
            'completed' => 'completed_count',
            default => 'orders_count',
        };

        $q = Order::query()
            ->from('orders')
            ->whereBetween('orders.created_at', [$fromC, $toC])
            ->when($user->isKaryawan(), fn ($sub) => $sub->where('orders.created_by', $user->id))
            ->leftJoin('users', 'users.id', '=', 'orders.created_by')
            ->groupBy('orders.created_by');

        $q->select([
            'orders.created_by',
            DB::raw("COALESCE(MAX(users.name), 'Tanpa kasir') as user_name"),
            DB::raw('COUNT(*) as orders_count'),
            DB::raw('COALESCE(SUM(orders.total), 0) as total_revenue'),
            DB::raw('COALESCE(SUM(orders.paid), 0) as total_paid'),
        ]);

        if ($completedId) {
            $q->selectRaw('SUM(CASE WHEN orders.status_id = ? THEN 1 ELSE 0 END) as completed_count', [$completedId]);
        } else {
            $q->selectRaw('0 as completed_count');
        }

        if ($batalId) {
            $q->selectRaw('SUM(CASE WHEN orders.status_id = ? THEN 1 ELSE 0 END) as cancelled_count', [$batalId]);
        } else {
            $q->selectRaw('0 as cancelled_count');
        }

        $q->selectRaw(
            'CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(orders.total), 0) / COUNT(*) ELSE 0 END as avg_order_value'
        );

        $q->orderBy($orderColumn, $dir);

        $rows = $q->get();

        $data = $rows->map(function ($row) {
            $uid = $row->created_by;
            $ordersCount = (int) $row->orders_count;

            return [
                'user_id' => $uid,
                'name' => (string) $row->user_name,
                'orders_count' => $ordersCount,
                'completed_count' => (int) $row->completed_count,
                'cancelled_count' => (int) $row->cancelled_count,
                'total_revenue' => (float) $row->total_revenue,
                'total_paid' => (float) $row->total_paid,
                'avg_order_value' => round((float) $row->avg_order_value, 2),
                'completion_rate' => $ordersCount > 0
                    ? round(100 * ((int) $row->completed_count) / $ordersCount, 1)
                    : 0.0,
            ];
        });

        $summary = [
            'period_days' => (int) $fromC->copy()->startOfDay()->diffInDays($toC->copy()->startOfDay()) + 1,
            'total_orders' => (int) $data->sum('orders_count'),
            'total_completed' => (int) $data->sum('completed_count'),
            'total_cancelled' => (int) $data->sum('cancelled_count'),
            'total_revenue' => (float) $data->sum('total_revenue'),
            'total_paid' => (float) $data->sum('total_paid'),
            'karyawan_count' => $data->count(),
        ];

        return response()->json([
            'from' => $fromC->format('Y-m-d'),
            'to' => $toC->format('Y-m-d'),
            'sort' => $sortKey,
            'dir' => $dir,
            'summary' => $summary,
            'rows' => $data,
            'is_own_only' => $user->isKaryawan(),
        ]);
    }
}
