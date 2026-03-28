<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_packages', function (Blueprint $table) {
            if (! Schema::hasColumn('service_packages', 'category')) {
                $table->string('category', 120)->nullable();
            }
            if (! Schema::hasColumn('service_packages', 'sort_order')) {
                $table->unsignedInteger('sort_order')->default(0);
            }
            if (! Schema::hasColumn('service_packages', 'group_slug')) {
                $table->string('group_slug', 120)->nullable()->index();
            }
            if (! Schema::hasColumn('service_packages', 'group_title')) {
                $table->string('group_title', 255)->nullable();
            }
            if (! Schema::hasColumn('service_packages', 'variant_label')) {
                $table->string('variant_label', 120)->nullable();
            }
            if (! Schema::hasColumn('service_packages', 'speed')) {
                $table->string('speed', 20)->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_packages', function (Blueprint $table) {
            $cols = ['category', 'sort_order', 'group_slug', 'group_title', 'variant_label', 'speed'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('service_packages', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
