<?php
// app/Models/EmployeeLoanTransaction.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeLoanTransaction extends Model
{
    protected $table = 'employee_loan_transactions';

    protected $fillable = [
        'employee_id',
        'type',              // 'loan' ya 'repayment'
        'amount',
        'transaction_date',
        'note',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'float',
    ];
}