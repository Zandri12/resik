<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->date('member_valid_from')->nullable()->after('member_discount');
            $table->date('member_valid_until')->nullable()->after('member_valid_from');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['member_valid_from', 'member_valid_until']);
        });
    }
};
