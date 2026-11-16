<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EnsureCompanyNotBlocked
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && !empty($user->company_id)) {
            $blocked = DB::table('gym_companies')
                ->where('id', $user->company_id)
                ->value('is_blocked');

            if ($blocked) {
                $token = $user->currentAccessToken();
                if ($token && method_exists($token, 'delete')) {
                    $token->delete();
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Your company account is blocked. Please contact support.',
                ], 401);
            }
        }

        return $next($request);
    }
}