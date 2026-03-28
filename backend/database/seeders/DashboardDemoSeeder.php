<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatus;
use App\Models\ServicePackage;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class DashboardDemoSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::where('role', 'owner')->first();
        $customer = Customer::first();
        $statusDiterima = OrderStatus::where('name', 'diterima')->first();
        $statusSelesai = OrderStatus::where('name', 'selesai')->first()
            ?? OrderStatus::where('name', 'diambil')->first();
        $package = ServicePackage::first();
        $category = ExpenseCategory::first();

        if (! $customer || ! $statusDiterima || ! $statusSelesai || ! $package || ! $owner) {
            return;
        }

        $today = Carbon::today();

        // Hapus order demo hari ini agar bisa di-seed ulang (nomor DEMO-...)
        Order::where('order_number', 'like', 'DEMO-' . $today->format('Ymd') . '%')->each(function (Order $o) {
            $o->items()->delete();
            $o->delete();
        });

        // Order hari ini (status selesai = masuk pendapatan)
        $ordersToday = [
            ['total' => 45000, 'status' => $statusSelesai],
            ['total' => 72000, 'status' => $statusSelesai],
            ['total' => 24000, 'status' => $statusSelesai],
            ['total' => 35000, 'status' => $statusDiterima],
        ];

        $seq = 1;
        foreach ($ordersToday as $row) {
            $orderNumber = 'DEMO-' . $today->format('Ymd') . '-' . str_pad((string) $seq++, 3, '0', STR_PAD_LEFT);
            $order = Order::create([
                'order_number' => $orderNumber,
                'customer_id' => $customer->id,
                'status_id' => $row['status']->id,
                'created_by' => $owner->id,
                'total' => $row['total'],
                'paid' => 0,
                'discount' => 0,
                'notes' => null,
                'estimate_ready_at' => $today->copy()->addHours(2),
                'taken_at' => in_array($row['status']->name, ['selesai', 'diambil'], true) ? $today->copy()->addHours(1) : null,
                'created_at' => $today->copy()->addHours(8)->addMinutes(rand(0, 120)),
            ]);
            OrderItem::create([
                'order_id' => $order->id,
                'service_package_id' => $package->id,
                'quantity' => (int) ($row['total'] / $package->price_per_unit) ?: 1,
                'unit_price' => $package->price_per_unit,
                'subtotal' => $row['total'],
            ]);
        }

        // Beberapa order 2–6 hari lalu agar chart tren ada isi
        for ($daysAgo = 2; $daysAgo <= 6; $daysAgo++) {
            $date = $today->copy()->subDays($daysAgo);
            $orderNumber = 'ORD-' . $date->format('Ymd') . '-001';
            if (Order::where('order_number', $orderNumber)->exists()) {
                continue;
            }
            $total = [35000, 52000, 28000, 61000, 44000][$daysAgo - 2];
            $order = Order::create([
                'order_number' => $orderNumber,
                'customer_id' => $customer->id,
                'status_id' => $statusSelesai->id,
                'created_by' => $owner->id,
                'total' => $total,
                'paid' => $total,
                'discount' => 0,
                'notes' => null,
                'estimate_ready_at' => $date->copy()->addHours(2),
                'taken_at' => $date->copy()->addHours(2),
                'created_at' => $date->copy()->addHours(10),
            ]);
            OrderItem::create([
                'order_id' => $order->id,
                'service_package_id' => $package->id,
                'quantity' => (int) ($total / $package->price_per_unit) ?: 1,
                'unit_price' => $package->price_per_unit,
                'subtotal' => $total,
            ]);
        }

        // Pengeluaran hari ini
        if ($category && ! Expense::where('expense_date', $today)->exists()) {
            Expense::create([
                'expense_category_id' => $category->id,
                'created_by' => $owner->id,
                'amount' => 85000,
                'expense_date' => $today,
                'description' => 'Stok deterjen dan listrik',
            ]);
        }
    }
}
