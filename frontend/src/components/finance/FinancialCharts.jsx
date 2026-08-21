// src/components/finance/FinancialCharts.jsx

import React, { useState } from 'react';
import { FiBarChart2, FiTrendingUp, FiChevronDown, FiChevronUp, FiCalendar, FiGrid } from 'react-icons/fi';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const FinancialCharts = ({ monthlyData, selectedYear, setSelectedYear, compareYear, setCompareYear, chartType, setChartType, darkMode }) => {
  const [showCharts, setShowCharts] = useState(true);

  const compareData = compareYear ? monthlyData.map((m, i) => ({
    month: m.month,
    current: m.expenses,
    previous: null
  })) : [];

  // Custom chart colors for Amber/Golden theme
  const chartColors = {
    expenses: '#3b82f6', // Blue
    revenue: '#fbbf24', // Amber/Golden
    profit: '#22c55e' // Green
  };

  return (
    <div className={`rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
      <button
        onClick={() => setShowCharts(!showCharts)}
        className={`w-full px-4 py-3 flex justify-between items-center ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition rounded-xl`}
      >
        <div className="flex items-center gap-2">
          <FiBarChart2 className={`text-lg ${darkMode ? 'text-amber-400' : 'text-amber-500'}`} />
          <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Financial Charts & Analytics</h3>
        </div>
        {showCharts ? <FiChevronUp className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} /> : <FiChevronDown className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />}
      </button>
      
      {showCharts && (
        <div className={`p-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
            <div className="flex gap-1.5">
              <button 
                onClick={() => setChartType('line')} 
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  chartType === 'line' 
                    ? 'bg-amber-400 text-gray-900 shadow-md' 
                    : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FiTrendingUp className="text-xs" /> Line
              </button>
              <button 
                onClick={() => setChartType('bar')} 
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  chartType === 'bar' 
                    ? 'bg-amber-400 text-gray-900 shadow-md' 
                    : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FiBarChart2 className="text-xs" /> Bar
              </button>
              <button 
                onClick={() => setChartType('area')} 
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  chartType === 'area' 
                    ? 'bg-amber-400 text-gray-900 shadow-md' 
                    : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FiGrid className="text-xs" /> Area
              </button>
              <button 
                onClick={() => setChartType('composed')} 
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  chartType === 'composed' 
                    ? 'bg-amber-400 text-gray-900 shadow-md' 
                    : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FiBarChart2 className="text-xs" /> Composed
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5">
                <FiCalendar className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))} 
                  className={`text-xs px-2 py-1 rounded-lg border focus:ring-2 focus:ring-amber-400 focus:outline-none ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {[2022, 2023, 2024, 2025, 2026].map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <select 
                value={compareYear || ''} 
                onChange={(e) => setCompareYear(e.target.value ? parseInt(e.target.value) : null)} 
                className={`text-xs px-2 py-1 rounded-lg border focus:ring-2 focus:ring-amber-400 focus:outline-none ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">No Comparison</option>
                {[2022, 2023, 2024, 2025, 2026].filter(y => y !== selectedYear).map(year => <option key={year} value={year}>Compare {year}</option>)}
              </select>
            </div>
          </div>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                  <CartesianGrid stroke={darkMode ? '#374151' : '#e5e7eb'} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <YAxis stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#111827' : '#ffffff', 
                      border: darkMode ? '1px solid #1f2937' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }} 
                    formatter={(value) => [`Rs. ${value.toLocaleString()}`, '']}
                  />
                  <Legend 
                    wrapperStyle={{ color: darkMode ? '#d1d5db' : '#374151', fontSize: '11px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Line type="monotone" dataKey="expenses" stroke={chartColors.expenses} name="Expenses" strokeWidth={2.5} dot={{ r: 3, fill: chartColors.expenses }} />
                  <Line type="monotone" dataKey="revenue" stroke={chartColors.revenue} name="Revenue" strokeWidth={2.5} dot={{ r: 3, fill: chartColors.revenue }} />
                  <Line type="monotone" dataKey="profit" stroke={chartColors.profit} name="Profit" strokeWidth={2.5} dot={{ r: 3, fill: chartColors.profit }} />
                </LineChart>
              ) : chartType === 'bar' ? (
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                  <CartesianGrid stroke={darkMode ? '#374151' : '#e5e7eb'} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <YAxis stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#111827' : '#ffffff', 
                      border: darkMode ? '1px solid #1f2937' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                    formatter={(value) => [`Rs. ${value.toLocaleString()}`, '']}
                  />
                  <Legend 
                    wrapperStyle={{ color: darkMode ? '#d1d5db' : '#374151', fontSize: '11px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="expenses" fill={chartColors.expenses} name="Expenses" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="revenue" fill={chartColors.revenue} name="Revenue" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="profit" fill={chartColors.profit} name="Profit" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : chartType === 'area' ? (
                <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                  <CartesianGrid stroke={darkMode ? '#374151' : '#e5e7eb'} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <YAxis stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#111827' : '#ffffff', 
                      border: darkMode ? '1px solid #1f2937' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                    formatter={(value) => [`Rs. ${value.toLocaleString()}`, '']}
                  />
                  <Legend 
                    wrapperStyle={{ color: darkMode ? '#d1d5db' : '#374151', fontSize: '11px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Area type="monotone" dataKey="expenses" stackId="1" stroke={chartColors.expenses} fill={chartColors.expenses} fillOpacity={0.25} name="Expenses" />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke={chartColors.revenue} fill={chartColors.revenue} fillOpacity={0.25} name="Revenue" />
                  <Area type="monotone" dataKey="profit" stackId="1" stroke={chartColors.profit} fill={chartColors.profit} fillOpacity={0.25} name="Profit" />
                </AreaChart>
              ) : (
                <ComposedChart data={monthlyData} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                  <CartesianGrid stroke={darkMode ? '#374151' : '#e5e7eb'} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <YAxis stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#111827' : '#ffffff', 
                      border: darkMode ? '1px solid #1f2937' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                    formatter={(value) => [`Rs. ${value.toLocaleString()}`, '']}
                  />
                  <Legend 
                    wrapperStyle={{ color: darkMode ? '#d1d5db' : '#374151', fontSize: '11px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="expenses" barSize={16} fill={chartColors.expenses} name="Expenses" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="revenue" stroke={chartColors.revenue} name="Revenue" strokeWidth={2.5} dot={{ r: 3, fill: chartColors.revenue }} />
                  <Line type="monotone" dataKey="profit" stroke={chartColors.profit} name="Profit" strokeWidth={2.5} dot={{ r: 3, fill: chartColors.profit }} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
          
          {/* Chart Summary Footer */}
          <div className={`mt-3 pt-2 border-t flex flex-wrap justify-between gap-2 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3 text-xs">
              <span className={`flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                Revenue
              </span>
              <span className={`flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                Expenses
              </span>
              <span className={`flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                Profit
              </span>
            </div>
            <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              {monthlyData.filter(m => m.revenue > 0 || m.expenses > 0).length} months with data
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialCharts;