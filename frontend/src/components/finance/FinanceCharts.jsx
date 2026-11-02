import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FinancialCharts from './FinancialCharts';
import { FiLoader, FiRefreshCw, FiFileText, FiDownload } from 'react-icons/fi';
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

// Same as the dashboard: only Salary is counted together with regular expenses.
// Inventory (Cash) and Vendor Payment expenses are NOT counted.
const fetchSalaryExpenses = async () => {
  const employeesRes = await api.get('/employees').catch(() => null);

  const employeesList = parseListResponse(employeesRes);
  return employeesList.flatMap(emp =>
    (emp.payments || []).map(p => ({
      id: `salary-${p.id}`,
      amount: parseFloat(p.amount) || 0,
      date: p.payment_date || p.created_at,
      description: `Salary - ${emp.name}`,
      category: 'Salary'
    }))
  );
};

const getExpenseDate = (exp) => exp.expense_date || exp.date || exp.created_at;

const formatMoney = (value) => `Rs. ${(Number(value) || 0).toLocaleString()}`;

const FinanceCharts = ({ darkMode }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [compareYear, setCompareYear] = useState(null);
  const [chartType, setChartType] = useState('line');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [inventoryStats, setInventoryStats] = useState({
    totalPurchase: 0,
    totalSelling: 0,
    totalProfit: 0
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyOverview, setYearlyOverview] = useState({
    totalSales: 0,
    totalExpenses: 0,
    totalProfit: 0,
    totalNetProfit: 0
  });

  const calculateInventoryStats = useCallback((productsList) => {
    const stats = productsList.reduce((acc, product) => {
      const qty = parseInt(product.quantity) || 0;
      const purchase = parseFloat(product.purchase_price) || 0;
      const selling = parseFloat(product.selling_price) || 0;
      acc.totalPurchase += purchase * qty;
      acc.totalSelling += selling * qty;
      acc.totalProfit += (selling - purchase) * qty;
      return acc;
    }, { totalPurchase: 0, totalSelling: 0, totalProfit: 0 });
    setInventoryStats(stats);
  }, []);

  const calculateMonthlyData = useCallback((year, productsList, expensesList, invoicesList) => {
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const productsMap = new Map();
    productsList.forEach(p => productsMap.set(p.name, p));

    for (let i = 0; i < 12; i++) {
      const monthInvoices = invoicesList.filter(inv => {
        if (!inv.invoice_date) return false;
        const d = new Date(inv.invoice_date);
        return d.getMonth() === i && d.getFullYear() === year;
      });

      let monthSales = 0;
      let monthProfit = 0;
      let monthDiscount = 0;
      let monthItemsSold = 0;

      monthInvoices.forEach(inv => {
        const invDiscount = parseFloat(inv.discount) || 0;
        // Sales = gross amount (before discount), same as Dashboard / Finance Overview
        monthSales += (parseFloat(inv.total_amount) || 0) + invDiscount;
        monthDiscount += invDiscount;

        (inv.items || []).forEach(item => {
          const qty = parseInt(item.quantity) || 0;
          const price = parseFloat(item.price) || 0;
          monthItemsSold += qty;
          const product = productsMap.get(item.service_name);
          const purchasePrice = product ? parseFloat(product.purchase_price) || 0 : 0;
          monthProfit += (price - purchasePrice) * qty;
        });

        // Discount is subtracted from profit
        monthProfit -= invDiscount;
      });

      const monthExpenses = expensesList.filter(exp => {
        const raw = getExpenseDate(exp);
        if (!raw) return false;
        const d = new Date(raw);
        return d.getMonth() === i && d.getFullYear() === year;
      });

      const totalExpenses = monthExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

      // Net Profit = Profit - Expenses
      const netProfit = monthProfit - totalExpenses;

      const monthPurchase = productsList
        .filter(p => {
          const raw = p.date_added || p.created_at;
          if (!raw) return false;
          const d = new Date(raw);
          return d.getMonth() === i && d.getFullYear() === year;
        })
        .reduce((sum, p) => sum + ((parseFloat(p.purchase_price) || 0) * (parseInt(p.quantity) || 0)), 0);

      months.push({
        month: monthNames[i],
        monthIndex: i,
        expenses: totalExpenses,
        // The 'revenue' key is used by FinancialCharts and now represents Sales
        revenue: monthSales,
        sales: monthSales,
        // The chart 'profit' line shows net profit
        profit: netProfit,
        salesProfit: monthProfit,
        netProfit,
        discount: monthDiscount,
        purchase: monthPurchase,
        itemsSold: monthItemsSold,
        invoiceCount: monthInvoices.length
      });
    }

    return months;
  }, []);

  const calculateYearlyOverview = useCallback((data) => {
    const totalSales = data.reduce((sum, m) => sum + m.sales, 0);
    const totalExpenses = data.reduce((sum, m) => sum + m.expenses, 0);
    const totalProfit = data.reduce((sum, m) => sum + m.salesProfit, 0);
    // Net Profit = Total Profit - Total Expenses
    const totalNetProfit = totalProfit - totalExpenses;

    setYearlyOverview({
      totalSales,
      totalExpenses,
      totalProfit,
      totalNetProfit
    });
  }, []);

  // isRefresh = true: keeps the page visible and only spins the Refresh button
  const loadChartData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [productsRes, expensesRes, invoicesRes, salaryExpenses] = await Promise.all([
        api.get('/products').catch(() => null),
        api.get('/expenses').catch(() => null),
        api.get('/invoices').catch(() => null),
        fetchSalaryExpenses()
      ]);

      const productsList = parseListResponse(productsRes);
      const regularExpenses = parseListResponse(expensesRes);
      const invoicesList = parseListResponse(invoicesRes);

      // Same as the dashboard: regular expenses + salary only
      const expensesList = [...regularExpenses, ...salaryExpenses];

      setInvoices(invoicesList);
      setExpenses(expensesList);

      calculateInventoryStats(productsList);

      const monthlyChartData = calculateMonthlyData(selectedYear, productsList, expensesList, invoicesList);
      setMonthlyData(monthlyChartData);
      calculateYearlyOverview(monthlyChartData);

      if (isRefresh) toast.success('Data refreshed');
    } catch (err) {
      console.error('Error loading chart data:', err);
      setError('Failed to load chart data. Please try again.');
      toast.error('Failed to load chart data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear, calculateInventoryStats, calculateMonthlyData, calculateYearlyOverview]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  const availableYears = useMemo(() => {
    const years = new Set();

    invoices.forEach(inv => {
      if (inv.invoice_date) years.add(new Date(inv.invoice_date).getFullYear());
    });

    expenses.forEach(exp => {
      const raw = getExpenseDate(exp);
      if (raw) years.add(new Date(raw).getFullYear());
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [invoices, expenses]);

  const handleRefresh = () => {
    if (refreshing || loading) return;
    loadChartData(true);
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary
      const summaryRows = [
        ['Finance Report', selectedYear],
        ['Generated On', new Date().toLocaleString()],
        [],
        ['Metric', 'Amount (Rs.)'],
        ['Total Sales', yearlyOverview.totalSales],
        ['Total Profit', yearlyOverview.totalProfit],
        ['Total Expenses', yearlyOverview.totalExpenses],
        ['Net Profit', yearlyOverview.totalNetProfit],
        [],
        ['Inventory Overview', ''],
        ['Total Purchase Value', inventoryStats.totalPurchase],
        ['Total Selling Value', inventoryStats.totalSelling],
        ['Expected Profit', inventoryStats.totalProfit]
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 26 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Sheet 2: Monthly breakdown
      const monthlyRows = monthlyData.map(m => ({
        Month: m.month,
        'Sales (Rs.)': m.sales,
        'Discount (Rs.)': m.discount,
        'Profit (Rs.)': m.salesProfit,
        'Expenses (Rs.)': m.expenses,
        'Net Profit (Rs.)': m.netProfit,
        'Items Sold': m.itemsSold,
        Invoices: m.invoiceCount
      }));
      monthlyRows.push({
        Month: 'Total',
        'Sales (Rs.)': yearlyOverview.totalSales,
        'Discount (Rs.)': monthlyData.reduce((s, m) => s + m.discount, 0),
        'Profit (Rs.)': yearlyOverview.totalProfit,
        'Expenses (Rs.)': yearlyOverview.totalExpenses,
        'Net Profit (Rs.)': yearlyOverview.totalNetProfit,
        'Items Sold': monthlyData.reduce((s, m) => s + m.itemsSold, 0),
        Invoices: monthlyData.reduce((s, m) => s + m.invoiceCount, 0)
      });
      const monthlySheet = XLSX.utils.json_to_sheet(monthlyRows);
      monthlySheet['!cols'] = [
        { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 10 }
      ];
      XLSX.utils.book_append_sheet(wb, monthlySheet, `Monthly ${selectedYear}`);

      XLSX.writeFile(wb, `Finance_Report_${selectedYear}.xlsx`);
      toast.success('Excel report downloaded');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel report');
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(18);
      doc.text(`Finance Report - ${selectedYear}`, 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth - 40, 40, { align: 'right' });
      doc.setTextColor(0);

      // Summary table
      autoTable(doc, {
        startY: 60,
        head: [['Metric', 'Amount']],
        body: [
          ['Total Sales', formatMoney(yearlyOverview.totalSales)],
          ['Total Profit', formatMoney(yearlyOverview.totalProfit)],
          ['Total Expenses', formatMoney(yearlyOverview.totalExpenses)],
          ['Net Profit', formatMoney(yearlyOverview.totalNetProfit)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 10 },
        tableWidth: 300,
        margin: { left: 40 }
      });

      // Inventory table
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 16,
        head: [['Inventory Overview', 'Amount']],
        body: [
          ['Total Purchase Value', formatMoney(inventoryStats.totalPurchase)],
          ['Total Selling Value', formatMoney(inventoryStats.totalSelling)],
          ['Expected Profit', formatMoney(inventoryStats.totalProfit)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [75, 85, 99] },
        styles: { fontSize: 10 },
        tableWidth: 300,
        margin: { left: 40 }
      });

      // Monthly breakdown table
      const totalDiscount = monthlyData.reduce((s, m) => s + m.discount, 0);
      const totalItems = monthlyData.reduce((s, m) => s + m.itemsSold, 0);
      const totalInvoices = monthlyData.reduce((s, m) => s + m.invoiceCount, 0);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Month', 'Sales', 'Discount', 'Profit', 'Expenses', 'Net Profit', 'Items Sold', 'Invoices']],
        body: monthlyData.map(m => [
          m.month,
          formatMoney(m.sales),
          formatMoney(m.discount),
          formatMoney(m.salesProfit),
          formatMoney(m.expenses),
          formatMoney(m.netProfit),
          m.itemsSold,
          m.invoiceCount
        ]),
        foot: [[
          'Total',
          formatMoney(yearlyOverview.totalSales),
          formatMoney(totalDiscount),
          formatMoney(yearlyOverview.totalProfit),
          formatMoney(yearlyOverview.totalExpenses),
          formatMoney(yearlyOverview.totalNetProfit),
          totalItems,
          totalInvoices
        ]],
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38] },
        footStyles: { fillColor: [31, 41, 55], textColor: 255 },
        styles: { fontSize: 9 },
        margin: { left: 40, right: 40 }
      });

      doc.save(`Finance_Report_${selectedYear}.pdf`);
      toast.success('PDF report downloaded');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF report');
    }
  };

  if (loading) {
    return (
      <div className={`min-h-[400px] flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-5xl text-red-500 animate-spin mx-auto mb-4" />
          <p className={`${darkMode ? 'text-white' : 'text-gray-700'}`}>Loading chart data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-green-300 bg-green-900/60 border border-green-700 hover:bg-green-800/70 transition"
        >
          <FiFileText />
          Excel
        </button>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-300 bg-red-900/60 border border-red-700 hover:bg-red-800/70 transition"
        >
          <FiDownload />
          PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. Total Sales */}
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className="text-sm text-gray-500">Total Sales</p>
          <p className="text-2xl font-bold text-amber-400">Rs. {yearlyOverview.totalSales.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Year {selectedYear}</p>
        </div>

        {/* 2. Total Profit (sales profit, before expenses) */}
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className="text-sm text-gray-500">Total Profit</p>
          <p className={`text-2xl font-bold ${yearlyOverview.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            Rs. {yearlyOverview.totalProfit.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">Sales profit (after discount)</p>
        </div>

        {/* 3. Total Expenses */}
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-2xl font-bold text-blue-500">Rs. {yearlyOverview.totalExpenses.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Year {selectedYear}</p>
        </div>

        {/* 4. Net Profit = Total Profit - Total Expenses */}
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className="text-sm text-gray-500">Net Profit</p>
          <p className={`text-2xl font-bold ${yearlyOverview.totalNetProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            Rs. {yearlyOverview.totalNetProfit.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">Profit - Expenses</p>
        </div>
      </div>

      <FinancialCharts
        monthlyData={monthlyData}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        compareYear={compareYear}
        setCompareYear={setCompareYear}
        chartType={chartType}
        setChartType={setChartType}
        darkMode={darkMode}
        availableYears={availableYears}
        yearlyOverview={yearlyOverview}
        inventoryStats={inventoryStats}
      />

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">⚠️ {error}</p>
          <button
            onClick={() => loadChartData()}
            className="mt-2 px-4 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && monthlyData.every(m => m.revenue === 0 && m.expenses === 0) && (
        <div className="p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            No data available for year {selectedYear}. Please add invoices/sales and expenses first.
          </p>
        </div>
      )}
    </div>
  );
};

export default FinanceCharts;