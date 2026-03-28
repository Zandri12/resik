<?php

namespace Database\Seeders;

use App\Models\ExpenseCategory;
use Illuminate\Database\Seeder;

class ExpenseCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = ['Listrik', 'Detergen', 'Gaji', 'Gaji Pegawai', 'Gas', 'Sewa', 'Lainnya'];

        foreach ($categories as $name) {
            ExpenseCategory::firstOrCreate(['name' => $name], ['name' => $name]);
        }
    }
}
