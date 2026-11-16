<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SuperAdminCompanyController extends Controller
{
    /** Nayi company ki default monthly fee (agar form se na aaye) */
    private const DEFAULT_MONTHLY_FEE = 7000;

    /**
     * GET /api/super-admin/companies
     * Har company + uska pehla (admin) user.
     */
    public function index()
    {
        $hasUserPhone = Schema::hasColumn('users', 'phone');
        $hasCompanyPhone = Schema::hasColumn('companies', 'phone');

        $phoneSelect = $hasUserPhone
            ? ($hasCompanyPhone ? 'COALESCE(u.phone, c.phone)' : 'u.phone')
            : ($hasCompanyPhone ? 'c.phone' : "''");

        $rows = DB::table('companies as c')
            ->leftJoin('users as u', function ($join) {
                $join->on('u.company_id', '=', 'c.id')
                     ->whereRaw('u.id = (SELECT MIN(id) FROM users WHERE company_id = c.id)');
            })
            ->selectRaw("
                c.id,
                c.name,
                u.name  AS admin_name,
                u.email AS email,
                {$phoneSelect} AS phone,
                c.created_at
            ")
            ->orderByDesc('c.id')
            ->get();

        return response()->json(['success' => true, 'data' => $rows]);
    }

    /**
     * POST /api/super-admin/companies
     * Company + uska admin user banata hai.
     * Saath mein gym_companies mein usi id se row banata hai (subscription / block check yahin se hota hai).
     * trial_days aaye to trials table mein entry bhi.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'company_name' => 'required|string|max:255',
            'name'         => 'required|string|max:255',
            'email'        => 'required|email|max:255|unique:users,email',
            'phone'        => ['required', 'string', 'max:20', 'regex:/^[0-9+\-\s]{7,20}$/'],
            'password'     => 'required|string|min:8|confirmed',
            'trial_days'   => 'nullable|integer|min:1|max:365',
            'monthly_fee'  => 'nullable|numeric|min:0',
        ]);

        $companyId = DB::transaction(function () use ($data) {
            $now = now();

            // ---- 1) Company ----
            $company = $this->onlyExisting('companies', [
                'uuid'       => (string) Str::uuid(),
                'name'       => $data['company_name'],
                'legal_name' => $data['company_name'],
                'slug'       => $this->uniqueSlug($data['company_name']),
                'email'      => $data['email'],
                'phone'      => $data['phone'],
                'timezone'   => 'Asia/Karachi',
                'status'     => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $companyId = DB::table('companies')->insertGetId($company);

            // ---- 2) Admin user ----
            $user = $this->onlyExisting('users', [
                'company_id' => $companyId,
                'name'       => $data['name'],
                'email'      => $data['email'],
                'phone'      => $data['phone'],
                'password'   => Hash::make($data['password']),
                'role'       => 'admin',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('users')->insert($user);

            // ---- 3) gym_companies (subscription + block check isi table se hota hai) ----
            // companies.id aur gym_companies.id BARABAR rakhi hai taake users.company_id dono jagah kaam kare
            if (Schema::hasTable('gym_companies')) {
                $gym = $this->onlyExisting('gym_companies', [
                    'id'          => $companyId,
                    'name'        => $data['company_name'],
                    'phone'       => $data['phone'],
                    'email'       => $data['email'],
                    'plan'        => 'Monthly',
                    'monthly_fee' => $data['monthly_fee'] ?? self::DEFAULT_MONTHLY_FEE,
                    'is_blocked'  => 0,
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ]);

                // Agar is id ki row pehle se ho to dobara insert nahi hogi (error se bachne ke liye)
                if (!DB::table('gym_companies')->where('id', $companyId)->exists()) {
                    DB::table('gym_companies')->insert($gym);
                }
            }

            // ---- 4) Free trial (optional) ----
            if (!empty($data['trial_days'])) {
                DB::table('trials')->insert([
                    'company_id' => $companyId,
                    'name'       => $data['company_name'],
                    'phone'      => $data['phone'],
                    'start_date' => $now->toDateString(),
                    'days'       => (int) $data['trial_days'],
                    'status'     => 'trial',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            return $companyId;
        });

        return response()->json([
            'success'    => true,
            'message'    => 'Company created',
            'company_id' => $companyId,
        ], 201);
    }

    /**
     * Company name se unique slug banata hai (noorani-car-ac, noorani-car-ac-2, ...).
     */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'company';

        if (!Schema::hasColumn('companies', 'slug')) {
            return $base;
        }

        $slug = $base;
        $i = 2;
        while (DB::table('companies')->where('slug', $slug)->exists()) {
            $slug = $base . '-' . $i++;
        }

        return $slug;
    }

    /**
     * Sirf wo columns rakhta hai jo table mein sach mein maujood hain.
     * (Isse tumhare table ka structure thoda alag ho tab bhi insert nahi phatta.)
     */
    private function onlyExisting(string $table, array $values): array
    {
        $columns = Schema::getColumnListing($table);
        return array_intersect_key($values, array_flip($columns));
    }
}