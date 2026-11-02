// src/components/finance/FinanceExpenses.jsx

import React, { useState, useEffect, useCallback } from 'react';
import ExpensesRecord from './ExpensesRecord';
import EmployeeSalary from './EmployeeSalary';
import {
  FiLoader, FiPackage, FiUsers,
  FiRefreshCw, FiFileText, FiDownload
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../services/api';
import toast from 'react-hot-toast';

const parseListResponse = (res) => {
  if (res?.data?.success && Array.isArray(res.data.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

const getExpenseDate = (exp) => exp.expense_date || exp.date || exp.created_at;

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB');
};

const formatMoney = (value) => `Rs. ${(Number(value) || 0).toLocaleString()}`;

const FinanceExpenses = ({ darkMode }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('expenses');
  // Changing this key remounts the active tab so it reloads its own data
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch expenses from API
  const fetchExpenses = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await api.get('/expenses');
      setExpenses(parseListResponse(response));
      return true;
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Failed to load expenses. Please check your connection.');
      toast.error('Failed to load expenses');
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        await fetchExpenses(true);
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
        await fetchExpenses(true);
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

  // Refresh only this page's data (no browser reload)
  const handleRefresh = async () => {
    if (refreshing) return;
    const ok = await fetchExpenses(true);
    setRefreshKey(prev => prev + 1);
    if (ok) toast.success('Data refreshed');
  };

  // Build the report data for the active tab
  const buildReport = async () => {
    if (activeTab === 'expenses') {
      const rows = [...expenses]
        .sort((a, b) => new Date(getExpenseDate(b) || 0) - new Date(getExpenseDate(a) || 0))
        .map(exp => ({
          date: formatDate(getExpenseDate(exp)),
          description: exp.description || '-',
          category: exp.category || '-',
          recurring: (exp.isRecurring ?? exp.is_recurring) ? (exp.recurringType || exp.recurring_type || 'monthly') : 'No',
          amount: parseFloat(exp.amount) || 0
        }));

      return {
        title: 'Other Expenses Report',
        sheetName: 'Expenses',
        fileName: 'Expenses_Report',
        head: ['#', 'Date', 'Description', 'Category', 'Recurring', 'Amount'],
        excelRows: rows.map((r, i) => ({
          '#': i + 1,
          Date: r.date,
          Description: r.description,
          Category: r.category,
          Recurring: r.recurring,
          'Amount (Rs.)': r.amount
        })),
        pdfRows: rows.map((r, i) => [i + 1, r.date, r.description, r.category, r.recurring, formatMoney(r.amount)]),
        total: rows.reduce((s, r) => s + r.amount, 0),
        count: rows.length,
        colWidths: [{ wch: 5 }, { wch: 14 }, { wch: 36 }, { wch: 18 }, { wch: 12 }, { wch: 16 }],
        totalLabelKey: 'Description'
      };
    }

    // Salaries tab: employees and their payments
    const employeesRes = await api.get('/employees');
    const employees = parseListResponse(employeesRes);
    const rows = employees
      .flatMap(emp =>
        (emp.payments || []).map(p => ({
          employee: emp.name || '-',
          date: p.payment_date || p.created_at,
          amount: parseFloat(p.amount) || 0
        }))
      )
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map(r => ({ ...r, dateText: formatDate(r.date) }));

    return {
      title: 'Employee Salaries Report',
      sheetName: 'Salaries',
      fileName: 'Salaries_Report',
      head: ['#', 'Employee', 'Payment Date', 'Amount'],
      excelRows: rows.map((r, i) => ({
        '#': i + 1,
        Employee: r.employee,
        'Payment Date': r.dateText,
        'Amount (Rs.)': r.amount
      })),
      pdfRows: rows.map((r, i) => [i + 1, r.employee, r.dateText, formatMoney(r.amount)]),
      total: rows.reduce((s, r) => s + r.amount, 0),
      count: rows.length,
      colWidths: [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 16 }],
      totalLabelKey: 'Payment Date'
    };
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const report = await buildReport();
      if (report.count === 0) {
        toast.error('No data to export');
        return;
      }

      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary
      const summarySheet = XLSX.utils.aoa_to_sheet([
        [report.title],
        ['Generated On', new Date().toLocaleString()],
        [],
        ['Total Records', report.count],
        ['Total Amount (Rs.)', report.total]
      ]);
      summarySheet['!cols'] = [{ wch: 22 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Sheet 2: Details with total row
      const detailRows = [
        ...report.excelRows,
        { [report.totalLabelKey]: 'Total', 'Amount (Rs.)': report.total }
      ];
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);
      detailSheet['!cols'] = report.colWidths;
      XLSX.utils.book_append_sheet(wb, detailSheet, report.sheetName);

      XLSX.writeFile(wb, `${report.fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Excel report downloaded');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel report');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const report = await buildReport();
      if (report.count === 0) {
        toast.error('No data to export');
        return;
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(18);
      doc.text(report.title, 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth - 40, 40, { align: 'right' });
      doc.setTextColor(0);

      doc.setFontSize(11);
      doc.text(`Total Records: ${report.count}`, 40, 62);
      doc.text(`Total Amount: ${formatMoney(report.total)}`, 40, 78);

      const footRow = report.head.map(() => '');
      footRow[report.head.length - 2] = 'Total';
      footRow[report.head.length - 1] = formatMoney(report.total);

      autoTable(doc, {
        startY: 95,
        head: [report.head],
        body: report.pdfRows,
        foot: [footRow],
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11], textColor: 20 },
        footStyles: { fillColor: [31, 41, 55], textColor: 255 },
        styles: { fontSize: 9 },
        margin: { left: 40, right: 40 }
      });

      doc.save(`${report.fileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF report downloaded');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF report');
    } finally {
      setExporting(false);
    }
  };

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
      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-green-300 bg-green-900/60 border border-green-700 hover:bg-green-800/70 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          <FiFileText />
          Excel
        </button>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-300 bg-red-900/60 border border-red-700 hover:bg-red-800/70 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          <FiDownload />
          PDF
        </button>
      </div>

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
          key={`expenses-${refreshKey}`}
          expenses={expenses}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          darkMode={darkMode}
          refreshExpenses={() => fetchExpenses(true)}
        />
      ) : (
        <EmployeeSalary
          key={`salaries-${refreshKey}`}
          darkMode={darkMode}
        />
      )}

      {error && (
        <div className={`p-4 rounded-xl text-center border ${darkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm font-bold ${darkMode ? 'text-red-400' : 'text-red-700'}`}>⚠️ {error}</p>
          <button
            onClick={() => fetchExpenses()}
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