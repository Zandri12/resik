<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderStatus;

class OrderStatusController extends Controller
{
    public function index()
    {
        return OrderStatus::orderBy('sort_order')->get();
    }
}
