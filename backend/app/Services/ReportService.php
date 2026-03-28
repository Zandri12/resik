<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderStatus;
use App\Support\Cashflow;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ReportService
{
    public function getReportData(string $from, string $to, string $type): array
    {
        $start = Carbon::parse($from)->startOfDay();
        $end = Carbon::parse($to)->endOfDay();

        $completedStatusId = OrderStatus::whereIn('name', ['selesai', 'diambil'])->value('id');

        $orders = collect();
        $expenses = collect();
        $income = 0.0;
        $incomeAccrual = 0.0;
        $totalExpenses = 0.0;

        if (in_array($type, ['transactions', 'both'])) {
            $orders = Order::with(['customer', 'status', 'items.servicePackage'])
                ->whereBetween('created_at', [$start, $end])
                ->orderBy('created_at')
                ->get();

            $incomeAccrual = $completedStatusId
                ? (float) Order::whereBetween('created_at', [$start, $end])
                    ->where('status_id', $completedStatusId)
                    ->sum('total')
                : (float) Order::whereBetween('created_at', [$start, $end])->sum('total');

            $income = Cashflow::cashReceivedBetween($start, $end);
        }

        if (in_array($type, ['expenses', 'both'])) {
            $expenses = Expense::with(['expenseCategory', 'createdBy'])
                ->whereBetween('expense_date', [$start, $end])
                ->orderBy('expense_date')
                ->get();

            $totalExpenses = (float) $expenses->sum('amount');
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
            'orders_count' => $orders->count(),
            'expenses_count' => $expenses->count(),
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
