<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Status order: diterima, diproses, selesai, batal.
 * Hanya jalan jika masih ada status lama (cuci, setrika, siap_diambil, diambil).
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $hasLegacy = DB::table('order_statuses')
            ->whereIn('name', ['cuci', 'setrika', 'siap_diambil', 'diambil'])
            ->exists();

        if (! $hasLegacy) {
            // DB baru (seed 4 status) atau sudah dimigrasi — sinkronkan urutan/warna saja
            DB::table('order_statuses')->where('name', 'diterima')->update(['sort_order' => 1, 'color' => '#3b82f6', 'updated_at' => $now]);
            DB::table('order_statuses')->where('name', 'diproses')->update(['sort_order' => 2, 'color' => '#0ea5e9', 'updated_at' => $now]);
            DB::table('order_statuses')->where('name', 'selesai')->update(['sort_order' => 3, 'color' => '#22c55e', 'updated_at' => $now]);
            DB::table('order_statuses')->where('name', 'batal')->update(['sort_order' => 4, 'color' => '#ef4444', 'updated_at' => $now]);

            return;
        }

        $diprosesId = DB::table('order_statuses')->where('name', 'diproses')->value('id');
        if (! $diprosesId) {
            $diprosesId = DB::table('order_statuses')->insertGetId([
                'name' => 'diproses',
                'sort_order' => 2,
                'color' => '#0ea5e9',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $selesaiId = DB::table('order_statuses')->where('name', 'selesai')->value('id');
        if (! $selesaiId) {
            $selesaiId = DB::table('order_statuses')->insertGetId([
                'name' => 'selesai',
                'sort_order' => 3,
                'color' => '#22c55e',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (['cuci', 'setrika'] as $name) {
            $id = DB::table('order_statuses')->where('name', $name)->value('id');
            if ($id) {
                DB::table('orders')->where('status_id', $id)->update(['status_id' => $diprosesId]);
                DB::table('order_statuses')->where('id', $id)->delete();
            }
        }

        foreach (['siap_diambil', 'diambil'] as $name) {
            $id = DB::table('order_statuses')->where('name', $name)->value('id');
            if ($id) {
                DB::table('orders')->where('status_id', $id)->update(['status_id' => $selesaiId]);
                DB::table('order_statuses')->where('id', $id)->delete();
            }
        }

        DB::table('order_statuses')->where('name', 'diterima')->update(['sort_order' => 1, 'color' => '#3b82f6', 'updated_at' => $now]);
        DB::table('order_statuses')->where('name', 'diproses')->update(['sort_order' => 2, 'color' => '#0ea5e9', 'updated_at' => $now]);
        DB::table('order_statuses')->where('name', 'selesai')->update(['sort_order' => 3, 'color' => '#22c55e', 'updated_at' => $now]);
        DB::table('order_statuses')->where('name', 'batal')->update(['sort_order' => 4, 'color' => '#ef4444', 'updated_at' => $now]);
    }

    public function down(): void
    {
        //
    }
};
