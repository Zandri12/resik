<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ReportExport implements FromArray, WithHeadings, WithStyles, WithTitle
{
    public function __construct(
        protected array $data
    ) {}

    public function array(): array
    {
        $rows = [];
        $type = $this->data['type'] ?? 'both';

        if (in_array($type, ['transactions', 'both'])) {
            foreach ($this->data['orders'] ?? [] as $order) {
                $rows[] = [
                    $order->order_number ?? '',
                    $order->created_at?->format('d/m/Y H:i') ?? '',
                    $order->customer?->name ?? '-',
                    $order->status?->name ?? '-',
                    $order->payment_method ? (string) $order->payment_method : '-',
                    number_format((float) $order->total, 0, ',', '.'),
                    'Transaksi',
                ];
            }
        }

        if (in_array($type, ['expenses', 'both'])) {
            $num = 0;
            foreach ($this->data['expenses'] ?? [] as $exp) {
                $num++;
                $pay = $exp->payment_method ? (string) $exp->payment_method : '-';
                if ($type === 'expenses') {
                    $rows[] = [
                        (string) $num,
                        $exp->expense_date?->format('d/m/Y') ?? '',
                        $exp->expenseCategory?->name ?? '-',
                        number_format((float) $exp->amount, 0, ',', '.'),
                        $exp->description ?? '-',
                        $pay,
                    ];
                } else {
                    $rows[] = [
                        (string) $num,
                        $exp->expense_date?->format('d/m/Y') ?? '',
                        $exp->expenseCategory?->name ?? '-',
                        $exp->description ?? '-',
                        $pay,
                        number_format((float) $exp->amount, 0, ',', '.'),
                        'Pengeluaran',
                    ];
                }
            }
        }

        return $rows;
    }

    public function headings(): array
    {
        $type = $this->data['type'] ?? 'both';
        if ($type === 'expenses') {
            return ['No.', 'Tanggal', 'Kategori', 'Nominal (Rp)', 'Detail Pencatatan', 'Jenis Pembayaran'];
        }
        if ($type === 'transactions') {
            return ['No. Order', 'Tanggal', 'Pelanggan', 'Status', 'Jenis pembayaran', 'Total (Rp)', 'Tipe'];
        }

        return ['Ref / No.', 'Tanggal', 'Pelanggan / Kategori', 'Status / Detail pencatatan', 'Jenis pembayaran', 'Jumlah (Rp)', 'Tipe'];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true], 'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'E8F4F8']]],
        ];
    }

    public function title(): string
    {
        return 'Rekapan';
    }
}
