<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\CreditVendor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    // Product ko API response format mein badalta hai
    private function formatProduct($product, bool $withCreditTotals = false)
    {
        $data = [
            'id' => $product->id,
            'name' => $product->name,
            'category' => $product->category,
            'purchase_price' => (float) $product->purchase_price,
            'selling_price' => (float) $product->selling_price,
            'quantity' => (int) $product->quantity,
            'low_stock_threshold' => (int) $product->low_stock_threshold,
            'date_added' => $product->date_added,
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
            'is_credit_purchase' => (bool) $product->is_credit_purchase,
            'is_hidden' => (bool) $product->is_hidden,
            'vendor_id' => $product->vendor_id,
            'vendor_name' => $product->vendor_name,
            'stock_status' => $product->stock_status,
            'stock_status_color' => $product->stock_status_color,
            'total_credit_quantity' => $product->total_credit_quantity,
            'credit_vendor' => $product->creditVendor ? [
                'id' => $product->creditVendor->id,
                'name' => $product->creditVendor->vendor_name,
                'invoice_number' => $product->creditVendor->invoice_number,
            ] : null,
        ];

        if ($withCreditTotals) {
            $data['total_credit_amount'] = $product->total_credit_amount;
        }

        return $data;
    }

    /**
     * GET /api/products
     */
    public function index(Request $request)
    {
        try {
            $query = Product::with('creditVendor');

            $showHidden = $request->has('show_hidden') && $request->show_hidden == 'true';

            if (!$showHidden) {
                $query->where('is_hidden', 0);
            }

            if ($request->has('is_credit') && $request->is_credit !== '') {
                $query->where('is_credit_purchase', $request->is_credit);
            }

            if ($request->has('vendor_id') && !empty($request->vendor_id)) {
                $query->where('vendor_id', $request->vendor_id);
            }

            if ($request->has('search') && !empty($request->search)) {
                $query->where('name', 'LIKE', "%{$request->search}%");
            }

            if ($request->has('category') && !empty($request->category)) {
                $query->where('category', $request->category);
            }

            if ($request->has('low_stock') && $request->low_stock) {
                $query->whereColumn('quantity', '<', 'low_stock_threshold');
            }

            $products = $query->orderBy('created_at', 'desc')->get();

            $hiddenCount = Product::where('is_hidden', 1)->count();
            $activeCount = Product::where('is_hidden', 0)->count();

            return response()->json([
                'success' => true,
                'data' => $products->map(fn($product) => $this->formatProduct($product)),
                'total' => $products->count(),
                'active_count' => $activeCount,
                'hidden_count' => $hiddenCount,
                'low_stock_count' => $products->filter(function ($p) {
                    return $p->quantity < $p->low_stock_threshold;
                })->count(),
                'showing_hidden' => $showHidden,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch products',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/products/{id}
     */
    public function show($id)
    {
        try {
            $product = Product::with(['creditVendor', 'creditLinks'])->findOrFail($id);

            $data = $this->formatProduct($product, true);
            $data['credit_links'] = $product->creditLinks->map(function ($link) {
                return [
                    'id' => $link->id,
                    'vendor_id' => $link->vendor_id,
                    'vendor_name' => $link->vendor_name,
                    'quantity' => (int) $link->quantity,
                    'purchase_price' => (float) $link->purchase_price,
                    'total_price' => (float) $link->total_price,
                    'created_at' => $link->created_at,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found',
                'error' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * POST /api/products
     */
    public function store(Request $request)
    {
        $companyId = $request->user()->company_id;

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:100',
            'purchase_price' => 'required|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'quantity' => 'required|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'vendor_id' => ['nullable', Rule::exists('credit_vendors', 'id')->where('company_id', $companyId)],
            'is_credit_purchase' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $product = Product::create([
                'name' => $request->name,
                'category' => $request->category ?? null,
                'purchase_price' => $request->purchase_price,
                'selling_price' => $request->selling_price,
                'quantity' => $request->quantity,
                'low_stock_threshold' => $request->low_stock_threshold ?? 5,
                'date_added' => now(),
                'vendor_id' => $request->vendor_id ?? null,
                'is_credit_purchase' => $request->is_credit_purchase ?? false,
                'is_hidden' => 0,
            ]);

            if ($request->has('vendor_id') && !empty($request->vendor_id)) {
                \App\Models\CreditProductLink::create([
                    'vendor_id' => $request->vendor_id,
                    'product_id' => $product->id,
                    'quantity' => $request->quantity,
                    'purchase_price' => $request->purchase_price,
                ]);

                $vendor = CreditVendor::find($request->vendor_id);
                if ($vendor) {
                    $vendor->stock_quantity += $request->quantity;
                    $vendor->save();
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Product created successfully',
                'data' => $product->load('creditVendor'),
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create product',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PUT /api/products/{id}
     */
    public function update(Request $request, $id)
    {
        $companyId = $request->user()->company_id;
        $product = Product::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'category' => 'nullable|string|max:100',
            'purchase_price' => 'sometimes|required|numeric|min:0',
            'selling_price' => 'sometimes|required|numeric|min:0',
            'quantity' => 'sometimes|required|integer|min:0',
            'low_stock_threshold' => 'sometimes|nullable|integer|min:0',
            'vendor_id' => ['nullable', Rule::exists('credit_vendors', 'id')->where('company_id', $companyId)],
            'is_credit_purchase' => 'nullable|boolean',
            'is_hidden' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $oldQuantity = $product->quantity;

            $product->update($request->only([
                'name',
                'category',
                'purchase_price',
                'selling_price',
                'quantity',
                'low_stock_threshold',
                'vendor_id',
                'is_credit_purchase',
                'is_hidden'
            ]));

            $product->refresh();

            // Stock apni threshold se neeche gaya to email
            if ($product->quantity < $product->low_stock_threshold && $oldQuantity >= $product->low_stock_threshold) {
                Product::sendLowStockEmail($product);
            }

            if ($request->has('vendor_id') && $request->vendor_id) {
                $link = \App\Models\CreditProductLink::where('product_id', $product->id)->first();
                if ($link) {
                    $link->update([
                        'vendor_id' => $request->vendor_id,
                        'quantity' => $product->quantity,
                        'purchase_price' => $product->purchase_price,
                    ]);
                } else {
                    \App\Models\CreditProductLink::create([
                        'vendor_id' => $request->vendor_id,
                        'product_id' => $product->id,
                        'quantity' => $product->quantity,
                        'purchase_price' => $product->purchase_price,
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Product updated successfully',
                'data' => $product->load('creditVendor'),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update product',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /api/products/{id}
     */
    public function destroy($id)
    {
        try {
            $product = Product::findOrFail($id);

            $product->creditLinks()->delete();
            $product->delete();

            return response()->json([
                'success' => true,
                'message' => 'Product deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete product',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PATCH /api/products/{id}
     */
    public function patch(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'quantity' => 'sometimes|required|integer|min:0',
            'purchase_price' => 'sometimes|required|numeric|min:0',
            'selling_price' => 'sometimes|required|numeric|min:0',
            'low_stock_threshold' => 'sometimes|required|integer|min:0',
            'category' => 'sometimes|required|string|max:100',
            'is_hidden' => 'sometimes|required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $product->update($request->only([
                'quantity',
                'purchase_price',
                'selling_price',
                'low_stock_threshold',
                'category',
                'is_hidden'
            ]));

            $product->refresh();

            if ($product->quantity < $product->low_stock_threshold) {
                Product::sendLowStockEmail($product);
            }

            return response()->json([
                'success' => true,
                'message' => 'Product updated successfully',
                'data' => $product,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update product',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/products/low-stock
     */
    public function lowStock()
    {
        try {
            $products = Product::with('creditVendor')
                ->whereColumn('quantity', '<', 'low_stock_threshold')
                ->where('is_hidden', 0)
                ->orderBy('quantity', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $products->map(function ($product) {
                    return [
                        'id' => $product->id,
                        'name' => $product->name,
                        'category' => $product->category,
                        'quantity' => (int) $product->quantity,
                        'low_stock_threshold' => (int) $product->low_stock_threshold,
                        'purchase_price' => (float) $product->purchase_price,
                        'selling_price' => (float) $product->selling_price,
                        'vendor_name' => $product->vendor_name,
                        'is_credit_purchase' => (bool) $product->is_credit_purchase,
                        'is_hidden' => (bool) $product->is_hidden,
                    ];
                }),
                'count' => $products->count(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch low stock products',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/products/vendor/{vendorId}
     */
    public function getByVendor($vendorId)
    {
        try {
            $vendor = CreditVendor::findOrFail($vendorId);

            $products = Product::where('vendor_id', $vendor->id)->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'vendor' => [
                        'id' => $vendor->id,
                        'name' => $vendor->vendor_name,
                        'invoice_number' => $vendor->invoice_number,
                    ],
                    'products' => $products->map(function ($product) {
                        return [
                            'id' => $product->id,
                            'name' => $product->name,
                            'category' => $product->category,
                            'quantity' => (int) $product->quantity,
                            'purchase_price' => (float) $product->purchase_price,
                            'selling_price' => (float) $product->selling_price,
                            'total_price' => (float) ($product->quantity * $product->purchase_price),
                            'is_hidden' => (bool) $product->is_hidden,
                        ];
                    }),
                    'total_products' => $products->count(),
                    'total_quantity' => $products->sum('quantity'),
                    'total_amount' => $products->sum(function ($p) {
                        return $p->quantity * $p->purchase_price;
                    }),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch vendor products',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Category ke hisaab se products
     */
    public function getByCategory($category)
    {
        try {
            $products = Product::with('creditVendor')
                ->where('category', $category)
                ->where('is_hidden', 0)
                ->orderBy('name', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $products->map(function ($product) {
                    return [
                        'id' => $product->id,
                        'name' => $product->name,
                        'category' => $product->category,
                        'quantity' => (int) $product->quantity,
                        'purchase_price' => (float) $product->purchase_price,
                        'selling_price' => (float) $product->selling_price,
                        'vendor_name' => $product->vendor_name,
                    ];
                }),
                'count' => $products->count(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch products by category',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Saari unique categories
     */
    public function getCategories()
    {
        try {
            $categories = Product::where('is_hidden', 0)
                ->whereNotNull('category')
                ->distinct()
                ->pluck('category');

            return response()->json([
                'success' => true,
                'data' => $categories,
                'count' => $categories->count(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch categories',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}