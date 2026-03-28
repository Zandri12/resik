<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $query = Customer::query();

        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($qry) use ($q) {
                $qry->where('name', 'ilike', "%{$q}%")
                    ->orWhere('phone', 'ilike', "%{$q}%")
                    ->orWhere('email', 'ilike', "%{$q}%");
            });
        }

        if ($request->filled('is_member')) {
            $query->where('is_member', filter_var($request->is_member, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('blacklisted')) {
            $query->where('is_blacklisted', filter_var($request->blacklisted, FILTER_VALIDATE_BOOLEAN));
        } elseif (filter_var($request->query('exclude_blacklisted', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->where('is_blacklisted', false);
        }

        $perPage = min(500, max(1, (int) $request->get('per_page', 15)));

        return $query->orderBy('name')->paginate($perPage);
    }

    public function store(Request $request)
    {
        if (! $request->user()?->hasPermission('customers.create')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $valid = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:50',
            'email' => 'nullable|email',
            'address' => 'nullable|string',
            'note' => 'nullable|string',
            'is_blacklisted' => 'nullable|boolean',
            'is_member' => 'nullable|boolean',
            'member_discount' => 'nullable|numeric|min:0|max:100',
            'member_valid_from' => 'nullable|date',
            'member_valid_until' => 'nullable|date',
            'points' => 'nullable|integer|min:0',
            'birthday' => 'nullable|date',
            'referral_code' => 'nullable|string|unique:customers,referral_code',
            'tags' => 'nullable|array',
        ]);

        if (! ($valid['is_member'] ?? false)) {
            $valid['member_valid_from'] = null;
            $valid['member_valid_until'] = null;
        }
        $this->assertMemberValidityRange(
            $valid['member_valid_from'] ?? null,
            $valid['member_valid_until'] ?? null
        );

        return Customer::create($valid);
    }

    public function show(Customer $customer)
    {
        return $customer->load('orders');
    }

    public function update(Request $request, Customer $customer)
    {
        $valid = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:50',
            'email' => 'nullable|email',
            'address' => 'nullable|string',
            'note' => 'nullable|string',
            'is_blacklisted' => 'nullable|boolean',
            'is_member' => 'nullable|boolean',
            'member_discount' => 'nullable|numeric|min:0|max:100',
            'member_valid_from' => 'nullable|date',
            'member_valid_until' => 'nullable|date',
            'points' => 'nullable|integer|min:0',
            'birthday' => 'nullable|date',
            'referral_code' => 'nullable|string|unique:customers,referral_code,' . $customer->id,
            'tags' => 'nullable|array',
        ]);

        if (array_key_exists('is_member', $valid) && ! $valid['is_member']) {
            $valid['member_valid_from'] = null;
            $valid['member_valid_until'] = null;
        }

        $from = array_key_exists('member_valid_from', $valid) ? $valid['member_valid_from'] : $customer->member_valid_from;
        $until = array_key_exists('member_valid_until', $valid) ? $valid['member_valid_until'] : $customer->member_valid_until;
        $this->assertMemberValidityRange($from, $until);

        $customer->update($valid);

        return $customer;
    }

    public function destroy(Request $request, Customer $customer)
    {
        if (! $request->user()?->hasPermission('customers.delete')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $customer->delete();

        return response()->json(null, 204);
    }

    private function assertMemberValidityRange(mixed $from, mixed $until): void
    {
        $fromStr = $this->normalizeDateInput($from);
        $untilStr = $this->normalizeDateInput($until);
        if ($fromStr && $untilStr && $untilStr < $fromStr) {
            throw ValidationException::withMessages([
                'member_valid_until' => 'Tanggal berakhir harus sama atau setelah tanggal mulai.',
            ]);
        }
    }

    private function normalizeDateInput(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof CarbonInterface) {
            return $value->format('Y-m-d');
        }

        return (string) $value;
    }
}
