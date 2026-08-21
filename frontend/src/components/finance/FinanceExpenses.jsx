// src/components/finance/FinanceExpenses.jsx

import React, { useState, useEffect, useCallback } from 'react';
import ExpensesRecord from './ExpensesRecord';
import EmployeeSalary from './EmployeeSalary';
import { FiLoader, FiPackage, FiUsers } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const FinanceExpenses = ({ darkMode }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('expenses');

  // Fetch expenses from API
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/expenses');
      if (response.data && Array.isArray(response.data)) {
        setExpenses(response.data);
      } else {
        setExpenses([]);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Failed to load expenses. Please check your connection.');
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  // Add new expense
  const handleAddExpense = useCallback(async (expenseData) => {
    try {
      const response = await api.post('/expenses', {
        description: expenseData.description,
        amount: expenseData.amount,
        date: expenseData.date,
        category: expenseData.category,
        isRecurring: expenseData.isRecurring || false,
        recurringType: expenseData.recurringType || 'monthly',
        lastPaidDate: expenseData.lastPaidDate || null,
        nextPaymentDate: expenseData.nextPaymentDate || null
      });
      
      if (response.data) {
        toast.success('Expense added successfully!');
        await fetchExpenses();
        return true;
      }
    } catch (err) {
      console.error('Error adding expense:', err);
      toast.error(err.response?.data?.message || 'Failed to add expense');
      return false;
    }
  }, [fetchExpenses]);

  // Update existing expense
  const handleUpdateExpense = useCallback(async (updatedExpense) => {
    try {
      const response = await api.put(`/expenses/${updatedExpense.id}`, {
        description: updatedExpense.description,
        amount: updatedExpense.amount,
        date: updatedExpense.date,
        category: updatedExpense.category,
        isRecurring: updatedExpense.isRecurring || false,
        recurringType: updatedExpense.recurringType || 'monthly',
        lastPaidDate: updatedExpense.lastPaidDate || null,
        nextPaymentDate: updatedExpense.nextPaymentDate || null
      });
      
      if (response.data) {
        toast.success('Expense updated successfully!');
        await fetchExpenses();
        return true;
      }
    } catch (err) {
      console.error('Error updating expense:', err);
      toast.error(err.response?.data?.message || 'Failed to update expense');
      return false;
    }
  }, [fetchExpenses]);

  // Load data on component mount
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  if (loading) {
    return (
      <div className={`min-h-[400px] flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-5xl text-amber-400 animate-spin mx-auto mb-4" />
          <p className={`${darkMode ? 'text-white' : 'text-gray-700'}`}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs - Amber Theme */}
      <div className={`flex gap-1.5 p-1 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'expenses'
              ? 'bg-amber-400 text-gray-900 shadow-md'
              : darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
          }`}
        >
          <FiPackage className="text-base" />
          Other Expenses
        </button>
        <button
          onClick={() => setActiveTab('salaries')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'salaries'
              ? 'bg-amber-400 text-gray-900 shadow-md'
              : darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
          }`}
        >
          <FiUsers className="text-base" />
          Employee Salaries
        </button>
      </div>

      {/* Content */}
      {activeTab === 'expenses' ? (
        <ExpensesRecord 
          expenses={expenses} 
          onAddExpense={handleAddExpense} 
          onUpdateExpense={handleUpdateExpense} 
          darkMode={darkMode} 
          refreshExpenses={fetchExpenses}
        />
      ) : (
        <EmployeeSalary 
          darkMode={darkMode}
        />
      )}
      
      {error && (
        <div className={`p-4 rounded-xl text-center border ${darkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm font-bold ${darkMode ? 'text-red-400' : 'text-red-700'}`}>⚠️ {error}</p>
          <button 
            onClick={fetchExpenses}
            className="mt-2 px-4 py-1.5 bg-amber-400 text-gray-900 rounded-lg text-sm font-bold hover:bg-amber-300 transition"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default FinanceExpenses;