<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use Illuminate\Http\Request;

class ExpenseCategoryController extends Controller
{
    public function index()
    {
        return ExpenseCategory::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $valid = $request->validate(['name' => 'required|string|max:255']);

        return ExpenseCategory::create($valid);
    }

    public function show(ExpenseCategory $expenseCategory)
    {
        return $expenseCategory;
    }

    public function update(Request $request, ExpenseCategory $expenseCategory)
    {
        $expenseCategory->update($request->validate(['name' => 'required|string|max:255']));

        return $expenseCategory;
    }

    public function destroy(ExpenseCategory $expenseCategory)
    {
        $expenseCategory->delete();

        return response()->json(null, 204);
    }
}
