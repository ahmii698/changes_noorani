<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class GymCompany extends Model
{
    protected $table = 'gym_companies';

    protected $fillable = [
        'name',
        'phone',
        'email',
        'plan',
        'monthly_fee',
        'is_blocked',
        'blocked_at',
    ];

    protected $casts = [
        'monthly_fee' => 'float',
        'is_blocked'  => 'boolean',
        'blocked_at'  => 'datetime',
    ];

    public function subscriptions()
    {
        return $this->hasMany(GymSubscription::class, 'company_id');
    }

    /**
     * Current billing cycle. Agar cycle khatam ho chuki ho to agli
     * cycle apne aap ban jati hai (company ki monthly fee ke saath).
     */
    public function currentSubscription(): GymSubscription
    {
        $today = Carbon::today();

        $sub = GymSubscription::where('company_id', $this->id)
            ->orderByDesc('period_end')
            ->orderByDesc('id')
            ->first();

        if (!$sub) {
            return $this->makeCycle($today);
        }

        $guard = 0;
        while ($sub->period_end->lte($today) && $guard < 36) {
            $sub = $this->makeCycle($sub->period_end->copy());
            $guard++;
        }

        return $sub;
    }

    private function makeCycle(Carbon $start): GymSubscription
    {
        return GymSubscription::create([
            'company_id'   => $this->id,
            'period_start' => $start->toDateString(),
            'period_end'   => $start->copy()->addMonthNoOverflow()->toDateString(),
            'total_amount' => $this->monthly_fee,
            'paid_amount'  => 0,
        ]);
    }
}