<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReminderController;
use App\Http\Controllers\BirthdayReminderController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\ServiceReminderController;
use App\Http\Controllers\CreditVendorController;
use App\Http\Controllers\CreditPaymentController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\SavedCartController;
use App\Http\Controllers\EstimateController;
use App\Http\Controllers\LeaveController;
use App\Http\Controllers\EmployeeLoanController;
use App\Http\Controllers\CashInHandController;
use App\Http\Controllers\SuperAdminAuthController;
use App\Http\Controllers\SuperAdminPaymentController;
use App\Http\Controllers\SuperAdminTrialController;
use App\Http\Controllers\SuperAdminCompanyController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\PaymentChannelController;
use App\Http\Middleware\EnsureCompanyNotBlocked;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// ==================== PUBLIC ROUTES (sirf login / password reset) ====================

Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// Super admin ka alag login
Route::post('/super-admin/login', [SuperAdminAuthController::class, 'login'])->middleware('throttle:10,1');

// Sanctum login fallback
Route::get('/login', function () {
    return response()->json([
        'success' => false,
        'message' => 'Unauthenticated. Please login first.'
    ], 401);
})->name('login');

// Test Route
Route::get('/test', function () {
    return response()->json([
        'success' => true,
        'message' => 'API is working!',
        'timestamp' => now()->toDateTimeString()
    ]);
});

// ==================== PROTECTED ROUTES (login zaroori, blocked company bahar) ====================

