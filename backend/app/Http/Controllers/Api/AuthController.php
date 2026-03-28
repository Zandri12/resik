<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (! Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['Email atau kata sandi salah.'],
            ]);
        }

        $user = Auth::user();
        $user->tokens()->delete();

        $permissions = [];
        foreach (array_keys(\App\Models\RolePermission::FEATURES) as $f) {
            $permissions[$f] = $user->hasPermission($f);
        }
        $userData = array_merge($user->only(['id', 'name', 'email', 'role']), [
            'permissions' => $permissions,
            'avatar_url' => $user->avatar_url,
        ]);

        return response()->json([
            'user' => $userData,
            'token' => $user->createToken('api')->plainTextToken,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }
}
