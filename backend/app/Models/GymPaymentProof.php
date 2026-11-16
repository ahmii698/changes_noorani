<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GymPaymentProof extends Model
{
    protected $table = 'gym_payment_proofs';

    protected $fillable = [
        'subscription_id',
        'company_id',
        'amount',
        'image_path',
        'status',
        'uploaded_by',
        'reviewed_at',
    ];

    protected $casts = [
        'amount'      => 'float',
        'reviewed_at' => 'datetime',
    ];

    public function subscription()
    {
        return $this->belongsTo(GymSubscription::class, 'subscription_id');
    }

    public function company()
    {
        return $this->belongsTo(GymCompany::class, 'company_id');
    }
}