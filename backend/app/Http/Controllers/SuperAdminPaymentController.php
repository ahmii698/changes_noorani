<?php

namespace App\Http\Controllers;

use App\Models\GymCompany;
use App\Models\GymPaymentProof;
use App\Models\GymSubscription;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class SuperAdminPaymentController extends Controller
{
    /* ---------------- helpers ---------------- */

    private function proofUrl(?string $path): string
    {
        return $path ? Storage::disk('public')->url($path) : '';
    }

    private function mapProof(GymPaymentProof $p): array
    {
        return [
            'id'         => $p->id,
            'amount'     => (float) $p->amount,
            'status'     => $p->status,
            'url'        => $this->proofUrl($p->image_path),
            'created_at' => optional($p->created_at)->toIso8601String(),
        ];
    }

    // Frontend sirf paid / pending / rejected / unpaid samajhta hai
    private function uiStatus(GymSubscription $sub, $proofs): string
    {
        if ($sub->paid_amount >= $sub->total_amount) {
            return 'paid';
        }
        if ($proofs->contains('status', 'pending')) {
            return 'pending';
        }
        $latest = $proofs->sortByDesc('id')->first();
        if ($latest && $latest->status === 'rejected') {
            return 'rejected';
        }
        return 'unpaid';
    }

    /* ---------------- GET /super-admin/payments ---------------- */

    public function index()
    {
        $companies = GymCompany::orderBy('name')->get();

        /*
         * REMINDERS PAGE KE LIYE:
         * Har company ka "last fully paid cycle" (paid_amount >= total_amount).
         * Ek hi query se sab companies ka nikal lete hain (period_end ascending,
         * is liye har company ka last() sab se naya paid cycle hai).
         * paid_from  = us cycle ki start date  (billing start)
         * paid_until = us cycle ki end date    (subscription valid until / expiry)
         * Agar company ne kabhi poori payment nahi ki to dono '' rahenge -> "No Payment".
         */
        $lastPaidByCompany = GymSubscription::whereColumn('paid_amount', '>=', 'total_amount')
            ->where('total_amount', '>', 0)
            ->orderBy('period_end')
            ->get()
            ->groupBy('company_id')
            ->map(fn ($group) => $group->last());

        $data = $companies->map(function (GymCompany $c) use ($lastPaidByCompany) {
            $sub   = $c->currentSubscription();
            $proof = GymPaymentProof::where('subscription_id', $sub->id)
                ->orderByDesc('id')
                ->first();

            $lastPaid = $lastPaidByCompany->get($c->id);

            return [
                'id'             => $c->id,
                'client_name'    => $c->name,
                'phone'          => $c->phone ?? '',
                'plan'           => $c->plan,
                'total_amount'   => (float) $sub->total_amount,
                'paid_amount'    => (float) $sub->paid_amount,
                'billing_period' => $sub->period_start->format('d M Y'),
                'expires_at'     => $sub->period_end->format('d M Y'),
                // ---- NAYA: Reminders page ----
                'paid_from'      => $lastPaid ? $lastPaid->period_start->format('Y-m-d') : '',
                'paid_until'     => $lastPaid ? $lastPaid->period_end->format('Y-m-d') : '',
                // ------------------------------
                'is_blocked'     => (bool) $c->is_blocked,
                'proof'          => $proof ? $this->mapProof($proof) : null,
            ];
        })->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    /* ---------------- POST proofs/{id}/approve | reject ---------------- */

    public function approve($proofId)
    {
        return $this->review((int) $proofId, 'approve');
    }

    public function reject($proofId)
    {
        return $this->review((int) $proofId, 'reject');
    }

    private function review(int $proofId, string $action)
    {
        return DB::transaction(function () use ($proofId, $action) {
            $proof = GymPaymentProof::lockForUpdate()->findOrFail($proofId);

            if ($proof->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'This proof was already ' . $proof->status . '.',
                ], 422);
            }

            if ($action === 'approve') {
                $sub = GymSubscription::lockForUpdate()->findOrFail($proof->subscription_id);
                $sub->paid_amount = (float) $sub->paid_amount + (float) $proof->amount;
                $sub->save();

                $proof->status = 'approved';
            } else {
                $proof->status = 'rejected';
            }

            $proof->reviewed_at = now();
            $proof->save();

            return response()->json([
                'success' => true,
                'message' => $action === 'approve' ? 'Payment approved.' : 'Payment rejected.',
            ]);
        });
    }

    /* ---------------- GET companies/{id}/members ---------------- */

    public function members($companyId)
    {
        GymCompany::findOrFail($companyId);

        $cols = ['id', 'name', 'email', 'role'];
        $hasPhone = Schema::hasColumn('users', 'phone');
        if ($hasPhone) {
            $cols[] = 'phone';
        }

        $rows = DB::table('users')
            ->where('company_id', $companyId)
            ->orderBy('name')
            ->get($cols)
            ->map(fn ($u) => [
                'id'    => $u->id,
                'name'  => $u->name,
                'email' => $u->email ?? '',
                'phone' => $hasPhone ? ($u->phone ?? '') : '',
                'role'  => strtolower($u->role ?? 'staff'),
            ])
            ->values();

        return response()->json(['success' => true, 'data' => $rows]);
    }

    /* ---------------- GET companies/{id}/history ---------------- */

    public function history($companyId)
    {
        GymCompany::findOrFail($companyId);

        $subs = GymSubscription::where('company_id', $companyId)
            ->with('proofs')
            ->orderByDesc('period_start')
            ->orderByDesc('id')
            ->get();

        $data = $subs->map(function (GymSubscription $s) {
            return [
                'billing_period' => $s->period_start->format('d M Y'),
                'total_amount'   => (float) $s->total_amount,
                'paid_amount'    => (float) $s->paid_amount,
                'status'         => $this->uiStatus($s, $s->proofs),
                'proofs'         => $s->proofs->map(function (GymPaymentProof $p) {
                    return array_merge($this->mapProof($p), [
                        'uploaded_by' => $p->uploaded_by ?? '',
                    ]);
                })->values(),
            ];
        })->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    /* ---------------- PUT companies/{id}/fee ---------------- */

    public function updateFee(Request $request, $companyId)
    {
        $data = $request->validate([
            'monthly_fee' => 'required|numeric|min:1|max:100000000',
        ]);

        $company = GymCompany::findOrFail($companyId);

        DB::transaction(function () use ($company, $data) {
            $company->update(['monthly_fee' => $data['monthly_fee']]);

            // current cycle ki fee bhi badal jati hai (status isi se banta hai)
            $sub = $company->currentSubscription();
            $sub->update(['total_amount' => $data['monthly_fee']]);
        });

        return response()->json(['success' => true, 'message' => 'Monthly fee updated.']);
    }

    /* ---------------- PUT companies/{id}/block ---------------- */

    public function block(Request $request, $companyId)
    {
        $data = $request->validate([
            'blocked' => 'required|boolean',
        ]);

        $company = GymCompany::findOrFail($companyId);
        $blocked = (bool) $data['blocked'];

        DB::transaction(function () use ($company, $blocked) {
            $company->update([
                'is_blocked' => $blocked,
                'blocked_at' => $blocked ? now() : null,
            ]);

            if ($blocked) {
                // company ke saare users foran logout
                $userIds = DB::table('users')->where('company_id', $company->id)->pluck('id');

                DB::table('personal_access_tokens')
                    ->where('tokenable_type', User::class)
                    ->whereIn('tokenable_id', $userIds)
                    ->delete();
            }
        });

        return response()->json([
            'success' => true,
            'message' => $blocked ? 'Company blocked.' : 'Company unblocked.',
        ]);
    }
}