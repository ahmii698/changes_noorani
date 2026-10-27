<?php
// app/Http/Controllers/EmployeeLoanController.php

namespace App\Http\Controllers;

use App\Models\EmployeeLoanTransaction;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class EmployeeLoanController extends Controller
{
    /**
     * Ek employee ke totals nikalta hai.
     */
    private function totalsFor($employeeId): array
    {
        $row = EmployeeLoanTransaction::where('employee_id', $employeeId)
            ->selectRaw("
                COALESCE(SUM(CASE WHEN type='loan' THEN amount ELSE 0 END),0) AS total_loan,
                COALESCE(SUM(CASE WHEN type='repayment' THEN amount ELSE 0 END),0) AS total_repaid,
                MAX(CASE WHEN type='loan' THEN transaction_date END) AS last_loan_date,
                MAX(CASE WHEN type='repayment' THEN transaction_date END) AS last_repayment_date
            ")
            ->first();

        $totalLoan = (float) $row->total_loan;
        $totalRepaid = (float) $row->total_repaid;

        return [
            'employee_id'         => (int) $employeeId,
            'total_loan'          => $totalLoan,
            'total_repaid'        => $totalRepaid,
            'remaining'           => $totalLoan - $totalRepaid,
            'last_loan_date'      => $row->last_loan_date,
            'last_repayment_date' => $row->last_repayment_date,
        ];
    }

    /**
     * GET /employee-loans/summary
     * Salary table ke liye: har employee ka loan summary (ek hi query mein).
     */
    public function summary()
    {
        $rows = EmployeeLoanTransaction::selectRaw("
                employee_id,
                COALESCE(SUM(CASE WHEN type='loan' THEN amount ELSE 0 END),0) AS total_loan,
                COALESCE(SUM(CASE WHEN type='repayment' THEN amount ELSE 0 END),0) AS total_repaid,
                MAX(CASE WHEN type='loan' THEN transaction_date END) AS last_loan_date,
                MAX(CASE WHEN type='repayment' THEN transaction_date END) AS last_repayment_date
            ")
            ->groupBy('employee_id')
            ->get()
            ->map(function ($r) {
                $loan = (float) $r->total_loan;
                $paid = (float) $r->total_repaid;
                return [
                    'employee_id'         => (int) $r->employee_id,
                    'total_loan'          => $loan,
                    'total_repaid'        => $paid,
                    'remaining'           => $loan - $paid,
                    'last_loan_date'      => $r->last_loan_date,
                    'last_repayment_date' => $r->last_repayment_date,
                ];
            })
            ->values();

        return response()->json(['success' => true, 'data' => $rows]);
    }

    /**
     * GET /employee-loans/employee/{employeeId}
     * Loan view: poori history + totals.
     */
    public function showByEmployee($employeeId)
    {
        $employee = DB::table('employees')->where('id', $employeeId)->first();
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Employee not found'], 404);
        }

        $transactions = EmployeeLoanTransaction::where('employee_id', $employeeId)
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'employee'     => ['id' => $employee->id, 'name' => $employee->name],
                'summary'      => $this->totalsFor($employeeId),
                'transactions' => $transactions,
            ],
        ]);
    }

    /**
     * POST /employee-loans
     * type = loan (paisay diye) ya repayment (employee ne wapas kiye)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_id'      => 'required|integer',
            'type'             => 'required|in:loan,repayment',
            'amount'           => 'required|numeric|min:1',
            'transaction_date' => 'nullable|date',
            'note'             => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors'  => $validator->errors(),
            ], 422);
        }

        if (!DB::table('employees')->where('id', $request->employee_id)->exists()) {
            return response()->json(['success' => false, 'message' => 'Employee not found'], 404);
        }

        $amount = (float) $request->amount;

        if ($request->type === 'repayment') {
            $remaining = $this->totalsFor($request->employee_id)['remaining'];
            if ($amount > $remaining) {
                return response()->json([
                    'success' => false,
                    'message' => 'Repayment remaining loan (Rs. ' . number_format($remaining) . ') se zyada nahi ho sakti',
                ], 422);
            }
        }

        $user = auth('sanctum')->user();

        $tx = EmployeeLoanTransaction::create([
            'employee_id'      => $request->employee_id,
            'type'             => $request->type,
            'amount'           => $amount,
            'transaction_date' => $request->transaction_date ?: Carbon::now('Asia/Karachi')->toDateString(),
            'note'             => $request->note ?: ($request->type === 'loan' ? 'Loan given' : 'Loan repayment'),
            'created_by'       => $user->name ?? 'System',
        ]);

        return response()->json([
            'success' => true,
            'message' => $request->type === 'loan' ? 'Loan recorded successfully' : 'Repayment recorded successfully',
            'data'    => $tx,
        ], 201);
    }

    /**
     * DELETE /employee-loans/{id}
     */
    public function destroy($id)
    {
        $tx = EmployeeLoanTransaction::find($id);
        if (!$tx) {
            return response()->json(['success' => false, 'message' => 'Record not found'], 404);
        }

        // Agar loan entry delete karne se remaining minus ho jaye to rok do
        if ($tx->type === 'loan') {
            $remaining = $this->totalsFor($tx->employee_id)['remaining'];
            if ($remaining - (float) $tx->amount < 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pehle is loan ki repayments delete karein, phir loan delete hoga',
                ], 422);
            }
        }

        $tx->delete();

        return response()->json(['success' => true, 'message' => 'Record deleted successfully']);
    }
}