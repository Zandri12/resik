<?php

use Illuminate\Support\Facades\Route;

Route::post('/login', [App\Http\Controllers\Api\AuthController::class, 'login']);
Route::post('/logout', [App\Http\Controllers\Api\AuthController::class, 'logout'])->middleware('auth:sanctum');

// Public: QR cek status order (no auth)
Route::get('orders/{order}/status', [App\Http\Controllers\Api\OrderController::class, 'publicStatus']);

// Public: promo & konten landing (no auth)
Route::get('public/landing-contents', [App\Http\Controllers\Api\LandingContentController::class, 'publicIndex']);
Route::get('public/landing-contents/{slug}', [App\Http\Controllers\Api\LandingContentController::class, 'publicShow'])
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*');
Route::get('public/outlet-profile', [App\Http\Controllers\Api\OutletSettingController::class, 'publicProfile']);

// Midtrans webhook (no auth - called by Midtrans server)
Route::post('midtrans/webhook', [App\Http\Controllers\Api\MidtransController::class, 'webhook']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [App\Http\Controllers\Api\ProfileController::class, 'show']);
    Route::patch('/user', [App\Http\Controllers\Api\ProfileController::class, 'update']);
    Route::post('/user/avatar', [App\Http\Controllers\Api\ProfileController::class, 'uploadAvatar']);
    Route::delete('/user/avatar', [App\Http\Controllers\Api\ProfileController::class, 'deleteAvatar']);

    Route::get('/notifications', [App\Http\Controllers\Api\NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [App\Http\Controllers\Api\NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read-all', [App\Http\Controllers\Api\NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [App\Http\Controllers\Api\NotificationController::class, 'markRead']);

    Route::middleware('role:dashboard')->group(function () {
        Route::get('dashboard', [App\Http\Controllers\Api\DashboardController::class, 'index']);
        Route::get('dashboard/weekly-trend', [App\Http\Controllers\Api\DashboardController::class, 'weeklyTrend']);
        Route::get('dashboard/monthly-trend', [App\Http\Controllers\Api\DashboardController::class, 'monthlyTrend']);
    });

    Route::middleware('role:orders')->group(function () {
        Route::apiResource('orders', App\Http\Controllers\Api\OrderController::class);
        Route::post('orders/{order}/send-telegram', [App\Http\Controllers\Api\OrderController::class, 'sendToTelegram']);
        Route::post('orders/{order}/send-whatsapp', [App\Http\Controllers\Api\OrderController::class, 'sendToWhatsApp']);
        Route::get('midtrans/config', [App\Http\Controllers\Api\MidtransController::class, 'config']);
        Route::post('orders/{order}/midtrans/snap-token', [App\Http\Controllers\Api\MidtransController::class, 'createSnapToken']);
        Route::post('orders/{order}/images', [App\Http\Controllers\Api\OrderController::class, 'uploadImage']);
        Route::delete('orders/{order}/images/{image}', [App\Http\Controllers\Api\OrderController::class, 'deleteImage']);
        Route::get('order-statuses', [App\Http\Controllers\Api\OrderStatusController::class, 'index']);
    });

    Route::middleware('role:customers')->group(function () {
        Route::apiResource('customers', App\Http\Controllers\Api\CustomerController::class);
    });

    Route::middleware('role:expenses')->group(function () {
        Route::apiResource('expense-categories', App\Http\Controllers\Api\ExpenseCategoryController::class);
        Route::apiResource('expenses', App\Http\Controllers\Api\ExpenseController::class);
    });

    Route::middleware('role:layanan')->group(function () {
        Route::apiResource('service-packages', App\Http\Controllers\Api\ServicePackageController::class);
    });

    Route::middleware('role:reports')->group(function () {
        Route::get('reports', [App\Http\Controllers\Api\ReportController::class, 'index']);
        Route::get('reports/download', [App\Http\Controllers\Api\ReportController::class, 'download']);
        Route::post('reports/send-telegram', [App\Http\Controllers\Api\ReportController::class, 'sendToTelegram']);
    });

    Route::middleware('role:employee_performance')->group(function () {
        Route::get('employee-performance', [App\Http\Controllers\Api\EmployeePerformanceController::class, 'index']);
    });

    Route::middleware('role:settings')->group(function () {
        Route::get('outlet-settings', [App\Http\Controllers\Api\OutletSettingController::class, 'index']);
        Route::post('outlet-settings', [App\Http\Controllers\Api\OutletSettingController::class, 'update']);
        Route::post('outlet-settings/test-telegram', [App\Http\Controllers\Api\OutletSettingController::class, 'testTelegram']);
        Route::post('outlet-settings/test-whatsapp', [App\Http\Controllers\Api\OutletSettingController::class, 'testWhatsApp']);
    });

    Route::middleware('role:landing_content')->group(function () {
        Route::post('landing-contents/upload-image', [App\Http\Controllers\Api\LandingContentController::class, 'uploadImage']);
        Route::get('landing-contents', [App\Http\Controllers\Api\LandingContentController::class, 'index']);
        Route::post('landing-contents', [App\Http\Controllers\Api\LandingContentController::class, 'store']);
        Route::get('landing-contents/{landingContent}', [App\Http\Controllers\Api\LandingContentController::class, 'show']);
        Route::put('landing-contents/{landingContent}', [App\Http\Controllers\Api\LandingContentController::class, 'update']);
        Route::delete('landing-contents/{landingContent}', [App\Http\Controllers\Api\LandingContentController::class, 'destroy']);
    });

    Route::middleware('can.manage.users')->group(function () {
        Route::post('users/{user}/reset-password', [App\Http\Controllers\Api\UserController::class, 'resetPassword']);
        Route::apiResource('users', App\Http\Controllers\Api\UserController::class);
    });

    Route::middleware('can.manage.role.permissions')->group(function () {
        Route::get('role-permissions', [App\Http\Controllers\Api\RolePermissionController::class, 'index']);
        Route::put('role-permissions', [App\Http\Controllers\Api\RolePermissionController::class, 'update']);
    });
});
