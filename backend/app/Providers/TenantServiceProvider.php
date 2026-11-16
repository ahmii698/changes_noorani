<?php

namespace App\Providers;

use App\Models\Scopes\CompanyScope;
use Illuminate\Support\ServiceProvider;

class TenantServiceProvider extends ServiceProvider
{
    private const MODELS = [
        \App\Models\Product::class,
        \App\Models\Invoice::class,
        \App\Models\InvoiceItem::class,
        \App\Models\PaymentHistory::class,
        \App\Models\Service::class,
        \App\Models\Expense::class,
        \App\Models\Customer::class,
        \App\Models\Employee::class,
        \App\Models\EmployeePayment::class,
        \App\Models\EmployeeLeave::class,
        \App\Models\EmployeeLoanTransaction::class,
        \App\Models\EmployeeMonthlyRecord::class,
        \App\Models\CreditVendor::class,
        \App\Models\CreditPayment::class,
        \App\Models\CreditProductLink::class,
        \App\Models\Estimate::class,
        \App\Models\EstimateItem::class,
        \App\Models\SavedCart::class,
        \App\Models\Reminder::class,
        \App\Models\ReminderMessage::class,
        \App\Models\ServiceReminder::class,
        \App\Models\BirthdayReminder::class,
        \App\Models\BirthdayReminderSetting::class,
    ];

    public function boot(): void
    {
        foreach (self::MODELS as $class) {
            if (!class_exists($class)) {
                continue;
            }

            // read: sirf apni company ka data
            $class::addGlobalScope(new CompanyScope());

            // create: company_id apne aap lag jaye
            $class::creating(function ($model) {
                if (empty($model->company_id)) {
                    $companyId = CompanyScope::currentCompanyId();
                    if ($companyId) {
                        $model->company_id = $companyId;
                    }
                }
            });
        }
    }
}