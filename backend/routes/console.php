<?php

use App\Console\Commands\SendScheduledReport;
use Database\Seeders\DashboardDemoSeeder;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Schedule::command('report:send-scheduled')->dailyAt('07:00');

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('dashboard:seed-demo', function () {
    $this->info('Seeding dashboard demo data (orders + expense for today)...');
    Artisan::call('db:seed', ['--class' => DashboardDemoSeeder::class]);
    $this->info('Done. Refresh the dashboard to see Order Hari Ini and Pendapatan.');
})->purpose('Seed demo data for dashboard summary cards');
