<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('is_member')->default(false)->after('address');
        });
        // Migrate existing member_tier data: jika punya tier, set is_member = true
        DB::table('customers')
            ->whereNotNull('member_tier')
            ->where('member_tier', '!=', '')
            ->update(['is_member' => true]);
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('is_member');
        });
    }
};
