<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Laporan Rekapan - {{ $outlet_name }}</title>
    <style>
        @if(!empty($signature_font_path))
        @font-face {
            font-family: 'DancingScript';
            src: url('file:///{{ str_replace('\\', '/', ltrim($signature_font_path, '\\')) }}') format('truetype');
            font-weight: 400;
            font-style: normal;
        }
        @elseif(!empty($signature_font_base64))
        @font-face {
            font-family: 'DancingScript';
            src: url(data:font/truetype;base64,{{ $signature_font_base64 }}) format('truetype');
            font-weight: 400;
            font-style: normal;
        }
        @endif
        @page { margin: 25mm 35mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 9pt;
            color: #1e293b;
            line-height: 1.35;
            padding: 0;
        }
        .container {
            width: 100%;
            padding: 0 5mm;
            max-width: 100%;
        }
        .table-wrap {
            width: 100%;
            margin-bottom: 0;
        }
        .header {
            text-align: center;
            padding: 16px 0 20px 0;
            margin-bottom: 24px;
            border-bottom: 2px solid #0f766e;
        }
        .header h1 {
            font-size: 18pt;
            color: #0f766e;
            font-weight: bold;
            letter-spacing: -0.5px;
            margin-bottom: 6px;
        }
        .header .subtitle {
            font-size: 9pt;
            color: #64748b;
        }
        .meta {
            background: #f1f5f9;
            padding: 16px 20px;
            border-radius: 8px;
            margin-bottom: 24px;
            display: table;
            width: 90%;
        }
        .meta-row { display: table-row; }
        .meta-label {
            display: table-cell;
            font-weight: bold;
            color: #0f766e;
            width: 110px;
            padding: 6px 0;
            font-size: 8pt;
        }
        .meta-value { display: table-cell; padding: 6px 0; font-size: 9pt; word-wrap: break-word; }
        .summary-cards { display: table; width: 90%; margin-bottom: 28px; border-spacing: 8px 0; }
        .summary-card {
            display: table-cell;
            width: 25%;
            padding: 14px 8px;
            text-align: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
        }
        .summary-card .label {
            font-size: 7pt;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .summary-card .value {
            font-size: 11pt;
            font-weight: bold;
            color: #0f766e;
        }
        .summary-card.expense .value { color: #dc2626; }
        .summary-card.profit .value { color: #059669; }
        table { width: 90%; border-collapse: collapse; margin: 0 auto 24px auto; font-size: 7pt; table-layout: fixed; }
        th {
            background: #0f766e;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-size: 6pt;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; word-wrap: break-word; overflow-wrap: break-word; font-size: 7pt; }
        td.amount, th.amount { padding-right: 12px; white-space: nowrap; }
        tr:nth-child(even) { background: #fafafa; }
        .amount { text-align: right; font-weight: 600; }
        .section-title {
            font-size: 10pt;
            font-weight: bold;
            color: #0f766e;
            margin: 28px 0 14px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #0d9488;
        }
        .signature-block {
            margin-top: 48px;
            padding: 24px 8mm 0 0;
            text-align: right;
            border-top: 1px dashed #cbd5e1;
        }
        .signature-label {
            font-size: 8pt;
            color: #64748b;
            margin-bottom: 10px;
        }
        .signature-name {
            @if(!empty($signature_font_base64) || !empty($signature_font_path))
            font-family: 'DancingScript', 'DejaVu Sans', cursive;
            font-size: 18pt;
            @else
            font-family: 'DejaVu Sans', sans-serif;
            font-style: italic;
            font-size: 14pt;
            @endif
            color: #0f766e;
            font-weight: 400;
        }
        .footer {
            margin-top: 32px;
            padding: 16px 0 0 0;
            border-top: 1px solid #e2e8f0;
            font-size: 7pt;
            color: #94a3b8;
            text-align: center;
        }
        .empty-state {
            text-align: center;
            padding: 32px 24px;
            margin: 16px 0;
            color: #94a3b8;
            font-style: italic;
            font-size: 9pt;
        }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>{{ $outlet_name }}</h1>
        <p class="subtitle">Laporan Rekapan Keuangan</p>
    </div>

    <div class="meta">
        <div class="meta-row">
            <span class="meta-label">Periode</span>
            <span class="meta-value">{{ \Carbon\Carbon::parse($from)->locale('id_ID')->translatedFormat('d F Y') }} - {{ \Carbon\Carbon::parse($to)->locale('id_ID')->translatedFormat('d F Y') }}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Jenis Laporan</span>
            <span class="meta-value">
                @if($type === 'both') Transaksi & Pengeluaran
                @elseif($type === 'transactions') Transaksi
                @else Pengeluaran
                @endif
            </span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Dibuat pada</span>
            <span class="meta-value">{{ $generated_at }}</span>
        </div>
    </div>

    <div class="summary-cards">
        @if(in_array($type, ['transactions', 'both']))
        <div class="summary-card">
            <div class="label">Total Transaksi</div>
            <div class="value">{{ $orders_count }}</div>
        </div>
        <div class="summary-card">
            <div class="label">Pendapatan (kas masuk)</div>
            <div class="value">Rp {{ number_format($income, 0, ',', '.') }}</div>
            @if(isset($income_accrual) && (float) $income_accrual > 0 && abs((float) $income_accrual - (float) $income) > 0.01)
            <div style="font-size: 6pt; color: #64748b; margin-top: 4px; line-height: 1.2;">Omzet akrual: Rp {{ number_format($income_accrual, 0, ',', '.') }}</div>
            @endif
        </div>
        @endif
        @if(in_array($type, ['expenses', 'both']))
        <div class="summary-card expense">
            <div class="label">Total Pengeluaran</div>
            <div class="value">Rp {{ number_format($total_expenses, 0, ',', '.') }}</div>
        </div>
        @endif
        @if($type === 'both')
        <div class="summary-card profit">
            <div class="label">Laba (kas)</div>
            <div class="value">Rp {{ number_format($profit, 0, ',', '.') }}</div>
            @if(isset($profit_accrual) && abs((float) $profit_accrual - (float) $profit) > 0.01)
            <div style="font-size: 6pt; color: #64748b; margin-top: 4px; line-height: 1.2;">Akrual: Rp {{ number_format($profit_accrual, 0, ',', '.') }}</div>
            @endif
        </div>
        @endif
    </div>

    @if(in_array($type, ['transactions', 'both']) && $orders->count() > 0)
    <div class="section-title">Detail Transaksi</div>
    <div class="table-wrap">
    <table>
        <colgroup>
            <col style="width: 18%">
            <col style="width: 18%">
            <col style="width: 28%">
            <col style="width: 18%">
            <col style="width: 18%">
        </colgroup>
        <thead>
            <tr>
                <th>No. Order</th>
                <th>Tanggal</th>
                <th>Pelanggan</th>
                <th>Status</th>
                <th class="amount">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($orders as $order)
            <tr>
                <td>{{ $order->order_number }}</td>
                <td>{{ $order->created_at?->locale('id_ID')->translatedFormat('d M Y, H.i') ?? '-' }}</td>
                <td>{{ $order->customer?->name ?? '-' }}</td>
                <td>{{ $order->status?->name ?? '-' }}</td>
                <td class="amount">Rp {{ number_format((float)$order->total, 0, ',', '.') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    </div>
    @elseif(in_array($type, ['transactions', 'both']))
    <div class="section-title">Detail Transaksi</div>
    <div class="empty-state">Tidak ada transaksi pada periode ini.</div>
    @endif

    @if(in_array($type, ['expenses', 'both']) && $expenses->count() > 0)
    <div class="section-title">Detail Pengeluaran</div>
    <div class="table-wrap">
    <table>
        <colgroup>
            <col style="width: 6%">
            <col style="width: 14%">
            <col style="width: 18%">
            <col style="width: 14%">
            <col style="width: 32%">
            <col style="width: 16%">
        </colgroup>
        <thead>
            <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th class="amount">Nominal</th>
                <th>Detail pencatatan</th>
                <th>Jenis pembayaran</th>
            </tr>
        </thead>
        <tbody>
            @foreach($expenses as $exp)
            <tr>
                <td>{{ $loop->iteration }}</td>
                <td>{{ $exp->expense_date?->locale('id_ID')->translatedFormat('d M Y') ?? '-' }}</td>
                <td>{{ $exp->expenseCategory?->name ?? '-' }}</td>
                <td class="amount">Rp {{ number_format((float)$exp->amount, 0, ',', '.') }}</td>
                <td>{{ $exp->description ?? '-' }}</td>
                <td>{{ $exp->payment_method ?? '-' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    </div>
    @elseif(in_array($type, ['expenses', 'both']))
    <div class="section-title">Detail Pengeluaran</div>
    <div class="empty-state">Tidak ada pengeluaran pada periode ini.</div>
    @endif

    <div class="signature-block">
        <div class="signature-label">Mengetahui,</div>
        <div class="signature-name">{{ $signature }}</div>
    </div>

    <div class="footer">
        Dokumen ini dibuat secara otomatis oleh {{ $outlet_name }}. {{ $generated_at }}
    </div>
</div>
</body>
</html>
