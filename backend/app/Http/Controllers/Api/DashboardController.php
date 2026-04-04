<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderStatus;
use App\Models\OutletSetting;
use App\Support\Cashflow;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /** Maks. hari untuk filter `from`+`to` (selaras dengan weekly-trend). */
    public const MAX_CUSTOM_RANGE_DAYS = 92;

    public function index(Request $request)
    {
        $period = $request->get('period', 'today'); // today, week, month, custom
        $today = Carbon::today();

        $fromInput = $request->get('from');
        $toInput = $request->get('to');

        if ($fromInput xor $toInput) {
            return response()->json(['message' => 'Parameter from dan to harus dikirim berpasangan.'], 422);
        }

        if ($fromInput && $toInput) {
            $start = Carbon::parse($fromInput)->startOfDay();
            $end = Carbon::parse($toInput)->startOfDay();
            if ($start->gt($end)) {
                return response()->json(['message' => 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.'], 422);
            }
            $span = (int) $start->diffInDays($end) + 1;
            if ($span > self::MAX_CUSTOM_RANGE_DAYS) {
                $end = $start->copy()->addDays(self::MAX_CUSTOM_RANGE_DAYS - 1)->startOfDay();
            }
            $period = 'custom';
        } elseif ($period === 'today') {
            $start = $today->copy();
            $end = $today->copy();
        } elseif ($period === 'week') {
            $start = $today->copy()->startOfWeek();
            $end = $today->copy();
        } elseif ($period === 'month') {
            $start = $today->copy()->startOfMonth();
            $end = $today->copy();
        } else {
            return response()->json(['message' => 'period harus today, week, atau month jika from/to tidak dipakai.'], 422);
        }

        $completedStatusId = OrderStatus::where('name', 'selesai')->value('id')
            ?? OrderStatus::where('name', 'diambil')->value('id');
        $batalStatusId = OrderStatus::where('name', 'batal')->value('id') ?? 0;

        $useTodayDateOnly = ($period === 'today' && ! ($fromInput && $toInput));

        if ($useTodayDateOnly) {
            $ordersQuery = Order::whereDate('created_at', $today);
        } else {
            $ordersQuery = Order::whereBetween('created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()]);
        }

        $ordersCount = (clone $ordersQuery)->count();
        $grossTotal = (float) (clone $ordersQuery)->sum('total');
        $income = $completedStatusId
            ? (float) (clone $ordersQuery)->where('status_id', $completedStatusId)->sum('total')
            : 0.0;
        $expenses = Expense::whereBetween('expense_date', [$start->toDateString(), $end->toDateString()])->sum('amount');
        $profitAccrual = $income - $expenses;

        $cashStart = $start->copy()->startOfDay();
        $cashEnd = $end->copy()->endOfDay();
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
        // Selaras rentang ringkasan: order dibuat antara $start–$end, belum selesai/batal.
        $pendingOrders = count($excludeStatus)
            ? (int) (clone $ordersQuery)->whereNotIn('status_id', $excludeStatus)->count()
            : (int) (clone $ordersQuery)->count();

        $deliveredOrders = $completedStatusId
            ? (int) (clone $ordersQuery)->where('status_id', $completedStatusId)->count()
            : 0;

        $statuses = OrderStatus::orderBy('sort_order')->get(['id', 'name']);
        // Sama dengan rentang ringkasan / filter (bukan dipotong ke “hari ini” saja).
        $statusRangeStart = $start->copy()->startOfDay();
        $statusRangeEnd = $end->copy()->endOfDay();
        $countsByStatus = Order::whereBetween('created_at', [$statusRangeStart, $statusRangeEnd])
            ->selectRaw('status_id, count(*) as c')
            ->groupBy('status_id')
            ->pluck('c', 'status_id');
        $orders_by_status = $statuses->map(fn ($s) => [
            'name' => $s->name,
            'count' => (int) ($countsByStatus[$s->id] ?? 0),
        ])->values()->all();

        $budgetRaw = OutletSetting::get('expense_budget_target', '0');
        $expenseBudgetTarget = is_numeric($budgetRaw)
            ? (float) $budgetRaw
            : (float) preg_replace('/\D/', '', (string) $budgetRaw);

        return response()->json([
            'period' => $period,
            'range_start' => $start->format('Y-m-d'),
            'range_end' => $end->format('Y-m-d'),
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
            'expense_budget_target' => $expenseBudgetTarget,
            'budget_remaining' => $expenseBudgetTarget > 0 ? $expenseBudgetTarget - (float) $expenses : null,
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
            $maxDays = self::MAX_CUSTOM_RANGE_DAYS;
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

        $throughInput = $request->get('through_date');
        $endMonth = $throughInput
            ? Carbon::parse($throughInput)->startOfMonth()
            : Carbon::today()->startOfMonth();
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
