<?php

namespace App\Http\Controllers;

use App\Models\PaymentChannel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PaymentChannelController extends Controller
{
    /**
     * SUPER ADMIN: GET /api/super-admin/payment-channels
     * Teeno channels (hidden wale bhi) return karta hai.
     */
    public function index()
    {
        $rows = PaymentChannel::all()->keyBy('type');

        $data = collect(PaymentChannel::TYPES)->map(function ($type) use ($rows) {
            return $rows->has($type)
                ? $rows[$type]->toApi()
                : [
                    'type' => $type, 'account_title' => '', 'account_number' => '',
                    'bank_name' => '', 'iban' => '', 'qr_url' => null, 'is_active' => true,
                ];
        })->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * SUPER ADMIN: POST /api/super-admin/payment-channels/{type}  (multipart)
     */
    public function save(Request $request, string $type)
    {
        if (!in_array($type, PaymentChannel::TYPES, true)) {
            return response()->json(['success' => false, 'message' => 'Invalid channel type'], 404);
        }

        $rules = [
            'account_title'  => 'nullable|string|max:120',
            'account_number' => 'nullable|string|max:50',
            'is_active'      => 'nullable|boolean',
            'qr'             => 'nullable|file|mimes:jpg,jpeg,png|max:3072', // 3MB
            'remove_qr'      => 'nullable|boolean',
        ];
        if ($type === 'bank') {
            $rules['bank_name'] = 'nullable|string|max:120';
            $rules['iban']      = 'nullable|string|max:40';
        }
        $v = $request->validate($rules);

        $channel = PaymentChannel::firstOrNew(['type' => $type]);

        $channel->account_title  = $v['account_title'] ?? null;
        $channel->account_number = $v['account_number'] ?? null;
        $channel->is_active      = $request->boolean('is_active', true);

        if ($type === 'bank') {
            $channel->bank_name = $v['bank_name'] ?? null;
            $channel->iban      = $v['iban'] ?? null;
        }

        // Nayi QR upload -> purani delete
        if ($request->hasFile('qr')) {
            if ($channel->qr_path) {
                Storage::disk('public')->delete($channel->qr_path);
            }
            $channel->qr_path = $request->file('qr')->store('payment-channels', 'public');
        } elseif ($request->boolean('remove_qr') && $channel->qr_path) {
            Storage::disk('public')->delete($channel->qr_path);
            $channel->qr_path = null;
        }

        $channel->save();

        return response()->json(['success' => true, 'data' => $channel->toApi()]);
    }

    /**
     * GYM ADMIN (company side): GET /api/payment-channels
     * Sirf "Visible" channels — Amounts page ke liye.
     */
    public function visible()
    {
        $data = PaymentChannel::where('is_active', true)
            ->get()
            ->sortBy(fn ($c) => array_search($c->type, PaymentChannel::TYPES))
            ->map->toApi()
            ->values();

        return response()->json(['success' => true, 'data' => $data]);
    }
}