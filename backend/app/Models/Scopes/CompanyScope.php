<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class CompanyScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        // artisan / scheduler / queue mein koi login user nahi hota, wahan filter nahi
        if (app()->runningInConsole()) {
            return;
        }

        $companyId = self::currentCompanyId();

        if ($companyId) {
            $builder->where($model->getTable() . '.company_id', $companyId);
        } else {
            // login nahi ya company nahi: kuch bhi nahi dikhana
            $builder->whereRaw('1 = 0');
        }
    }

    public static function currentCompanyId()
    {
        $user = auth()->user();

        return $user ? ($user->company_id ?? null) : null;
    }
}