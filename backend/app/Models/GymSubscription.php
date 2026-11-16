<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GymSubscription extends Model
{
    protected $table = 'gym_subscriptions';

    protected $fillable = [
        'company_id',
        'period_start',
        'period_end',
        'total_amount',
        'paid_amount',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end'   => 'date',
        'total_amount' => 'float',
        'paid_amount'  => 'float',
    ];

    public function company()
    {
        return $this->belongsTo(GymCompany::class, 'company_id');
    }

    public function proofs()
    {
        return $this->hasMany(GymPaymentProof::class, 'subscription_id')->orderByDesc('id');
    }
}