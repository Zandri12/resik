<?php

namespace App\Console\Commands;

use App\Models\OutletSetting;
use App\Services\ReportService;
use App\Services\TelegramNotificationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;

class SendScheduledReport extends Command
{
    protected $signature = 'report:send-scheduled';

    protected $description = 'Kirim laporan rekapan otomatis ke Telegram sesuai jadwal';

    public function __construct(
        protected ReportService $reportService,
        protected TelegramNotificationService $telegram
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $schedule = OutletSetting::get('report_schedule', 'off');
        if ($schedule === 'off') {
            return self::SUCCESS;
        }

        $token = OutletSetting::get('telegram_bot_token');
        $chatId = OutletSetting::get('telegram_chat_id');
        if (empty($token) || empty($chatId)) {
            $this->warn('Telegram tidak dikonfigurasi. Lewati pengiriman laporan.');

            return self::SUCCESS;
        }

        [$from, $to] = $this->getDateRangeForSchedule($schedule);
        $type = OutletSetting::get('report_schedule_type', 'both');
        $format = OutletSetting::get('report_schedule_format', 'pdf');
        $signature = OutletSetting::get('report_signature', 'Owner');

        $data = $this->reportService->getReportData($from, $to, $type);
        $data['outlet_name'] = OutletSetting::get('outlet_name', 'Resik Laundry');
        $data['signature'] = $signature;
        $data['generated_at'] = Carbon::now()->locale('id_ID')->translatedFormat('d F Y, H:i');
        $data['signature_font_base64'] = $this->getSignatureFontBase64();
        $data['signature_font_path'] = $this->getSignatureFontPath();

        $fromLabel = Carbon::parse($from)->locale('id_ID')->translatedFormat('d M Y');
        $toLabel = Carbon::parse($to)->locale('id_ID')->translatedFormat('d M Y');
        $filename = 'rekapan-' . $from . '_' . $to;
        $caption = "Laporan Rekapan Otomatis\n{$fromLabel} - {$toLabel}";

        try {
            if ($format === 'pdf') {
                $pdf = Pdf::loadView('reports.report-pdf', $data)
                    ->setPaper('a4', 'portrait')
                    ->setOption('isRemoteEnabled', true)
                    ->setOption('defaultFont', 'DejaVu Sans');

                $path = 'reports/' . uniqid('scheduled_') . '.pdf';
                Storage::put($path, $pdf->output());
                $fullPath = Storage::path($path);
                $ok = $this->telegram->sendDocument($fullPath, $filename . '.pdf', $caption);
                Storage::delete($path);
            } else {
                $export = new \App\Exports\ReportExport($data);
                $path = 'reports/' . uniqid('scheduled_') . '.xlsx';
                Excel::store($export, $path, 'local');
                $fullPath = Storage::path($path);
                $ok = $this->telegram->sendDocument($fullPath, $filename . '.xlsx', $caption);
                Storage::delete($path);
            }

            if ($ok) {
                $this->info("Laporan berhasil dikirim ke Telegram ({$from} - {$to})");
            } else {
                $this->warn('Gagal mengirim laporan ke Telegram.');
            }
        } catch (\Throwable $e) {
            $this->error('Error: ' . $e->getMessage());

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function getDateRangeForSchedule(string $schedule): array
    {
        $today = Carbon::today();

        return match ($schedule) {
            'daily' => [
                $today->copy()->subDay()->format('Y-m-d'),
                $today->copy()->subDay()->format('Y-m-d'),
            ],
            'weekly' => [
                $today->copy()->subWeek()->startOfWeek()->format('Y-m-d'),
                $today->copy()->subWeek()->endOfWeek()->format('Y-m-d'),
            ],
            'monthly' => [
                $today->copy()->subMonth()->startOfMonth()->format('Y-m-d'),
                $today->copy()->subMonth()->endOfMonth()->format('Y-m-d'),
            ],
            'yearly' => [
                $today->copy()->subYear()->startOfYear()->format('Y-m-d'),
                $today->copy()->subYear()->endOfYear()->format('Y-m-d'),
            ],
            default => [$today->format('Y-m-d'), $today->format('Y-m-d')],
        };
    }

    private function getSignatureFontBase64(): ?string
    {
        $path = $this->getSignatureFontPath();
        if (! $path) {
            return null;
        }

        return base64_encode(file_get_contents($path));
    }

    private function getSignatureFontPath(): ?string
    {
        $path = storage_path('fonts/DancingScript-Regular.otf');

        return file_exists($path) ? $path : null;
    }
}
