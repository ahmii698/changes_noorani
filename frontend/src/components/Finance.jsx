// src/components/finance/ExpenseDistribution.jsx

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { FiPieChart } from 'react-icons/fi';

const COLORS = ['#fbbf24', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f97316'];

const ExpenseDistribution = ({ categoryData, typeData, darkMode }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={`rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <FiPieChart className="text-amber-400" />
          <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            Expense by Category
          </h3>
        </div>
        <div className="p-4 h-64">
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No data available
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `Rs. ${value.toLocaleString()}`}
                  contentStyle={{ 
                    backgroundColor: darkMode ? '#111827' : '#ffffff',
                    border: darkMode ? '1px solid #1f2937' : '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="px-4 py-2 border-t flex flex-wrap gap-2">
          {categoryData.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{item.name}</span>
              <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>Rs. {item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <FiPieChart className="text-amber-400" />
          <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            Expense by Type
          </h3>
        </div>
        <div className="p-4 h-64">
          {typeData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No data available
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `Rs. ${value.toLocaleString()}`}
                  contentStyle={{ 
                    backgroundColor: darkMode ? '#111827' : '#ffffff',
                    border: darkMode ? '1px solid #1f2937' : '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="px-4 py-2 border-t flex flex-wrap gap-2">
          {typeData.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }}></span>
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{item.name}</span>
              <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>Rs. {item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExpenseDistribution;