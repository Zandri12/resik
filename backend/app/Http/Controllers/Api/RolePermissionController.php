<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolePermission;
use Illuminate\Http\Request;

class RolePermissionController extends Controller
{
    public function index()
    {
        return response()->json([
            'permissions' => RolePermission::getAllGroupedByRole(),
            'groups' => RolePermission::FEATURE_GROUPS,
            'labels' => RolePermission::FEATURES,
        ]);
    }

    public function update(Request $request)
    {
        $request->validate([
            'role' => 'required|string|in:owner,admin,karyawan',
            'permissions' => 'required|array',
            'permissions.*' => 'boolean',
        ]);

        $role = $request->role;
        $permissions = $request->permissions;

        RolePermission::updateForRole($role, $permissions);

        return response()->json(RolePermission::getForRole($role));
    }
}
