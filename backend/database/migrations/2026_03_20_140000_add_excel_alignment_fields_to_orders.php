<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('paid_at')->nullable();
            $table->string('receipt_number', 50)->nullable();
            $table->string('transaction_category', 150)->nullable();
            $table->timestamp('whatsapp_order_sent_at')->nullable();
            $table->timestamp('whatsapp_done_sent_at')->nullable();
            $table->boolean('is_reconciled')->default(false);

            $table->index('receipt_number');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['receipt_number']);
            $table->dropColumn([
                'paid_at',
                'receipt_number',
                'transaction_category',
                'whatsapp_order_sent_at',
                'whatsapp_done_sent_at',
                'is_reconciled',
            ]);
        });
    }
};
