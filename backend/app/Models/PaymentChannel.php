<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class PaymentChannel extends Model
{
    public const TYPES = ['jazzcash', 'easypaisa', 'bank'];

    protected $fillable = [
        'type',
        'account_title',
        'account_number',
        'bank_name',
        'iban',
        'qr_path',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function getQrUrlAttribute(): ?string
    {
        return $this->qr_path ? Storage::disk('public')->url($this->qr_path) : null;
    }

    // React ko jo shape chahiye wahi return karta hai
    public function toApi(): array
    {
        return [
            'type'           => $this->type,
            'account_title'  => $this->account_title,
            'account_number' => $this->account_number,
            'bank_name'      => $this->bank_name,
            'iban'           => $this->iban,
            'qr_url'         => $this->qr_url,
            'is_active'      => $this->is_active,
        ];
    }
}