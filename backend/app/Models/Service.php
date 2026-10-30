<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    protected $table = 'services';

    // updated_at column table mein nahi hai, sirf created_at use hoga
    const UPDATED_AT = null;

    protected $fillable = [
        'name',
        'price',
        'category',
        'icon',
    ];

    protected $casts = [
        'price' => 'float',
    ];
}