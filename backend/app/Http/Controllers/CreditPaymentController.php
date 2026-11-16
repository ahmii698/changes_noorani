<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\CompanyAware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class CreditPaymentController extends Controller
{
    use CompanyAware;

    // Login user ka naam (created_by ke liye)
    private function getCreatedBy()
    {
        $createdBy = 'System';

        try {
            if (auth()->guard('sanctum')->check()) {
                $user = auth()->guard('sanctum')->user();
                return $user->name ?? $user->email ?? 'Admin';
            }

            if (auth()->guard('web')->check()) {
                $user = auth()->guard('web')->user();
                return $user->name ?? $user->email ?? 'Admin';
            }

            if (auth()->check()) {
                $user = auth()->user();
                return $user->name ?? $user->email ?? 'Admin';
            }
        } catch (\Exception $e) {
            Log::error('Auth check error: ' . $e->getMessage());
        }

        return $createdBy;
    }

    /**
     * POST /api/credit/payments
     */
    public function store(Request $request)
    {
        $cid = $this->cid();

        $validator = Validator::make($request->all(), [
            'vendor_id' => ['required', Rule::exists('credit_vendors', 'id')->where('company_id', $cid)],
            'amount' => 'required|numeric|min:1',
            'note' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $vendor = DB::table('credit_vendors')
                ->where('company_id', $cid)
                ->where('id', $request->vendor_id)
                ->first();

            if (!$vendor) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Vendor not found',
                ], 404);
            }

            if ($request->amount > $vendor->balance_amount) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Payment amount cannot exceed balance amount',
                ], 422);
            }

            $createdBy = $this->getCreatedBy();

            DB::table('credit_payments')->insert([
                'company_id' => $cid,
                'vendor_id' => $vendor->id,
                'amount' => $request->amount,
                'payment_date' => now(),
                'note' => $request->note ?? 'Payment made',
                'created_by' => $createdBy,
            ]);

            $newPaidAmount = $vendor->paid_amount + $request->amount;
            $newBalanceAmount = $vendor->total_amount - $newPaidAmount;

            DB::table('credit_vendors')
                ->where('company_id', $cid)
                ->where('id', $vendor->id)
                ->update([
                    'paid_amount' => $newPaidAmount,
                    'balance_amount' => $newBalanceAmount,
                    'updated_at' => now(),
                ]);

            DB::commit();

            $updatedVendor = DB::table('credit_vendors')->where('id', $vendor->id)->first();

            return response()->json([
                'success' => true,
                'message' => 'Payment recorded successfully',
                'data' => [
                    'vendor' => [
                        'id' => $updatedVendor->id,
                        'name' => $updatedVendor->vendor_name,
                        'paidAmount' => (float) $updatedVendor->paid_amount,
                        'balanceAmount' => (float) $updatedVendor->balance_amount,
                    ],
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error recording payment: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to record payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/credit/payments/vendor/{vendorId}
     */
    public function getVendorPayments($vendorId)
    {
        $cid = $this->cid();

        try {
            $vendor = DB::table('credit_vendors')->where('company_id', $cid)->where('id', $vendorId)->first();

            if (!$vendor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Vendor not found',
                ], 404);
            }

            $payments = DB::table('credit_payments')
                ->where('company_id', $cid)
                ->where('vendor_id', $vendorId)
                ->orderBy('payment_date', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'vendor' => [
                        'id' => $vendor->id,
                        'name' => $vendor->vendor_name,
                        'totalAmount' => (float) $vendor->total_amount,
                        'paidAmount' => (float) $vendor->paid_amount,
                        'balanceAmount' => (float) $vendor->balance_amount,
                    ],
                    'payments' => $payments->map(function ($payment) {
                        return [
                            'id' => $payment->id,
                            'amount' => (float) $payment->amount,
                            'date' => $payment->payment_date,
                            'note' => $payment->note,
                            'createdBy' => $payment->created_by,
                        ];
                    }),
                    'totalPayments' => $payments->count(),
                    'totalAmountPaid' => (float) $payments->sum('amount'),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching vendor payments: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch payments: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/credit/payments
     */
    public function index(Request $request)
    {
        $cid = $this->cid();

        try {
            $query = DB::table('credit_payments')->where('company_id', $cid);

            if ($request->has('vendor_id') && !empty($request->vendor_id)) {
                $query->where('vendor_id', $request->vendor_id);
            }

            if ($request->has('from_date') && !empty($request->from_date)) {
                $query->whereDate('payment_date', '>=', $request->from_date);
            }
            if ($request->has('to_date') && !empty($request->to_date)) {
                $query->whereDate('payment_date', '<=', $request->to_date);
            }

            if ($request->has('current_month') && $request->current_month) {
                $query->whereMonth('payment_date', now()->month)
                      ->whereYear('payment_date', now()->year);
            }

            if ($request->has('today') && $request->today) {
                $query->whereDate('payment_date', now()->toDateString());
            }

            $payments = $query->orderBy('payment_date', 'desc')->get();

            return response()->json([
                'success' => true,
                'data' => $payments,
                'totalCount' => $payments->count(),
                'totalAmount' => (float) $payments->sum('amount'),
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching payments: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch payments: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/credit/payments/{id}
     */
    public function show($id)
    {
        $cid = $this->cid();

        $payment = DB::table('credit_payments')->where('company_id', $cid)->where('id', $id)->first();

        if (!$payment) {
            return response()->json([
                'success' => false,
                'message' => 'Payment not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $payment,
        ]);
    }

    /**
     * PUT /api/credit/payments/{id}  (sirf note badalta hai, amount nahi)
     */
    public function update(Request $request, $id)
    {
        $cid = $this->cid();

        $validator = Validator::make($request->all(), [
            'note' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $updated = DB::table('credit_payments')
            ->where('company_id', $cid)
            ->where('id', $id)
            ->update(['note' => $request->input('note')]);

        $payment = DB::table('credit_payments')->where('company_id', $cid)->where('id', $id)->first();

        if (!$payment) {
            return response()->json([
                'success' => false,
                'message' => 'Payment not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment updated successfully',
            'data' => $payment,
        ]);
    }

    /**
     * DELETE /api/credit/payments/{id}  (vendor ka balance wapis theek karta hai)
     */
    public function destroy($id)
    {
        $cid = $this->cid();

        try {
            $payment = DB::table('credit_payments')->where('company_id', $cid)->where('id', $id)->first();

            if (!$payment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Payment not found',
                ], 404);
            }

            DB::beginTransaction();

            $vendor = DB::table('credit_vendors')
                ->where('company_id', $cid)
                ->where('id', $payment->vendor_id)
                ->first();

            if ($vendor) {
                $newPaidAmount = $vendor->paid_amount - $payment->amount;
                $newBalanceAmount = $vendor->total_amount - $newPaidAmount;

                DB::table('credit_vendors')
                    ->where('company_id', $cid)
                    ->where('id', $vendor->id)
                    ->update([
                        'paid_amount' => $newPaidAmount,
                        'balance_amount' => $newBalanceAmount,
                        'updated_at' => now(),
                    ]);
            }

            DB::table('credit_payments')->where('company_id', $cid)->where('id', $id)->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Payment deleted successfully',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting payment: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/credit/payments/statistics
     */
    public function statistics(Request $request)
    {
        $cid = $this->cid();

        try {
            $base = fn() => DB::table('credit_payments')->where('company_id', $cid);

            $query = $base();
            if ($request->has('vendor_id') && !empty($request->vendor_id)) {
                $query->where('vendor_id', $request->vendor_id);
            }

            $totalPayments = (clone $query)->count();
            $totalAmount = (clone $query)->sum('amount') ?? 0;

            $currentMonth = $base()
                ->whereMonth('payment_date', now()->month)
                ->whereYear('payment_date', now()->year)
                ->sum('amount') ?? 0;

            $currentWeek = $base()
                ->whereBetween('payment_date', [now()->startOfWeek(), now()->endOfWeek()])
                ->sum('amount') ?? 0;

            $today = $base()
                ->whereDate('payment_date', now()->toDateString())
                ->sum('amount') ?? 0;

            return response()->json([
                'success' => true,
                'data' => [
                    'total_payments' => $totalPayments,
                    'total_amount' => (float) $totalAmount,
                    'current_month' => (float) $currentMonth,
                    'current_week' => (float) $currentWeek,
                    'today' => (float) $today,
                    'average_payment' => $totalPayments > 0 ? (float) ($totalAmount / $totalPayments) : 0,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching statistics: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch statistics: ' . $e->getMessage(),
            ], 500);
        }
    }
}