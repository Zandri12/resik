<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class OrderDatabaseNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $type,
        public Order $order,
        public ?string $statusLabel = null,
        public ?int $actorId = null,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->type,
            'order_id' => $this->order->id,
            'order_number' => $this->order->order_number,
            'message' => $this->buildMessage(),
            'status_label' => $this->statusLabel,
            'actor_id' => $this->actorId,
        ];
    }

    protected function buildMessage(): string
    {
        if ($this->type === 'order_created') {
            return 'Order baru: '.$this->order->order_number;
        }

        if ($this->type === 'order_status_changed') {
            $label = $this->statusLabel ?? '';

            return 'Status order '.$this->order->order_number.' berubah menjadi '.$label;
        }

        return $this->order->order_number;
    }
}
