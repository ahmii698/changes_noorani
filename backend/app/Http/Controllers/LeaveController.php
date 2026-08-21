<?php
// app/Http/Controllers/LeaveController.php
// (namespace apne project ke hisaab se rakho — jo bhi tumne route file me import kiya hai)

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\EmployeeLeave;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class LeaveController extends Controller
{
    public function sendResponse($data, $message = 'Success', $code = 200)
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data
        ], $code);
    }

    public function sendError($message, $code = 400, $errors = null)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $errors
        ], $code);
    }

    // ============================================
    // GET /api/leaves
    // ============================================
    public function index(Request $request)
    {
        try {
            // ✅ branch_id hata diya, sirf id, name, role select ho raha hai
            // ✅ ab sabse recently ADD hui leave sabse upar aayegi (leave_date se nahi)
            $query = EmployeeLeave::with('employee:id,name,role')
                ->orderBy('id', 'desc');

            if ($request->filled('user_id')) {
                $query->where('user_id', $request->user_id);
            }

            // ✅ branch_id wala filter block poora hata diya (users table me column hi nahi)

            $leaves = $query->get();

            return $this->sendResponse($leaves, 'Leaves retrieved successfully');
        } catch (\Exception $e) {
            Log::error('Leave index error: ' . $e->getMessage());
            return $this->sendError($e->getMessage(), 500);
        }
    }

    // ============================================
    // POST /api/leaves
    // ============================================
    public function store(Request $request)
    {
        try {
            Log::info('Leave store request:', $request->all());

            $validator = Validator::make($request->all(), [
                'user_id'    => 'required|exists:users,id',
                'leave_date' => 'required|date',
                'reason'     => 'required|string|max:500',
            ]);

            if ($validator->fails()) {
                Log::error('Validation failed:', $validator->errors()->toArray());
                return $this->sendError('Validation error', 422, $validator->errors());
            }

            $date = Carbon::parse($request->leave_date);

            if (!class_exists('App\Models\EmployeeLeave')) {
                Log::error('EmployeeLeave model not found!');
                return $this->sendError('Model not found', 500);
            }

            $leave = EmployeeLeave::create([
                'user_id'    => $request->user_id,
                'leave_date' => $date->format('Y-m-d'),
                'month'      => $date->format('Y-m'),
                'year'       => $date->format('Y'),
                'reason'     => $request->reason,
                'status'     => 'approved',
            ]);

            Log::info('Leave created successfully:', $leave->toArray());

            return $this->sendResponse($leave, 'Leave recorded successfully', 201);

        } catch (\Illuminate\Database\QueryException $e) {
            Log::error('Database error: ' . $e->getMessage());
            return $this->sendError('Database error: ' . $e->getMessage(), 500);
        } catch (\Exception $e) {
            Log::error('Leave store error: ' . $e->getMessage());
            Log::error('File: ' . $e->getFile() . ' Line: ' . $e->getLine());
            return $this->sendError($e->getMessage(), 500);
        }
    }

    // ============================================
    // DELETE /api/leaves/{id}
    // ============================================
    public function destroy($id)
    {
        try {
            $leave = EmployeeLeave::find($id);
            if (!$leave) {
                return $this->sendError('Leave record not found', 404);
            }

            $leave->delete();

            return $this->sendResponse(null, 'Leave record deleted successfully');
        } catch (\Exception $e) {
            Log::error('Leave delete error: ' . $e->getMessage());
            return $this->sendError($e->getMessage(), 500);
        }
    }
}