<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Support\PaymentMethodNormalizer;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $query = Expense::with(['expenseCategory', 'createdBy']);

        if ($request->filled('expense_category_id')) {
            $query->where('expense_category_id', $request->expense_category_id);
        }
        if ($request->filled('from')) {
            $query->where('expense_date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('expense_date', '<=', $request->to);
        }

        $perPage = min(500, max(10, (int) $request->input('per_page', 100)));

        return $query->orderByDesc('expense_date')->paginate($perPage);
    }

    public function store(Request $request)
    {
        if (! $request->user()?->hasPermission('expenses.create')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $valid = $request->validate([
            'expense_category_id' => 'required|exists:expense_categories,id',
            'amount' => 'required|numeric|min:0',
            'expense_date' => 'required|date',
            'description' => 'nullable|string|max:2000',
            'payment_method' => 'nullable|string|max:32',
        ]);

        $valid['created_by'] = $request->user()->id;
        $valid['payment_method'] = PaymentMethodNormalizer::normalize($valid['payment_method'] ?? null);

        return Expense::create($valid);
    }

    public function show(Expense $expense)
    {
        return $expense->load(['expenseCategory', 'createdBy']);
    }

    public function update(Request $request, Expense $expense)
    {
        $valid = $request->validate([
            'expense_category_id' => 'sometimes|exists:expense_categories,id',
            'amount' => 'sometimes|numeric|min:0',
            'expense_date' => 'sometimes|date',
            'description' => 'nullable|string|max:2000',
            'payment_method' => 'nullable|string|max:32',
        ]);

        if (array_key_exists('payment_method', $valid)) {
            $valid['payment_method'] = PaymentMethodNormalizer::normalize($valid['payment_method']);
        }

        $expense->update($valid);

        return $expense;
    }

    public function destroy(Request $request, Expense $expense)
    {
        if (! $request->user()?->hasPermission('expenses.delete')) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }
        $expense->delete();

        return response()->json(null, 204);
    }
}
