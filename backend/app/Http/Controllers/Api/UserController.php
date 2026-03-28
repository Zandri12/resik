<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query();

        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($qry) use ($q) {
                $qry->whereLike('name', $q)->orWhereLike('email', $q);
            });
        }

        if ($request->filled('role') && $request->role !== 'all') {
            $query->where('role', $request->role);
        }

        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $allowedSort = ['name', 'email', 'role', 'created_at'];
        if (! in_array($sortBy, $allowedSort)) {
            $sortBy = 'name';
        }
        if (! in_array($sortOrder, ['asc', 'desc'])) {
            $sortOrder = 'asc';
        }
        $query->orderBy($sortBy, $sortOrder);

        $perPage = min((int) $request->get('per_page', 15), 50);
        $paginated = $query->paginate($perPage, ['id', 'name', 'email', 'role', 'created_at']);

        $countsQuery = User::query();
        if ($request->filled('search')) {
            $q = $request->search;
            $countsQuery->where(function ($qry) use ($q) {
                $qry->whereLike('name', $q)->orWhereLike('email', $q);
            });
        }
        if ($request->filled('role') && $request->role !== 'all') {
            $countsQuery->where('role', $request->role);
        }
        $counts = $countsQuery->selectRaw('role, count(*) as cnt')->groupBy('role')->pluck('cnt', 'role')->toArray();

        return response()->json([
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'counts' => [
                    'owner' => (int) ($counts['owner'] ?? 0),
                    'admin' => (int) ($counts['admin'] ?? 0),
                    'karyawan' => (int) ($counts['karyawan'] ?? 0),
                ],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $valid = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => ['required', Rule::in(['admin', 'karyawan'])],
        ]);

        $valid['password'] = Hash::make($valid['password']);
        $user = User::create($valid);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'created_at']), 201);
    }

    public function show(User $user)
    {
        return $user->only(['id', 'name', 'email', 'role', 'created_at']);
    }

    public function update(Request $request, User $user)
    {
        $valid = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'role' => ['sometimes', Rule::in(['owner', 'admin', 'karyawan'])],
        ]);

        if (isset($valid['role']) && $valid['role'] === 'owner' && ! $request->user()->isOwner()) {
            return response()->json(['message' => 'Hanya owner yang dapat menetapkan role owner'], 403);
        }

        if (isset($valid['password']) && $valid['password']) {
            $valid['password'] = Hash::make($valid['password']);
        } else {
            unset($valid['password']);
        }

        $user->update($valid);

        return $user->only(['id', 'name', 'email', 'role', 'created_at']);
    }

    public function resetPassword(Request $request, User $user)
    {
        if ($user->role === 'owner' && ! $request->user()->isOwner()) {
            return response()->json(['message' => 'Hanya owner yang dapat reset password owner'], 403);
        }

        $newPassword = \Illuminate\Support\Str::random(12);
        $user->update(['password' => Hash::make($newPassword)]);

        return response()->json([
            'message' => 'Password berhasil direset',
            'temporary_password' => $newPassword,
        ]);
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Tidak dapat menghapus akun sendiri'], 400);
        }
        if ($user->role === 'owner') {
            return response()->json(['message' => 'Tidak dapat menghapus owner'], 400);
        }

        $user->delete();

        return response()->json(null, 204);
    }
}
