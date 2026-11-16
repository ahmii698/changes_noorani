<?php

namespace App\Http\Controllers;

use App\Models\Trial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SuperAdminTrialController extends Controller
{
    /**
     * GET /api/super-admin/trials
     * Sirf wo trials jo abhi "trial" status mein hain (expired bhi, taake super admin dekh sake).
     */
    public function index()
    {
        $data = Trial::where('status', 'trial')
            ->orderByDesc('id')
            ->get()
            ->map->toApi()
            ->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * POST /api/super-admin/trials/{id}/extend   body: { days }
     * Trial ke total din barha deta hai.
     */
    public function extend(Request $request, $id)
    {
        $v = $request->validate([
            'days' => 'required|integer|min:1|max:365',
        ]);

        $trial = Trial::where('status', 'trial')->findOrFail($id);
        $trial->days = $trial->days + $v['days'];
        $trial->save();

        // Agar pehle trial khatam hone par company block hui thi, to wapis khol do
        $this->setCompanyBlocked($trial, false);

        return response()->json(['success' => true, 'data' => $trial->toApi()]);
    }

    /**
     * POST /api/super-admin/trials/{id}/convert
     * Trial -> regular monthly client. Trial list se nikal jata hai.
     */
    public function convert($id)
    {
        $trial = Trial::where('status', 'trial')->findOrFail($id);
        $trial->status = 'converted';
        $trial->save();

        $this->setCompanyBlocked($trial, false);

        return response()->json(['success' => true, 'message' => 'Converted to client']);
    }

    /**
     * DELETE /api/super-admin/trials/{id}
     * Trial list se hatata hai aur company ka access block kar deta hai.
     */
    public function destroy($id)
    {
        $trial = Trial::findOrFail($id);

        $this->setCompanyBlocked($trial, true);
        $trial->delete();

        return response()->json(['success' => true, 'message' => 'Trial removed']);
    }

    /**
     * companies table mein block/unblock (sirf agar company_id set hai aur column maujood hai).
     * NOTE: column ka naam apne companies table ke hisaab se check kar lena (is_blocked).
     */
    private function setCompanyBlocked(Trial $trial, bool $blocked): void
    {
        if (!$trial->company_id) {
            return;
        }
        if (!Schema::hasTable('companies') || !Schema::hasColumn('companies', 'is_blocked')) {
            return;
        }

        DB::table('companies')
            ->where('id', $trial->company_id)
            ->update(['is_blocked' => $blocked ? 1 : 0]);
    }
}