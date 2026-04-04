<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderStatus;
use App\Support\Cashflow;
use Carbon\Carbon;

class ReportService
{
    /**
     * @param  bool  $summaryOnly  Hanya agregat di DB — tanpa memuat koleksi order/pengeluaran (untuk dashboard).
     */
    public function getReportData(string $from, string $to, string $type, bool $summaryOnly = false): array
    {
        $start = Carbon::parse($from)->startOfDay();
        $end = Carbon::parse($to)->endOfDay();

        $orders = collect();
        $expenses = collect();
        $income = 0.0;
        $incomeAccrual = 0.0;
        $totalExpenses = 0.0;
        $ordersCount = 0;
        $expensesCount = 0;

        if (in_array($type, ['transactions', 'both'], true)) {
            $completedStatusId = OrderStatus::whereIn('name', ['selesai', 'diambil'])->value('id');

            $incomeAccrual = $completedStatusId
                ? (float) Order::query()
                    ->whereBetween('created_at', [$start, $end])
                    ->where('status_id', $completedStatusId)
                    ->sum('total')
                : (float) Order::query()
                    ->whereBetween('created_at', [$start, $end])
                    ->sum('total');

            $income = Cashflow::cashReceivedBetween($start, $end);

            if ($summaryOnly) {
                $ordersCount = (int) Order::query()
                    ->whereBetween('created_at', [$start, $end])
                    ->count();
            } else {
                $orders = Order::with(['customer', 'status', 'items.servicePackage'])
                    ->whereBetween('created_at', [$start, $end])
                    ->orderBy('created_at')
                    ->get();
                $ordersCount = $orders->count();
            }
        }

        if (in_array($type, ['expenses', 'both'], true)) {
            if ($summaryOnly) {
                $totalExpenses = (float) Expense::query()
                    ->whereBetween('expense_date', [$start, $end])
                    ->sum('amount');
                $expensesCount = (int) Expense::query()
                    ->whereBetween('expense_date', [$start, $end])
                    ->count();
            } else {
                $expenses = Expense::with(['expenseCategory', 'createdBy'])
                    ->whereBetween('expense_date', [$start, $end])
                    ->orderBy('expense_date')
                    ->get();
                $totalExpenses = (float) $expenses->sum('amount');
                $expensesCount = $expenses->count();
            }
        }

        $profitAccrual = $incomeAccrual - $totalExpenses;
        $profit = $income - $totalExpenses;

        return [
            'from' => $from,
            'to' => $to,
            'type' => $type,
            'orders' => $orders,
            'expenses' => $expenses,
            'income' => $income,
            'income_accrual' => $incomeAccrual,
            'total_expenses' => $totalExpenses,
            'profit' => $profit,
            'profit_accrual' => $profitAccrual,
            'orders_count' => $ordersCount,
            'expenses_count' => $expensesCount,
        ];
    }

    public function getDateRangeFromPreset(string $preset): array
    {
        $today = Carbon::today();

        return match ($preset) {
            'today' => [$today->format('Y-m-d'), $today->format('Y-m-d')],
            'week' => [
                $today->copy()->startOfWeek()->format('Y-m-d'),
                $today->format('Y-m-d'),
            ],
            'month' => [
                $today->copy()->startOfMonth()->format('Y-m-d'),
                $today->format('Y-m-d'),
            ],
            'year' => [
                $today->copy()->startOfYear()->format('Y-m-d'),
                $today->format('Y-m-d'),
            ],
            default => [$today->format('Y-m-d'), $today->format('Y-m-d')],
        };
    }
}
