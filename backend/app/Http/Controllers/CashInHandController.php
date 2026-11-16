<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\CompanyAware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashInHandController extends Controller
{
    use CompanyAware;

    private const TABLE = 'cash_in_hand_entries';

    private function currentBalance(int $cid): float
    {
        return (float) DB::table(self::TABLE)
            ->where('company_id', $cid)
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'add' THEN amount ELSE -amount END), 0) as bal")
            ->value('bal');
    }

    // GET /api/cash-in-hand  -> balance + poori history (newest first)
    public function index()
    {
        $cid = $this->cid();

        $entries = DB::table(self::TABLE)
            ->where('company_id', $cid)
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'success' => true,
            'balance' => $this->currentBalance($cid),
            'data'    => $entries,
        ]);
    }

    // POST /api/cash-in-hand  { type: add|withdraw, amount, note }
    public function store(Request $request)
    {
        $cid  = $this->cid();
        $user = $request->user();

        if (!$user || $user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Only admin can update cash in hand'], 403);
        }

        $data = $request->validate([
            'type'   => 'required|in:add,withdraw',
            'amount' => 'required|numeric|gt:0',
            'note'   => 'nullable|string|max:255',
        ]);

        return DB::transaction(function () use ($data, $user, $cid) {
            // lock taake do requests ek saath aayen to balance galat na ho
            DB::table(self::TABLE)->where('company_id', $cid)->lockForUpdate()->count();

            $before = $this->currentBalance($cid);
            $amount = (float) $data['amount'];
            $after  = $data['type'] === 'add' ? $before + $amount : $before - $amount;

            if ($after < 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Withdraw amount cash in hand se zyada hai',
                ], 422);
            }

            $id = DB::table(self::TABLE)->insertGetId([
                'company_id'     => $cid,
                'type'           => $data['type'],
                'amount'         => $amount,
                'balance_before' => $before,
                'balance_after'  => $after,
                'note'           => $data['note'] ?? null,
                'user_name'      => $user->name ?? 'Admin',
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cash in hand updated',
                'balance' => $after,
                'data'    => DB::table(self::TABLE)->find($id),
            ], 201);
        });
    }

    // DELETE /api/cash-in-hand/{id}  -> abhi allowed nahi (history audit ke liye rehti hai)
    public function destroy($id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Cash in hand entries cannot be deleted',
        ], 405);
    }
}