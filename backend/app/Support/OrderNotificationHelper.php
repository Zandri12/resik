<?php

namespace App\Support;

use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderDatabaseNotification;
use Illuminate\Support\Facades\Notification;

class OrderNotificationHelper
{
    public static function notifyOrderUsers(Order $order, string $type, ?string $statusLabel = null, ?User $actor = null): void
    {
        $order->loadMissing('customer', 'status');

        $notification = new OrderDatabaseNotification($type, $order, $statusLabel, $actor?->id);

        $users = User::query()->get()->filter(fn (User $u) => $u->hasPermission('orders'));
        if ($actor) {
            $withoutActor = $users->reject(fn (User $u) => $u->id === $actor->id);
            // Jika hanya satu user outlet, jangan kosongkan daftar — notifikasi in-app tetap perlu muncul.
            if ($withoutActor->isNotEmpty()) {
                $users = $withoutActor;
            }
        }

        Notification::send($users, $notification);
    }
}
