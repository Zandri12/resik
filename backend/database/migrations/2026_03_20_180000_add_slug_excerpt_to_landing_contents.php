<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_contents', function (Blueprint $table) {
            $table->string('slug', 192)->nullable()->unique()->after('title');
            $table->text('excerpt')->nullable()->after('slug');
        });

        Schema::table('landing_contents', function (Blueprint $table) {
            $table->longText('body')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('landing_contents', function (Blueprint $table) {
            $table->dropColumn(['slug', 'excerpt']);
        });

        Schema::table('landing_contents', function (Blueprint $table) {
            $table->text('body')->nullable()->change();
        });
    }
};