Route::middleware(['auth:sanctum', EnsureCompanyNotBlocked::class])->group(function () {

    // User Authentication
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Company ki subscription + payment proof upload
    Route::get('/subscription', [SubscriptionController::class, 'show']);
    Route::post('/subscription/proofs', [SubscriptionController::class, 'uploadProof']);

    // Amounts page par sirf "Visible" payment channels
    Route::get('/payment-channels', [PaymentChannelController::class, 'visible']);

    // USER MANAGEMENT (Admin only)
    Route::prefix('users')->group(function () {
        Route::get('/', [AuthController::class, 'getUsers']);
        Route::post('/', [AuthController::class, 'createUser']);
        Route::put('/{id}', [AuthController::class, 'updateUser']);
        Route::delete('/{id}', [AuthController::class, 'deleteUser']);
    });

    // Dashboard
    Route::prefix('dashboard')->group(function () {
        Route::get('/stats', [DashboardController::class, 'stats']);
        Route::get('/recent-invoices', [DashboardController::class, 'recentInvoices']);
        Route::get('/low-stock', [DashboardController::class, 'lowStockProducts']);
    });

    // SERVICES
    Route::get('/services', [ServiceController::class, 'index']);
    Route::get('/services/{id}', [ServiceController::class, 'show']);
    Route::post('/services', [ServiceController::class, 'store']);
    Route::put('/services/{id}', [ServiceController::class, 'update']);
    Route::delete('/services/{id}', [ServiceController::class, 'destroy']);

    // PRODUCTS
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/low-stock', [ProductController::class, 'lowStock']);
    Route::get('/products/vendor/{vendorId}', [ProductController::class, 'getByVendor']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::patch('/products/{id}', [ProductController::class, 'patch']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);

    // CUSTOMERS
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::get('/customers/phone/{phone}', [CustomerController::class, 'getByPhone']);
    Route::get('/customers/{id}', [CustomerController::class, 'show']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::put('/customers/{id}', [CustomerController::class, 'update']);
    Route::delete('/customers/{id}', [CustomerController::class, 'destroy']);
    Route::put('/customers/{id}/birthday', [CustomerController::class, 'updateBirthday']);

    // REMINDERS (specific routes {id} se pehle)
    Route::get('/reminders', [ReminderController::class, 'index']);
    Route::get('/reminders/pending', [ReminderController::class, 'getPendingReminders']);
    Route::get('/reminders/due/today', [ReminderController::class, 'getTodayDueReminders']);
    Route::get('/reminders/invoice/{invoiceNo}', [ReminderController::class, 'getByInvoiceNo']);
    Route::post('/reminders/add', [ReminderController::class, 'addReminder']);
    Route::post('/reminders/send-email', [ReminderController::class, 'sendReminderEmail']);
    Route::get('/reminders/{id}', [ReminderController::class, 'show']);
    Route::post('/reminders', [ReminderController::class, 'store']);
    Route::put('/reminders/{id}', [ReminderController::class, 'update']);
    Route::patch('/reminders/{id}/mark-sent', [ReminderController::class, 'markAsSent']);
    Route::delete('/reminders/{id}', [ReminderController::class, 'destroy']);

    // BIRTHDAY REMINDERS
    Route::prefix('birthday-reminders')->group(function () {
        Route::get('/today', [BirthdayReminderController::class, 'getTodayReminders']);
        Route::get('/pending', [BirthdayReminderController::class, 'getPendingReminders']);
        Route::get('/all', [BirthdayReminderController::class, 'index']);
        Route::delete('/{id}', [BirthdayReminderController::class, 'destroy']);
    });

    // SERVICE REMINDERS
    Route::prefix('service-reminders')->group(function () {
        Route::get('/all', [ServiceReminderController::class, 'getAllReminders']);
        Route::get('/customer/{customerId}', [ServiceReminderController::class, 'getCustomerReminders']);
        Route::put('/mark-sent/{id}', [ServiceReminderController::class, 'markAsSent']);
        Route::get('/message/{type}', [ServiceReminderController::class, 'getMessage']);
        Route::post('/message/{type}', [ServiceReminderController::class, 'updateMessage']);
        Route::delete('/{id}', [ServiceReminderController::class, 'destroy']);
    });

    // CREDIT MANAGEMENT
    Route::prefix('credit')->group(function () {
        Route::get('/vendors', [CreditVendorController::class, 'index']);
        Route::get('/vendors/statistics', [CreditVendorController::class, 'statistics']);
        Route::get('/vendors/{id}', [CreditVendorController::class, 'show']);
        Route::get('/vendors/{id}/summary', [CreditVendorController::class, 'summary']);
        Route::post('/vendors', [CreditVendorController::class, 'store']);
        Route::put('/vendors/{id}', [CreditVendorController::class, 'update']);
        Route::delete('/vendors/{id}', [CreditVendorController::class, 'destroy']);

        Route::get('/payments', [CreditPaymentController::class, 'index']);
        Route::get('/payments/statistics', [CreditPaymentController::class, 'statistics']);
        Route::get('/payments/vendor/{vendorId}', [CreditPaymentController::class, 'getVendorPayments']);
        Route::get('/payments/{id}', [CreditPaymentController::class, 'show']);
        Route::post('/payments', [CreditPaymentController::class, 'store']);
        Route::put('/payments/{id}', [CreditPaymentController::class, 'update']);
        Route::delete('/payments/{id}', [CreditPaymentController::class, 'destroy']);
    });

    // EMPLOYEES + SALARY
    Route::prefix('employees')->group(function () {
        Route::get('/', [EmployeeController::class, 'index']);
        Route::get('/{id}', [EmployeeController::class, 'show']);
        Route::get('/{id}/monthly-history', [EmployeeController::class, 'monthlyHistory']);
        Route::get('/{id}/unpaid-months', [EmployeeController::class, 'unpaidMonths']);
        Route::post('/', [EmployeeController::class, 'store']);
        Route::put('/{id}', [EmployeeController::class, 'update']);
        Route::delete('/{id}', [EmployeeController::class, 'destroy']);
    });

    Route::prefix('employee-payments')->group(function () {
        Route::post('/', [EmployeeController::class, 'makePayment']);
        Route::delete('/{id}', [EmployeeController::class, 'deletePayment']);
    });

    // EMPLOYEE LOANS
    Route::prefix('employee-loans')->group(function () {
        Route::get('/summary', [EmployeeLoanController::class, 'summary']);
        Route::get('/employee/{employeeId}', [EmployeeLoanController::class, 'showByEmployee']);
        Route::post('/', [EmployeeLoanController::class, 'store']);
        Route::delete('/{id}', [EmployeeLoanController::class, 'destroy']);
    });

    // ESTIMATES
    Route::prefix('estimates')->group(function () {
        Route::get('/', [EstimateController::class, 'index']);
        Route::get('/stats', [EstimateController::class, 'stats']);
        Route::get('/today', [EstimateController::class, 'getToday']);
        Route::get('/search', [EstimateController::class, 'search']);
        Route::get('/date-range', [EstimateController::class, 'getByDateRange']);
        Route::get('/company/{company}', [EstimateController::class, 'getByCompany']);
        Route::get('/vehicle/{vehicle}', [EstimateController::class, 'getByVehicle']);
        Route::get('/no/{estimateNo}', [EstimateController::class, 'showByNumber']);
        Route::get('/{id}', [EstimateController::class, 'show']);

        Route::post('/', [EstimateController::class, 'store']);
        Route::post('/{id}/duplicate', [EstimateController::class, 'duplicate']);

        Route::put('/{id}', [EstimateController::class, 'update']);
        Route::patch('/{id}/status', [EstimateController::class, 'updateStatus']);

        Route::delete('/{id}', [EstimateController::class, 'destroy']);
    });

    // LEAVES
    Route::prefix('leaves')->group(function () {
        Route::get('/', [LeaveController::class, 'index']);
        Route::post('/', [LeaveController::class, 'store']);
        Route::delete('/{id}', [LeaveController::class, 'destroy']);
    });

    // INVOICES
    Route::prefix('invoices')->group(function () {
        Route::get('/', [InvoiceController::class, 'index']);
        Route::get('/{id}', [InvoiceController::class, 'show']);
        Route::post('/', [InvoiceController::class, 'store']);
        Route::put('/{id}', [InvoiceController::class, 'update']);
        Route::delete('/{id}', [InvoiceController::class, 'destroy']);
    });

    // PENDING PAYMENTS
    Route::prefix('pending-payments')->group(function () {
        Route::get('/', [InvoiceController::class, 'getPendingPayments']);
        Route::put('/{id}', [InvoiceController::class, 'updatePendingPayment']);
    });

    // PAYMENT HISTORY
    Route::prefix('payment-history')->group(function () {
        Route::get('/{invoiceNo}', [InvoiceController::class, 'getPaymentHistory']);
    });

    // EXPENSES
    Route::get('/expenses', [ExpenseController::class, 'index']);
    Route::get('/expenses/{id}', [ExpenseController::class, 'show']);
    Route::post('/expenses', [ExpenseController::class, 'store']);
    Route::put('/expenses/{id}', [ExpenseController::class, 'update']);
    Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);

    // SAVED CARTS / DISCARDED BILLS
    Route::prefix('saved-carts')->group(function () {
        Route::get('/', [SavedCartController::class, 'index']);
        Route::get('/count', [SavedCartController::class, 'count']);
        Route::delete('/clear-all', [SavedCartController::class, 'clearAll']);
        Route::get('/{id}', [SavedCartController::class, 'show']);
        Route::post('/', [SavedCartController::class, 'store']);
        Route::post('/{id}/restore', [SavedCartController::class, 'restore']);
        Route::delete('/{id}', [SavedCartController::class, 'destroy']);
    });

    // CASH IN HAND (Admin only - controller checks role)
    Route::prefix('cash-in-hand')->group(function () {
        Route::get('/', [CashInHandController::class, 'index']);
        Route::post('/', [CashInHandController::class, 'store']);
        Route::delete('/{id}', [CashInHandController::class, 'destroy']);
    });

    Route::get('/sales/stats', function () {
        return response()->json([
            'success' => true,
            'message' => 'Sales stats endpoint'
        ]);
    });
});

// ==================== SUPER ADMIN (alag guard, sirf super_admins table ke token) ====================
Route::middleware('auth:super_admin')->prefix('super-admin')->group(function () {
    Route::post('/logout', [SuperAdminAuthController::class, 'logout']);
    Route::get('/me', [SuperAdminAuthController::class, 'me']);

    // Payments page
    Route::prefix('payments')->group(function () {
        Route::get('/', [SuperAdminPaymentController::class, 'index']);
        Route::post('/proofs/{proofId}/approve', [SuperAdminPaymentController::class, 'approve']);
        Route::post('/proofs/{proofId}/reject', [SuperAdminPaymentController::class, 'reject']);
        Route::get('/companies/{companyId}/members', [SuperAdminPaymentController::class, 'members']);
        Route::get('/companies/{companyId}/history', [SuperAdminPaymentController::class, 'history']);
        Route::put('/companies/{companyId}/fee', [SuperAdminPaymentController::class, 'updateFee']);
        Route::put('/companies/{companyId}/block', [SuperAdminPaymentController::class, 'block']);
    });

    // Money Channels page
    Route::get('/payment-channels', [PaymentChannelController::class, 'index']);
    Route::post('/payment-channels/{type}', [PaymentChannelController::class, 'save'])
        ->whereIn('type', ['jazzcash', 'easypaisa', 'bank']);

    // Trial Users page
    Route::get('/trials', [SuperAdminTrialController::class, 'index']);
    Route::post('/trials/{id}/extend', [SuperAdminTrialController::class, 'extend']);
    Route::post('/trials/{id}/convert', [SuperAdminTrialController::class, 'convert']);
    Route::delete('/trials/{id}', [SuperAdminTrialController::class, 'destroy']);

    // Create Company + Admin page
    Route::get('/companies', [SuperAdminCompanyController::class, 'index']);
    Route::post('/companies', [SuperAdminCompanyController::class, 'store']);
});

// ==================== FALLBACK ROUTE (404): hamesha last mein ====================
Route::fallback(function () {
    return response()->json([
        'success' => false,
        'message' => 'API endpoint not found'
    ], 404);
});