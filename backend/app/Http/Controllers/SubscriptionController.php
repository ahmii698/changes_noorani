<?php

namespace App\Http\Controllers;

use App\Models\GymCompany;
use App\Models\GymPaymentProof;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SubscriptionController extends Controller
{
    private function companyFor(Request $request): ?GymCompany
    {
        $user = $request->user();
        return $user && $user->company_id ? GymCompany::find($user->company_id) : null;
    }

    private function mapProof(GymPaymentProof $p): array
    {
        return [
            'id'          => $p->id,
            'amount'      => (float) $p->amount,
            'status'      => $p->status,
            'url'         => Storage::disk('public')->url($p->image_path),
            'uploaded_by' => $p->uploaded_by ?? '',
            'created_at'  => optional($p->created_at)->toIso8601String(),
        ];
    }

    // GET /subscription
    public function show(Request $request)
    {
        $company = $this->companyFor($request);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'No company linked to this user.'], 403);
        }

        $sub = $company->currentSubscription();

        $total     = (float) $sub->total_amount;
        $paid      = (float) $sub->paid_amount;
        $remaining = max($total - $paid, 0);

        return response()->json([
            'success' => true,
            'data' => [
                'company'         => $company->name,
                'plan'            => $company->plan,
                'monthly_fee'     => $total,
                'paid_amount'     => $paid,
                'remaining'       => $remaining,
                // Frontend ka parseDate "Y-m-d" format maangta hai
                'billing_start'   => $sub->period_start->format('Y-m-d'),
                'due_date'        => $sub->period_end->format('Y-m-d'),
                'is_paid'         => $total > 0 && $paid >= $total,
                'is_trial'        => false,   // apni trial logic ho to yahan lagana
                'trial_days_left' => null,
                'proofs'          => $sub->proofs->map(fn ($p) => $this->mapProof($p))->values(),
            ],
        ]);
    }

    // POST /subscription/proofs   (multipart: amount, image)
    public function uploadProof(Request $request)
    {
        $user    = $request->user();
        $company = $this->companyFor($request);

        if (!$company) {
            return response()->json(['success' => false, 'message' => 'No company linked to this user.'], 403);
        }
        if (strtolower($user->role ?? '') !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Only the admin can upload payment proof.'], 403);
        }

        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'image'  => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $sub = $company->currentSubscription();

        if ((float) $sub->paid_amount >= (float) $sub->total_amount) {
            return response()->json(['success' => false, 'message' => 'This cycle is already fully paid.'], 422);
        }

        $path = $request->file('image')->store('payment-proofs', 'public');

        $proof = GymPaymentProof::create([
            'subscription_id' => $sub->id,
            'company_id'      => $company->id,
            'amount'          => $data['amount'],
            'image_path'      => $path,
            'status'          => 'pending',
            'uploaded_by'     => $user->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Proof submitted. Waiting for review.',
            'data'    => $this->mapProof($proof),
        ], 201);
    }
}