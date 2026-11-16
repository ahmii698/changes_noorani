<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Trial extends Model
{
    protected $table = 'trials';

    protected $fillable = [
        'company_id',
        'name',
        'phone',
        'start_date',
        'days',
        'status',
    ];

    protected $casts = [
        'days' => 'integer',
    ];

    // React ko jo shape chahiye wahi return karta hai
    public function toApi(): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'phone'      => $this->phone,
            'start_date' => substr((string) $this->start_date, 0, 10),
            'days'       => (int) $this->days,
        ];
    }
}