<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return $this->userPayload($request->user());
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $valid = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => 'required_with:password',
            'password' => 'nullable|string|min:8|confirmed',
        ]);

        if (! empty($valid['password'])) {
            if (! Hash::check($request->current_password, $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['Kata sandi saat ini tidak cocok.'],
                ]);
            }
            $user->password = $valid['password'];
        }

        if (isset($valid['name'])) {
            $user->name = $valid['name'];
        }
        if (isset($valid['email'])) {
            $user->email = $valid['email'];
        }

        $user->save();

        return $this->userPayload($user->fresh());
    }

    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'avatar' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $path = $request->file('avatar')->store('avatars', 'public');
        $user->avatar_path = $path;
        $user->save();

        return response()->json($this->userPayload($user->fresh()));
    }

    public function deleteAvatar(Request $request)
    {
        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->avatar_path = null;
            $user->save();
        }

        return response()->json($this->userPayload($user->fresh()));
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(\App\Models\User $user): array
    {
        $permissions = [];
        foreach (array_keys(\App\Models\RolePermission::FEATURES) as $f) {
            $permissions[$f] = $user->hasPermission($f);
        }

        return array_merge(
            $user->only(['id', 'name', 'email', 'role']),
            [
                'permissions' => $permissions,
                'avatar_url' => $user->avatar_url,
            ]
        );
    }
}
