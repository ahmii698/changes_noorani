<?php
// app/Models/EmployeeLeave.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeLeave extends Model
{
    use HasFactory;

    protected $table = 'employee_leaves';

    protected $fillable = [
        'user_id',
        'leave_date',
        'month',
        'year',
        'reason',
        'status',
    ];

    protected $casts = [
        'leave_date' => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}