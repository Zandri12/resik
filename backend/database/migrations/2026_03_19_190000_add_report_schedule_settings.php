<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Report schedule settings stored in outlet_settings (key-value)
        // Keys: report_schedule (daily|weekly|monthly|yearly|off)
        //       report_schedule_type (transactions|expenses|both)
        //       report_schedule_format (pdf|excel)
        //       report_signature (string)
        // No new tables needed - using existing outlet_settings
    }

    public function down(): void
    {
        //
    }
};
