<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServicePackage;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServicePackageController extends Controller
{
    /** Satuan non-kg yang didukung untuk tipe kiloan tetap kg. */
    private const SATUAN_UNITS = ['pcs', 'lembar', 'pasang', 'buah'];

    public function index(Request $request)
    {
        $query = ServicePackage::query();
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return $query->orderBy('sort_order')
            ->orderBy('category')
            ->orderBy('group_slug')
            ->orderBy('variant_label')
            ->orderBy('name')
            ->withCount('orderItems')
            ->get()
            ->map(function (ServicePackage $p) {
                $data = $p->toArray();
                $data['deletable'] = ($p->order_items_count ?? 0) === 0;
                unset($data['order_items_count']);

                return $data;
            });
    }

    public function store(Request $request)
    {
        if (! $request->user()?->hasPermission('layanan.create')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $valid = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:120',
            'sort_order' => 'nullable|integer|min:0',
            'group_slug' => 'nullable|string|max:120',
            'group_title' => 'nullable|string|max:255',
            'variant_label' => 'nullable|string|max:120',
            'speed' => ['nullable', 'string', Rule::in(['reguler', 'express'])],
            'type' => 'required|in:kiloan,satuan',
            'price_per_unit' => 'required|numeric|min:0',
            'unit' => ['nullable', 'string', 'max:20', Rule::in(array_merge(['kg'], self::SATUAN_UNITS))],
            'estimate_minutes' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        $valid['unit'] = $this->resolveUnit($valid['type'], $valid['unit'] ?? null, null);
        $valid['estimate_minutes'] = $valid['estimate_minutes'] ?? 0;
        $valid['sort_order'] = $valid['sort_order'] ?? 0;

        return ServicePackage::create($valid);
    }

    public function show(ServicePackage $servicePackage)
    {
        return $servicePackage;
    }

    public function update(Request $request, ServicePackage $servicePackage)
    {
        if (! $request->user()?->hasPermission('layanan.edit')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $valid = $request->validate([
            'name' => 'sometimes|string|max:255',
            'category' => 'nullable|string|max:120',
            'sort_order' => 'nullable|integer|min:0',
            'group_slug' => 'nullable|string|max:120',
            'group_title' => 'nullable|string|max:255',
            'variant_label' => 'nullable|string|max:120',
            'speed' => ['nullable', 'string', Rule::in(['reguler', 'express'])],
            'type' => 'sometimes|in:kiloan,satuan',
            'price_per_unit' => 'sometimes|numeric|min:0',
            'unit' => ['nullable', 'string', 'max:20', Rule::in(array_merge(['kg'], self::SATUAN_UNITS))],
            'estimate_minutes' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        $typeAfter = $valid['type'] ?? $servicePackage->type;
        if (array_key_exists('unit', $valid) || array_key_exists('type', $valid)) {
            $valid['unit'] = $this->resolveUnit(
                $typeAfter,
                $valid['unit'] ?? null,
                $servicePackage
            );
        }
        if (array_key_exists('estimate_minutes', $valid)) {
            $valid['estimate_minutes'] = $valid['estimate_minutes'] ?? 0;
        }

        $servicePackage->update($valid);

        return $servicePackage;
    }

    public function destroy(Request $request, ServicePackage $servicePackage)
    {
        if (! $request->user()?->hasPermission('layanan.delete')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        if ($servicePackage->orderItems()->exists()) {
            return response()->json([
                'message' => 'Layanan yang sudah pernah dipakai di order tidak dapat dihapus. Nonaktifkan layanan jika tidak ingin ditampilkan.',
            ], 422);
        }

        $servicePackage->delete();

        return response()->json(null, 204);
    }

    private function resolveUnit(string $type, ?string $unit, ?ServicePackage $existing): string
    {
        if ($type === 'kiloan') {
            return 'kg';
        }

        $raw = strtolower(trim((string) ($unit ?? $existing?->unit ?? 'pcs')));

        return in_array($raw, self::SATUAN_UNITS, true) ? $raw : 'pcs';
    }
}
