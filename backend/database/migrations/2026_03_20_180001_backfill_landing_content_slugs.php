<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('landing_contents')) {
            return;
        }

        $rows = DB::table('landing_contents')->whereNull('slug')->orderBy('id')->get();
        foreach ($rows as $row) {
            $base = Str::slug($row->title) ?: 'konten-'.$row->id;
            $slug = $base;
            $n = 2;
            while (DB::table('landing_contents')->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$n;
                $n++;
            }
            DB::table('landing_contents')->where('id', $row->id)->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        //
    }
};
