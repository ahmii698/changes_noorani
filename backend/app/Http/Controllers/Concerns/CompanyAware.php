<?php

namespace App\Http\Controllers\Concerns;

trait CompanyAware
{
    /**
     * Login user ki company_id. Company na ho to request wahin band.
     * Isko try{} se PEHLE call karna.
     */
    protected function cid(): int
    {
        $id = auth()->user()?->company_id;

        if (!$id) {
            abort(response()->json([
                'success' => false,
                'message' => 'No company assigned to this account',
            ], 403));
        }

        return (int) $id;
    }
}