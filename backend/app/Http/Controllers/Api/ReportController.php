<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OutletSetting;
use App\Services\ReportService;
use App\Services\TelegramNotificationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        protected ReportService $reportService,
        protected TelegramNotificationService $telegram
    ) {}

    public function index(Request $request)
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'type' => 'required|in:transactions,expenses,both',
        ]);

        $data = $this->reportService->getReportData(
            $request->from,
            $request->to,
            $request->type
        );

        return response()->json($data);
    }

    public function download(Request $request): \Illuminate\Http\Response|StreamedResponse|BinaryFileResponse
    {
        if (! $request->user()?->hasPermission('reports.download')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'type' => 'required|in:transactions,expenses,both',
            'format' => 'required|in:pdf,excel',
            'signature' => 'nullable|string|max:100',
        ]);

        $data = $this->reportService->getReportData(
            $request->from,
            $request->to,
            $request->type
        );

        $outletName = OutletSetting::get('outlet_name', 'Resik Laundry');
        $signature = $request->signature ?: 'Owner';
        $data['outlet_name'] = $outletName;
        $data['signature'] = $signature;
        $data['generated_at'] = Carbon::now()->locale('id_ID')->translatedFormat('d F Y, H:i');
        $data['signature_font_base64'] = $this->getSignatureFontBase64();
        $data['signature_font_path'] = $this->getSignatureFontPath();

        $fromLabel = Carbon::parse($request->from)->locale('id_ID')->translatedFormat('d M Y');
        $toLabel = Carbon::parse($request->to)->locale('id_ID')->translatedFormat('d M Y');
        $filename = 'rekapan-' . $request->from . '_' . $request->to;

        if ($request->format === 'pdf') {
            $pdf = Pdf::loadView('reports.report-pdf', $data)
                ->setPaper('a4', 'portrait')
                ->setOption('isRemoteEnabled', true)
                ->setOption('defaultFont', 'DejaVu Sans');

            return $pdf->stream($filename . '.pdf');
        }

        $export = new \App\Exports\ReportExport($data);
        $filename .= '.xlsx';

        return Excel::download($export, $filename);
    }

    public function sendToTelegram(Request $request)
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'type' => 'required|in:transactions,expenses,both',
            'format' => 'required|in:pdf,excel',
            'signature' => 'nullable|string|max:100',
        ]);

        $data = $this->reportService->getReportData(
            $request->from,
            $request->to,
            $request->type
        );

        $outletName = OutletSetting::get('outlet_name', 'Resik Laundry');
        $signature = $request->signature ?: 'Owner';
        $data['outlet_name'] = $outletName;
        $data['signature'] = $signature;
        $data['generated_at'] = Carbon::now()->locale('id_ID')->translatedFormat('d F Y, H:i');
        $data['signature_font_base64'] = $this->getSignatureFontBase64();
        $data['signature_font_path'] = $this->getSignatureFontPath();

        $fromLabel = Carbon::parse($request->from)->locale('id_ID')->translatedFormat('d M Y');
        $toLabel = Carbon::parse($request->to)->locale('id_ID')->translatedFormat('d M Y');
        $filename = 'rekapan-' . $request->from . '_' . $request->to;

        if ($request->format === 'pdf') {
            $pdf = Pdf::loadView('reports.report-pdf', $data)
                ->setPaper('a4', 'portrait')
                ->setOption('isRemoteEnabled', true)
                ->setOption('defaultFont', 'DejaVu Sans');

            $path = 'reports/' . uniqid('report_') . '.pdf';
            Storage::put($path, $pdf->output());
            $fullPath = Storage::path($path);

            $ok = $this->telegram->sendDocument($fullPath, $filename . '.pdf', "Laporan Rekapan\n{$fromLabel} - {$toLabel}");

            Storage::delete($path);

            return response()->json(['success' => $ok]);
        }

        $export = new \App\Exports\ReportExport($data);
        $path = 'reports/' . uniqid('report_') . '.xlsx';
        Excel::store($export, $path, 'local');
        $fullPath = Storage::path($path);

        $ok = $this->telegram->sendDocument($fullPath, $filename . '.xlsx', "Laporan Rekapan\n{$fromLabel} - {$toLabel}");

        Storage::delete($path);

        return response()->json(['success' => $ok]);
    }

    private function getSignatureFontBase64(): ?string
    {
        $path = $this->getSignatureFontPath();
        if (! $path || ! file_exists($path)) {
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
