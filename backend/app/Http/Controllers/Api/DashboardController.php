<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderStatus;
use App\Support\Cashflow;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $period = $request->get('period', 'today'); // today, week, month
        $today = Carbon::today();

        if ($period === 'today') {
            $start = $today;
            $end = $today;
        } elseif ($period === 'week') {
            $start = $today->copy()->startOfWeek();
            $end = $today;
        } else {
            $start = $today->copy()->startOfMonth();
            $end = $today;
        }

        $completedStatusId = OrderStatus::where('name', 'selesai')->value('id')
            ?? OrderStatus::where('name', 'diambil')->value('id');
        $batalStatusId = OrderStatus::where('name', 'batal')->value('id') ?? 0;

        if ($period === 'today') {
            $ordersQuery = Order::whereDate('created_at', $today);
        } else {
            $ordersQuery = Order::whereBetween('created_at', [$start, $end->endOfDay()]);
        }

        $ordersCount = (clone $ordersQuery)->count();
        $grossTotal = (float) (clone $ordersQuery)->sum('total');
        $income = $completedStatusId
            ? (float) (clone $ordersQuery)->where('status_id', $completedStatusId)->sum('total')
            : 0.0;
        $expenses = Expense::whereBetween('expense_date', [$start, $end])->sum('amount');
        $profitAccrual = $income - $expenses;

        $cashStart = $start->copy()->startOfDay();
        $cashEnd = $period === 'today' ? $today->copy()->endOfDay() : $end->copy()->endOfDay();
        $cashReceived = Cashflow::cashReceivedBetween($cashStart, $cashEnd);
        $profit = $cashReceived - $expenses;

        $unpaidInPeriodQuery = (clone $ordersQuery)->whereColumn('paid', '<', 'total');
        if ($batalStatusId) {
            $unpaidInPeriodQuery->where('status_id', '!=', $batalStatusId);
        }
        $unpaid_orders = (int) (clone $unpaidInPeriodQuery)->count();
        $total_paid = $cashReceived;

        $receivablesQuery = Order::query()->whereColumn('paid', '<', 'total');
        if ($batalStatusId) {
            $receivablesQuery->where('status_id', '!=', $batalStatusId);
        }
        $receivables = (float) ($receivablesQuery->sum(DB::raw('total - paid')) ?? 0);

        $excludeStatus = array_values(array_filter([$completedStatusId, $batalStatusId]));
        $pendingOrders = count($excludeStatus)
            ? Order::whereNotIn('status_id', $excludeStatus)->whereDate('created_at', $today)->count()
            : Order::whereDate('created_at', $today)->count();

        $deliveredOrders = $completedStatusId
            ? Order::whereDate('created_at', $today)->where('status_id', $completedStatusId)->count()
            : 0;

        $statuses = OrderStatus::orderBy('sort_order')->get(['id', 'name']);
        $countsByStatus = Order::whereDate('created_at', $today)
            ->selectRaw('status_id, count(*) as c')
            ->groupBy('status_id')
            ->pluck('c', 'status_id');
        $orders_by_status = $statuses->map(fn ($s) => [
            'name' => $s->name,
            'count' => (int) ($countsByStatus[$s->id] ?? 0),
        ])->values()->all();

        return response()->json([
            'period' => $period,
            'orders_count' => $ordersCount,
            'gross_total' => $grossTotal,
            'income' => (float) $income,
            'income_accrual' => (float) $income,
            'cash_received' => (float) $cashReceived,
            'expenses' => (float) $expenses,
            'profit' => (float) $profit,
            'profit_accrual' => (float) $profitAccrual,
            'pending_orders' => $pendingOrders,
            'delivered_orders' => $deliveredOrders,
            'unpaid_orders' => $unpaid_orders,
            'total_paid' => $total_paid,
            'receivables' => $receivables,
            'orders_by_status' => $orders_by_status,
        ]);
    }

    public function weeklyTrend(Request $request)
    {
        $allStatuses = $request->boolean('all_statuses');
        $fromDateInput = $request->get('from_date');
        $toDateInput = $request->get('to_date');

        if ($fromDateInput && $toDateInput) {
            $fromDate = Carbon::parse($fromDateInput)->startOfDay();
            $toDate = Carbon::parse($toDateInput)->startOfDay();
            if ($fromDate->gt($toDate)) {
                return response()->json(['message' => 'from_date must be before or equal to to_date'], 400);
            }
            $daysDiff = $fromDate->diffInDays($toDate) + 1;
            $maxDays = 31;
            if ($daysDiff > $maxDays) {
                $toDate = $fromDate->copy()->addDays($maxDays - 1);
            }
            $completedStatusId = OrderStatus::where('name', 'selesai')->value('id')
                ?? OrderStatus::where('name', 'diambil')->value('id');
            $days = [];
            $current = $fromDate->copy();
            while ($current->lte($toDate)) {
                $start = $current->copy()->startOfDay();
                $end = $current->copy()->endOfDay();
                $ordersQuery = Order::whereBetween('created_at', [$start, $end]);
                $income = $allStatuses || ! $completedStatusId
                    ? (float) (clone $ordersQuery)->sum('total')
                    : (float) (clone $ordersQuery)->where('status_id', $completedStatusId)->sum('total');
                $cashReceived = Cashflow::cashReceivedOnDate($current);
                $days[] = [
                    'date' => $current->format('Y-m-d'),
                    'day_label' => $current->locale('id')->isoFormat('ddd'),
                    'orders_count' => (clone $ordersQuery)->count(),
                    'income' => $income,
                    'cash_received' => $cashReceived,
                ];
                $current->addDay();
            }
            return response()->json(['days' => $days]);
        }

        $endDateInput = $request->get('end_date');
        if ($endDateInput) {
            $endDate = Carbon::parse($endDateInput)->startOfDay();
        } else {
            $offset = (int) $request->get('offset', 0);
            $offset = max(0, $offset);
            $endDate = Carbon::today()->subDays(7 * $offset);
        }

        $completedStatusId = OrderStatus::where('name', 'selesai')->value('id')
            ?? OrderStatus::where('name', 'diambil')->value('id');
        $days = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = $endDate->copy()->subDays(6 - $i);
            $start = $date->copy()->startOfDay();
            $end = $date->copy()->endOfDay();
            $ordersQuery = Order::whereBetween('created_at', [$start, $end]);
            $income = $allStatuses || ! $completedStatusId
                ? (float) (clone $ordersQuery)->sum('total')
                : (float) (clone $ordersQuery)->where('status_id', $completedStatusId)->sum('total');
            $cashReceived = Cashflow::cashReceivedOnDate($date);
            $days[] = [
                'date' => $date->format('Y-m-d'),
                'day_label' => $date->locale('id')->isoFormat('ddd'),
                'orders_count' => (clone $ordersQuery)->count(),
                'income' => $income,
                'cash_received' => $cashReceived,
            ];
        }
        return response()->json(['days' => $days]);
    }

    /**
     * Tren pendapatan bulanan (semua status). Riwayat tetap: N bulan terakhir.
     * Setiap bulan menyertakan breakdown order per status (by_status).
     */
    public function monthlyTrend(Request $request)
    {
        $months = (int) $request->get('months', 12);
        $months = max(1, min(24, $months)); // 1–24 bulan

        $allStatuses = true;
        $completedStatusId = OrderStatus::where('name', 'selesai')->value('id')
            ?? OrderStatus::where('name', 'diambil')->value('id');
        $statuses = OrderStatus::orderBy('sort_order')->get(['id', 'name']);

        $endMonth = Carbon::today()->startOfMonth();
        $monthsData = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $monthStart = $endMonth->copy()->subMonths($i);
            $monthEnd = $monthStart->copy()->endOfMonth();
            $ordersQuery = Order::whereBetween('created_at', [$monthStart, $monthEnd]);
            $income = $allStatuses || ! $completedStatusId
                ? (float) (clone $ordersQuery)->sum('total')
                : (float) (clone $ordersQuery)->where('status_id', $completedStatusId)->sum('total');
            $cashReceived = Cashflow::cashReceivedBetween($monthStart->copy()->startOfDay(), $monthEnd->copy()->endOfDay());

            $countsByStatus = Order::whereBetween('created_at', [$monthStart, $monthEnd])
                ->selectRaw('status_id, count(*) as c')
                ->groupBy('status_id')
                ->pluck('c', 'status_id');

            $byStatus = $statuses->map(fn ($s) => [
                'name' => $s->name,
                'count' => (int) ($countsByStatus[$s->id] ?? 0),
            ])->values()->all();

            $monthsData[] = [
                'date' => $monthStart->format('Y-m'),
                'month_label' => $monthStart->locale('id')->isoFormat('MMM YYYY'),
                'orders_count' => $ordersQuery->count(),
                'income' => $income,
                'cash_received' => $cashReceived,
                'by_status' => $byStatus,
            ];
        }

        return response()->json(['months' => $monthsData]);
    }
}
