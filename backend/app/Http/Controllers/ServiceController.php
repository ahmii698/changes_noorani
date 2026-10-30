<?php

namespace App\Http\Controllers;

use App\Models\Service;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Service::orderBy('id', 'desc')->get()]);
    }

    public function show($id)
    {
        return response()->json(['data' => Service::findOrFail($id)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'price'    => 'required|numeric|min:0',
            'category' => 'required|string|max:255',
            'icon'     => 'nullable|string|max:255',
        ]);

        $data['icon'] = $data['icon'] ?? 'tool';

        $service = Service::create($data);

        return response()->json(['data' => $service], 201);
    }

    public function update(Request $request, $id)
    {
        $service = Service::findOrFail($id);

        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'price'    => 'required|numeric|min:0',
            'category' => 'required|string|max:255',
            'icon'     => 'nullable|string|max:255',
        ]);

        $data['icon'] = $data['icon'] ?? 'tool';

        $service->update($data);

        return response()->json(['data' => $service]);
    }

    public function destroy($id)
    {
        Service::findOrFail($id)->delete();

        return response()->json(['message' => 'Service deleted']);
    }
}