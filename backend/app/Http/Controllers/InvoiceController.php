<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\CompanyAware;
use App\Models\Invoice;
use App\Models\Customer;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class InvoiceController extends Controller
{
    use CompanyAware;

    /**
     * Incoming date ko Asia/Karachi local time ki tarah parse karta hai.
     * - "Y-m-d H:i:s" (tz ke baghair) = pehle se Karachi time
     * - ISO 8601 with Z/offset (JS toISOString) = sahi instant parse karke Karachi mein convert
     */
    private function parseAsKarachiTime($dateString)
    {
        if (empty($dateString)) {
            return Carbon::now('Asia/Karachi');
        }

        try {
            return Carbon::createFromFormat('Y-m-d H:i:s', $dateString, 'Asia/Karachi');
        } catch (\Exception $e) {
            try {
                return Carbon::parse($dateString)->setTimezone('Asia/Karachi');
            } catch (\Exception $e2) {
                Log::warning('Could not parse date string, falling back to now(): ' . $dateString);
                return Carbon::now('Asia/Karachi');
            }
        }
    }

    // Invoice ko API response format mein badalta hai (relations: items, creator, customer load honi chahiye)
    private function formatInvoice($invoice)
    {
        return [
            'id' => $invoice->id,
            'invoice_no' => $invoice->invoice_no,
            'invoice_date' => $invoice->invoice_date,
            'subtotal' => $invoice->subtotal ?? 0,
            'discount' => $invoice->discount ?? 0,
            'discount_note' => $invoice->discount_note,
            'total_amount' => $invoice->total_amount,
            'paid_amount' => $invoice->paid_amount,
            'remaining_amount' => $invoice->remaining_amount,
            'payment_method' => $invoice->payment_method,
            'paid_at' => $invoice->paid_at,
            'status' => $invoice->status,
            'customer_name' => $invoice->customer_name,
            'customer_phone' => $invoice->customer_phone,
            'customer_email' => $invoice->customer_email,
            'customer_car_number' => $invoice->customer_car_number,
            'customer_car_model' => $invoice->customer_car_model,
            'customer_birthday' => $invoice->customer ? $invoice->customer->birthday : null,
            'created_by' => $invoice->created_by,
            'creator_name' => $invoice->creator ? $invoice->creator->name : 'System',
            'creator_role' => $invoice->creator ? $invoice->creator->role : 'system',
            'items' => $invoice->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'service_id' => $item->service_id,
                    'service_name' => $item->service_name,
                    'service_category' => $item->service_category,
                    'mileage' => $item->mileage,
                    'quantity' => $item->quantity,
                    'price' => $item->price,
                    'total' => $item->total
                ];
            })
        ];
    }

    public function index()
    {
        try {
            $invoices = Invoice::with(['items', 'creator', 'customer'])->orderBy('id', 'desc')->get();

            return response()->json($invoices->map(fn($invoice) => $this->formatInvoice($invoice)));
        } catch (\Exception $e) {
            Log::error('Error fetching invoices: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch invoices: ' . $e->getMessage()
            ], 500);
        }
    }

    public function show($id)
    {
        try {
            $invoice = Invoice::with(['items', 'creator', 'customer'])->findOrFail($id);

            return response()->json($this->formatInvoice($invoice));
        } catch (\Exception $e) {
            Log::error('Error fetching invoice: ' . $e->getMessage());
            return response()->json(['error' => 'Invoice not found'], 404);
        }
    }

    public function store(Request $request)
    {
        $companyId = $this->cid();

        try {
            DB::beginTransaction();

            Log::info('Invoice store request received:', $request->all());

            $validated = $request->validate([
                'invoice_no' => 'required|string|max:50',
                'invoice_date' => 'nullable|date',
                'customer_name' => 'required|string|max:255',
                'customer_phone' => 'nullable|string|max:20',
                'customer_email' => 'nullable|email|max:255',
                'customer_car_number' => 'nullable|string|max:50',
                'customer_car_model' => 'nullable|string|max:100',
                'subtotal' => 'required|numeric|min:0',
                'discount' => 'required|numeric|min:0',
                'discount_note' => 'nullable|string|max:255',
                'total_amount' => 'required|numeric|min:0',
                'paid_amount' => 'nullable|numeric|min:0',
                'remaining_amount' => 'nullable|numeric|min:0',
                'payment_method' => 'nullable|string|max:50',
                'status' => 'nullable|string|max:20',
                'items' => 'required|array|min:1',
                'items.*.service_name' => 'required|string',
                'items.*.service_category' => 'nullable|string',
                'items.*.mileage' => 'nullable|integer|min:0',
                'items.*.price' => 'required|numeric|min:0',
                'items.*.quantity' => 'required|integer|min:1'
            ]);

            // Customer save/update (sirf isi company ke customers mein dhoondta hai)
            $customer = null;
            if (!empty($validated['customer_phone'])) {
                $customer = Customer::where('phone', $validated['customer_phone'])->first();

                if (!$customer) {
                    $customer = Customer::create([
                        'name' => $validated['customer_name'],
                        'phone' => $validated['customer_phone'],
                        'email' => $validated['customer_email'] ?? null,
                        'car_number' => $validated['customer_car_number'] ?? null,
                        'car_model' => $validated['customer_car_model'] ?? null,
                    ]);
                    Log::info('New customer created: ID ' . $customer->id);
                } else {
                    $customer->update([
                        'name' => $validated['customer_name'] ?? $customer->name,
                        'email' => $validated['customer_email'] ?? $customer->email,
                        'car_number' => $validated['customer_car_number'] ?? $customer->car_number,
                        'car_model' => $validated['customer_car_model'] ?? $customer->car_model,
                    ]);
                    Log::info('Customer updated: ID ' . $customer->id);
                }
            }

            $paidAmount = $validated['paid_amount'] ?? 0;
            $totalAmount = $validated['total_amount'];
            $remainingAmount = $validated['remaining_amount'] ?? ($totalAmount - $paidAmount);

            if ($paidAmount >= $totalAmount) {
                $status = 'Paid';
            } elseif ($paidAmount > 0) {
                $status = 'Partial';
            } else {
                $status = 'Pending';
            }

            $invoiceDateTime = $this->parseAsKarachiTime($validated['invoice_date'] ?? null);

            $invoiceId = DB::table('invoices')->insertGetId([
                'company_id' => $companyId,
                'invoice_no' => $validated['invoice_no'],
                'customer_id' => $customer ? $customer->id : null,
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'] ?? null,
                'customer_email' => $validated['customer_email'] ?? null,
                'customer_car_number' => $validated['customer_car_number'] ?? null,
                'customer_car_model' => $validated['customer_car_model'] ?? null,
                'subtotal' => $validated['subtotal'],
                'discount' => $validated['discount'],
                'discount_note' => $validated['discount_note'] ?? null,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'payment_method' => $validated['payment_method'] ?? 'cash',
                'status' => $status,
                'invoice_date' => $invoiceDateTime,
                'created_by' => auth()->id(),
                'created_at' => Carbon::now('Asia/Karachi'),
                'updated_at' => Carbon::now('Asia/Karachi')
            ]);

            Log::info('Invoice created: ID ' . $invoiceId . ' by user: ' . auth()->id());

            // Initial payment history
            if ($paidAmount > 0) {
                try {
                    DB::table('payment_histories')->insert([
                        'company_id' => $companyId,
                        'invoice_id' => $invoiceId,
                        'invoice_no' => $validated['invoice_no'],
                        'amount' => $paidAmount,
                        'payment_method' => $validated['payment_method'] ?? 'cash',
                        'paid_at' => $invoiceDateTime->format('Y-m-d H:i:s'),
                        'created_by' => auth()->id(),
                        'created_at' => Carbon::now('Asia/Karachi'),
                        'updated_at' => Carbon::now('Asia/Karachi')
                    ]);
                } catch (\Exception $e) {
                    Log::warning('Initial payment history save skipped: ' . $e->getMessage());
                }
            }

            foreach ($validated['items'] as $item) {
                DB::table('invoice_items')->insert([
                    'company_id' => $companyId,
                    'invoice_id' => $invoiceId,
                    'service_name' => $item['service_name'],
                    'service_category' => $item['service_category'] ?? 'Service',
                    'mileage' => $item['mileage'] ?? null,
                    'quantity' => $item['quantity'],
                    'price' => $item['price'],
                    'total' => $item['price'] * $item['quantity'],
                    'created_at' => Carbon::now('Asia/Karachi'),
                    'updated_at' => Carbon::now('Asia/Karachi')
                ]);
            }

            DB::commit();

            $invoice = DB::table('invoices')->where('id', $invoiceId)->first();
            $items = DB::table('invoice_items')->where('invoice_id', $invoiceId)->get();

            return response()->json([
                'success' => true,
                'id' => $invoiceId,
                'invoice_no' => $invoice->invoice_no,
                'invoice_date' => $invoice->invoice_date,
                'subtotal' => $invoice->subtotal ?? 0,
                'discount' => $invoice->discount ?? 0,
                'discount_note' => $invoice->discount_note,
                'total_amount' => $invoice->total_amount,
                'paid_amount' => $invoice->paid_amount,
                'remaining_amount' => $invoice->remaining_amount,
                'payment_method' => $invoice->payment_method,
                'status' => $invoice->status,
                'customer_id' => $customer ? $customer->id : null,
                'customer_name' => $invoice->customer_name,
                'customer_phone' => $invoice->customer_phone,
                'customer_email' => $invoice->customer_email,
                'customer_car_number' => $invoice->customer_car_number,
                'customer_car_model' => $invoice->customer_car_model,
                'created_by' => $invoice->created_by,
                'items' => $items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'service_name' => $item->service_name,
                        'service_category' => $item->service_category,
                        'mileage' => $item->mileage,
                        'quantity' => $item->quantity,
                        'price' => $item->price,
                        'total' => $item->total
                    ];
                })
            ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            Log::error('Validation error:', $e->errors());
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Invoice creation error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create invoice: ' . $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            DB::beginTransaction();

            Log::info('Invoice update request received:', $request->all());

            $validated = $request->validate([
                'subtotal' => 'sometimes|numeric|min:0',
                'discount' => 'sometimes|numeric|min:0',
                'discount_note' => 'nullable|string|max:255',
                'total_amount' => 'sometimes|numeric|min:0',
                'paid_amount' => 'sometimes|numeric|min:0',
                'remaining_amount' => 'sometimes|numeric|min:0',
                'payment_method' => 'sometimes|string|max:50',
                'status' => 'sometimes|string|max:20'
            ]);

            $invoice = Invoice::findOrFail($id);

            $invoice->update([
                'subtotal' => $validated['subtotal'] ?? $invoice->subtotal,
                'discount' => $validated['discount'] ?? $invoice->discount,
                'discount_note' => $validated['discount_note'] ?? $invoice->discount_note,
                'total_amount' => $validated['total_amount'] ?? $invoice->total_amount,
                'paid_amount' => $validated['paid_amount'] ?? $invoice->paid_amount,
                'remaining_amount' => $validated['remaining_amount'] ?? $invoice->remaining_amount,
                'payment_method' => $validated['payment_method'] ?? $invoice->payment_method,
                'status' => $validated['status'] ?? $invoice->status,
                'updated_at' => Carbon::now('Asia/Karachi')
            ]);

            DB::commit();

            Log::info('Invoice updated: ID ' . $invoice->id);

            $updatedInvoice = Invoice::with(['items', 'creator', 'customer'])->find($id);

            return response()->json([
                'success' => true,
                'message' => 'Invoice updated successfully',
                'data' => $this->formatInvoice($updatedInvoice)
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            Log::error('Validation error:', $e->errors());
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Invoice not found'
            ], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Invoice update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update invoice: ' . $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        try {
            DB::beginTransaction();

            // findOrFail sirf isi company ki invoice dega, to neeche ka delete bhi safe hai
            $invoice = Invoice::findOrFail($id);

            foreach ($invoice->items as $item) {
                $product = Product::find($item->service_id);
                if ($product) {
                    $product->increment('quantity', $item->quantity);
                }
            }

            DB::table('invoice_items')->where('invoice_id', $invoice->id)->delete();
            DB::table('payment_histories')->where('invoice_id', $invoice->id)->delete();

            $invoice->delete();

            DB::commit();

            Log::info('Invoice deleted (with items + payment history): ID ' . $id);

            return response()->json([
                'message' => 'Invoice deleted successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting invoice: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to delete invoice'
            ], 500);
        }
    }

    public function getCustomerHistory($phone)
    {
        try {
            $invoices = Invoice::where('customer_phone', $phone)
                ->orderBy('invoice_date', 'desc')
                ->with(['items', 'creator', 'customer'])
                ->get();

            return response()->json($invoices->map(fn($invoice) => $this->formatInvoice($invoice)));
        } catch (\Exception $e) {
            Log::error('Error fetching customer history: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch customer history'
            ], 500);
        }
    }

    public function getStats()
    {
        try {
            return response()->json([
                'total_invoices' => Invoice::count(),
                'total_revenue' => Invoice::sum('total_amount'),
                'total_paid' => Invoice::sum('paid_amount'),
                'total_remaining' => Invoice::sum('remaining_amount'),
                'paid_invoices' => Invoice::where('status', 'Paid')->count(),
                'partial_invoices' => Invoice::where('status', 'Partial')->count(),
                'pending_invoices' => Invoice::where('status', 'Pending')->count()
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching invoice stats: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch statistics'
            ], 500);
        }
    }

    // ==================== PENDING PAYMENTS ====================

    public function getPendingPayments()
    {
        try {
            $pendingInvoices = Invoice::whereIn('status', ['Partial', 'Pending'])
                ->with(['items', 'customer'])
                ->orderBy('created_at', 'desc')
                ->get();

            Log::info('Pending payments found: ' . $pendingInvoices->count());

            $transformed = $pendingInvoices->map(function ($invoice) {
                $remaining = (float) $invoice->remaining_amount;
                if ($remaining < 0) {
                    $remaining = 0;
                }

                return [
                    'id' => $invoice->id,
                    'invoice_no' => $invoice->invoice_no,
                    'customer_name' => $invoice->customer_name,
                    'customer_phone' => $invoice->customer_phone,
                    'customer_car_number' => $invoice->customer_car_number,
                    'customer_car_model' => $invoice->customer_car_model,
                    'subtotal' => $invoice->subtotal ?? 0,
                    'discount' => $invoice->discount ?? 0,
                    'discount_note' => $invoice->discount_note,
                    'total_amount' => (float) $invoice->total_amount,
                    'paid_amount' => (float) $invoice->paid_amount,
                    'remaining_amount' => $remaining,
                    'payment_method' => $invoice->payment_method,
                    'paid_at' => $invoice->paid_at,
                    'status' => $invoice->status,
                    'invoice_date' => $invoice->invoice_date,
                    'items' => $invoice->items->map(function ($item) {
                        return [
                            'service_name' => $item->service_name,
                            'price' => (float) $item->price,
                            'quantity' => $item->quantity,
                            'total' => (float) $item->total,
                            'mileage' => $item->mileage
                        ];
                    })
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $transformed
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching pending payments: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch pending payments: ' . $e->getMessage()
            ], 500);
        }
    }

    public function updatePendingPayment(Request $request, $id)
    {
        $companyId = $this->cid();

        try {
            $request->validate([
                'amount' => 'required|numeric|min:0.01',
                'payment_method' => 'nullable|string|max:100',
                'paid_at' => 'nullable|date'
            ]);

            $invoice = Invoice::findOrFail($id);

            if ($request->amount > $invoice->remaining_amount) {
                return response()->json([
                    'success' => false,
                    'message' => 'Amount cannot exceed remaining balance of Rs. ' . number_format($invoice->remaining_amount, 2)
                ], 400);
            }

            $newPaidAmount = $invoice->paid_amount + $request->amount;
            $newRemainingAmount = $invoice->remaining_amount - $request->amount;

            if ($newRemainingAmount <= 0) {
                $status = 'Paid';
                $newRemainingAmount = 0;
            } else {
                $status = 'Partial';
            }

            $paymentMethod = $request->payment_method ?? $invoice->payment_method ?? 'Cash';
            $paidAt = $this->parseAsKarachiTime($request->paid_at);

            $invoice->update([
                'paid_amount' => $newPaidAmount,
                'remaining_amount' => $newRemainingAmount,
                'status' => $status,
                'payment_method' => $paymentMethod,
                'paid_at' => $paidAt,
                'updated_at' => Carbon::now('Asia/Karachi')
            ]);

            try {
                DB::table('payment_histories')->insert([
                    'company_id' => $companyId,
                    'invoice_id' => $invoice->id,
                    'invoice_no' => $invoice->invoice_no,
                    'amount' => $request->amount,
                    'payment_method' => $paymentMethod,
                    'paid_at' => $paidAt->format('Y-m-d H:i:s'),
                    'created_by' => auth()->id(),
                    'created_at' => Carbon::now('Asia/Karachi'),
                    'updated_at' => Carbon::now('Asia/Karachi')
                ]);
            } catch (\Exception $e) {
                Log::warning('Payment history save skipped: ' . $e->getMessage());
            }

            Log::info('Payment updated for invoice: ' . $invoice->invoice_no .
                      ' | Amount: ' . $request->amount .
                      ' | Payment Method: ' . $paymentMethod .
                      ' | Paid At: ' . $paidAt->format('Y-m-d H:i:s') .
                      ' | Remaining: ' . $newRemainingAmount);

            return response()->json([
                'success' => true,
                'message' => 'Payment recorded successfully via ' . $paymentMethod . '!',
                'data' => [
                    'id' => $invoice->id,
                    'invoice_no' => $invoice->invoice_no,
                    'customer_name' => $invoice->customer_name,
                    'subtotal' => $invoice->subtotal ?? 0,
                    'discount' => $invoice->discount ?? 0,
                    'discount_note' => $invoice->discount_note,
                    'total_amount' => $invoice->total_amount,
                    'paid_amount' => $invoice->paid_amount,
                    'remaining_amount' => $invoice->remaining_amount,
                    'payment_method' => $invoice->payment_method,
                    'paid_at' => $invoice->paid_at,
                    'status' => $invoice->status
                ]
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Invoice not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating pending payment: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update payment: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getPaymentHistory($invoiceNo)
    {
        $companyId = $this->cid();

        try {
            $histories = DB::table('payment_histories')
                ->where('company_id', $companyId)
                ->where('invoice_no', $invoiceNo)
                ->orderBy('paid_at', 'desc')
                ->get();

            Log::info('Payment history fetched for invoice: ' . $invoiceNo . ' | Count: ' . $histories->count());

            return response()->json([
                'success' => true,
                'data' => $histories
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching payment history: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch payment history: ' . $e->getMessage()
            ], 500);
        }
    }
}