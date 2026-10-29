import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { FiCalendar, FiTrendingUp, FiDollarSign, FiPackage, FiBarChart2, FiChevronDown, FiChevronUp, FiDownload, FiFileText, FiLoader, FiClock, FiTrendingDown, FiChevronLeft, FiChevronRight, FiPercent, FiGift } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';
import api from '../../services/api';

const StatsCards = lazy(() => import('./StatsCards'));
const UpcomingPayments = lazy(() => import('./UpcomingPayments'));

const parseListResponse = (res) => {
  if (res?.data?.success && Array.isArray(res.data.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

// Dashboard ki tarah: normal expenses ke saath sirf Salary count hoti hai.
// Inventory (Cash) aur Vendor Payment expenses mein NAHI ginte.
const fetchSalaryExpenses = async (signal) => {
  const employeesRes = await api.get('/employees', { signal }).catch(() => null);

  const employeesList = parseListResponse(employeesRes);
  return employeesList.flatMap(emp =>
    (emp.payments || []).map(p => ({
      id: `salary-${p.id}`,
      amount: parseFloat(p.amount) || 0,
      date: p.payment_date || p.created_at,
      description: `Salary - ${emp.name}`,
      title: `Salary - ${emp.name}`,
      category: 'Salary'
    }))
  );
};

const getDateRange = (filter, customDate = null) => {
  const now = new Date();
  const start = new Date();

  if (filter === 'custom' && customDate) {
    const date = new Date(customDate);
    start.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  switch (filter) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      const day = now.getDay();
      const diff = (day === 0 ? 6 : day - 1);
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      return null;
  }
  return { start, end: now };
};

const filterInvoicesByDate = (invoices, filter, customDate = null) => {
  if (filter === 'all' || !invoices || invoices.length === 0) return invoices;
  const range = getDateRange(filter, customDate);
  if (!range) return invoices;

  return invoices.filter(inv => {
    if (!inv.invoice_date) return false;
    const invDate = new Date(inv.invoice_date);
    return invDate >= range.start && invDate <= range.end;
  });
};

const filterExpensesByDate = (expenses, filter, customDate = null) => {
  if (filter === 'all' || !expenses || expenses.length === 0) return expenses;
  const range = getDateRange(filter, customDate);
  if (!range) return expenses;

  return expenses.filter(exp => {
    if (!exp.expense_date && !exp.date && !exp.created_at) return false;
    const expDate = new Date(exp.expense_date || exp.date || exp.created_at);
    return expDate >= range.start && expDate <= range.end;
  });
};

const buildInvoiceDetail = (inv, productsMap) => {
  const invDiscount = parseFloat(inv.discount) || 0;
  const invTotal = (parseFloat(inv.total_amount) || 0) + invDiscount;
  let invProfit = 0;
  let itemCount = 0;

  if (inv.items && inv.items.length > 0) {
    inv.items.forEach(item => {
      const itemQty = parseInt(item.quantity) || 0;
      const itemPrice = parseFloat(item.price) || 0;
      itemCount += itemQty;

      let itemProfit = 0;
      let purchasePrice = 0;

      const product = productsMap.get(item.service_name);

      if (product) {
        purchasePrice = parseFloat(product.purchase_price) || 0;
        itemProfit = (itemPrice - purchasePrice) * itemQty;
      } else {
        itemProfit = itemPrice * itemQty;
        purchasePrice = 0;
      }

      invProfit += itemProfit;
      item.purchasePrice = purchasePrice;
      item.isProduct = !!product;
      item.unitProfit = itemQty > 0 ? itemProfit / itemQty : 0;
    });
  }

  invProfit -= invDiscount;

  return {
    invoiceNo: inv.invoice_no,
    customer: inv.customer_name,
    date: inv.invoice_date,
    total: invTotal,
    profit: invProfit,
    discount: invDiscount,
    items: inv.items || [],
    itemCount
  };
};

const summarizeDetails = (details) => details.reduce(
  (acc, d) => ({
    total: acc.total + d.total,
    items: acc.items + d.itemCount,
    profit: acc.profit + d.profit,
    discount: acc.discount + d.discount
  }),
  { total: 0, items: 0, profit: 0, discount: 0 }
);

const InvoiceDetails = React.memo(({ title, data, darkMode, onClose }) => {
  const allItems = useMemo(() => {
    const items = [];
    (data?.details || []).forEach(inv => {
      inv.items.forEach(item => {
        items.push({ ...item, inv });
      });
    });
    return items;
  }, [data?.details]);

  if (!data?.details || data.details.length === 0) {
    return (
      <div className={`mt-4 p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} text-center`}>
        <p className="text-gray-500">No sales data available</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">📋 {title}</h4>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm">
          <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Purchase</th>
              <th className="px-3 py-2 text-right">Sell</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-right">Unit Profit</th>
              <th className="px-3 py-2 text-right">Total Profit</th>
              <th className="px-3 py-2 text-left">Customer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {allItems.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-3 py-2 font-medium">{item.service_name}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${item.isProduct ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {item.isProduct ? 'Product' : 'Service'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {item.purchasePrice > 0 ? `Rs. ${item.purchasePrice.toLocaleString()}` : '-'}
                </td>
                <td className="px-3 py-2 text-right">Rs. {item.price.toLocaleString()}</td>
                <td className="px-3 py-2 text-center font-semibold">{item.quantity}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-500">
                  + Rs. {item.unitProfit.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-green-500">
                  Rs. {(item.unitProfit * item.quantity).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">{item.inv.customer}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
            {data.discount > 0 && (
              <tr>
                <td colSpan="6" className="px-3 py-2 text-right font-bold">Discount:</td>
                <td className="px-3 py-2 text-right font-bold text-purple-400">- Rs. {data.discount.toLocaleString()}</td>
                <td></td>
              </tr>
            )}
            <tr>
              <td colSpan="6" className="px-3 py-2 text-right font-bold">Total:</td>
              <td className="px-3 py-2 text-right font-bold text-green-500">Rs. {data.profit.toLocaleString()}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});

const ExpenseDetails = React.memo(({ title, expenses, darkMode, onClose }) => {
  const totalAmount = useMemo(() =>
    (expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0),
    [expenses]
  );

  if (!expenses || expenses.length === 0) {
    return (
      <div className={`mt-4 p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} text-center`}>
        <p className="text-gray-500">No expense data available</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">📋 {title}</h4>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm">
          <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
            <tr>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {expenses.map((exp, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-3 py-2 font-medium">{exp.description}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    {exp.category || 'General'}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm">{new Date(exp.date || exp.expense_date).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right font-semibold text-red-500">Rs. {exp.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
            <tr>
              <td colSpan="3" className="px-3 py-2 text-right font-bold">Total:</td>
              <td className="px-3 py-2 text-right font-bold text-red-500">Rs. {totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});

const FinanceOverview = ({ darkMode }) => {
  const [timeFilter, setTimeFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showYearlyReport, setShowYearlyReport] = useState(true);
  const [showTodayDetails, setShowTodayDetails] = useState(false);
  const [showWeekDetails, setShowWeekDetails] = useState(false);
  const [showMonthDetails, setShowMonthDetails] = useState(false);
  const [showTodayExpenses, setShowTodayExpenses] = useState(false);
  const [showWeekExpenses, setShowWeekExpenses] = useState(false);
  const [showMonthExpenses, setShowMonthExpenses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAllStats, setShowAllStats] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [filteredSalesData, setFilteredSalesData] = useState({ total: 0, items: 0, count: 0, profit: 0, discount: 0, details: [] });
  const [filteredExpenseData, setFilteredExpenseData] = useState([]);
  const [filteredStats, setFilteredStats] = useState({
    expenses: 0,
    expenseCount: 0,
    salesProfit: 0,
    profit: 0,
    discount: 0
  });

  const [todaySales, setTodaySales] = useState({ total: 0, items: 0, count: 0, profit: 0, discount: 0, details: [] });
  const [weeklySales, setWeeklySales] = useState({ total: 0, items: 0, count: 0, profit: 0, discount: 0, details: [] });
  const [monthlySales, setMonthlySales] = useState({ total: 0, items: 0, count: 0, profit: 0, discount: 0, details: [] });
  const [selectedYearData, setSelectedYearData] = useState({ total: 0, items: 0, count: 0, profit: 0, discount: 0, details: [] });

  const [todayExpenseDetails, setTodayExpenseDetails] = useState([]);
  const [weekExpenseDetails, setWeekExpenseDetails] = useState([]);
  const [monthExpenseDetails, setMonthExpenseDetails] = useState([]);

  const [stats, setStats] = useState({
    todayExpenses: 0,
    todayExpenseCount: 0,
    weekExpenses: 0,
    weekExpenseCount: 0,
    monthExpenses: 0,
    monthExpenseCount: 0,
    todayProfit: 0,
    weekProfit: 0,
    monthProfit: 0,
    todayDiscount: 0,
    weekDiscount: 0,
    monthDiscount: 0
  });

  const getFilterLabel = useCallback(() => {
    const labels = {
      all: 'All Time',
      today: 'Today',
      week: 'This Week',
      month: 'This Month',
      year: 'This Year',
      custom: `Custom: ${customDate || 'Select Date'}`
    };
    return labels[timeFilter] || 'All Time';
  }, [timeFilter, customDate]);

  const handleCustomDateChange = (e) => {
    const date = e.target.value;
    setCustomDate(date);
    if (date) {
      setTimeFilter('custom');
      setShowCustomDate(true);
    }
  };

  const toggleCustomDate = () => {
    setShowCustomDate(!showCustomDate);
  };

  const clearCustomDate = () => {
    setCustomDate('');
    setTimeFilter('all');
    setShowCustomDate(false);
  };

  const getStartOfWeek = useCallback(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, []);

  const getStartOfMonth = useCallback(() => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const calculateFilteredData = useCallback((invoicesList, expensesList, productsMap) => {
    const filteredInvoices = filterInvoicesByDate(invoicesList, timeFilter, customDate || null);
    const filteredExpenses = filterExpensesByDate(expensesList, timeFilter, customDate || null);

    const details = filteredInvoices.map(inv => buildInvoiceDetail(inv, productsMap));
    const summary = summarizeDetails(details);

    let expenseTotal = 0;
    const expenseList = [];
    filteredExpenses.forEach(exp => {
      const amount = parseFloat(exp.amount) || 0;
      expenseTotal += amount;
      expenseList.push({
        id: exp.id,
        description: exp.description || exp.title,
        amount,
        date: exp.expense_date || exp.date || exp.created_at,
        category: exp.category
      });
    });

    return {
      sales: { ...summary, count: details.length, details },
      expenses: expenseList,
      expenseTotal,
      expenseCount: expenseList.length
    };
  }, [timeFilter, customDate]);

  const fetchProducts = useCallback(async (signal) => {
    try {
      const response = await api.get('/products', { signal });
      const list = parseListResponse(response);
      setProducts(list);
      return list;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching products:', err);
      }
      return [];
    }
  }, []);

  const fetchExpenses = useCallback(async (signal) => {
    try {
      const response = await api.get('/expenses', { signal });
      const list = parseListResponse(response);
      setExpenses(list);
      return list;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching expenses:', err);
      }
      return [];
    }
  }, []);

  const fetchInvoices = useCallback(async (signal) => {
    try {
      const response = await api.get('/invoices', { signal });
      const list = parseListResponse(response);
      setInvoices(list);
      return list;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching invoices:', err);
      }
      return [];
    }
  }, []);

  const loadAllData = useCallback(async () => {
    const abortController = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const [productsList, regularExpenses, invoicesList, salaryExpenses] = await Promise.all([
        fetchProducts(abortController.signal),
        fetchExpenses(abortController.signal),
        fetchInvoices(abortController.signal),
        fetchSalaryExpenses(abortController.signal)
      ]);

      // Dashboard ki tarah: sirf normal expenses + salary
      const expensesList = [...regularExpenses, ...salaryExpenses];

      const productsMap = new Map();
      productsList.forEach(p => {
        productsMap.set(p.name, p);
      });

      const filtered = calculateFilteredData(invoicesList, expensesList, productsMap);
      setFilteredSalesData(filtered.sales);
      setFilteredExpenseData(filtered.expenses);
      setFilteredStats({
        expenses: filtered.expenseTotal,
        expenseCount: filtered.expenseCount,
        // Sales ka profit (discount pehle hi minus ho chuka hai)
        salesProfit: filtered.sales.profit,
        // Net profit = sales profit - expenses
        profit: filtered.sales.profit - filtered.expenseTotal,
        discount: filtered.sales.discount
      });

      const todayStr = new Date().toDateString();
      const weekStart = getStartOfWeek();
      const monthStart = getStartOfMonth();

      const todayDetails = [];
      const weekDetails = [];
      const monthDetails = [];

      invoicesList.forEach(inv => {
        if (!inv.invoice_date) return;

        const invDate = new Date(inv.invoice_date);
        const isToday = invDate.toDateString() === todayStr;
        const isThisWeek = invDate >= weekStart;
        const isThisMonth = invDate >= monthStart;

        if (!isToday && !isThisWeek && !isThisMonth) return;

        const detailItem = buildInvoiceDetail(inv, productsMap);

        if (isToday) todayDetails.push(detailItem);
        if (isThisWeek) weekDetails.push(detailItem);
        if (isThisMonth) monthDetails.push(detailItem);
      });

      const todaySummary = summarizeDetails(todayDetails);
      const weekSummary = summarizeDetails(weekDetails);
      const monthSummary = summarizeDetails(monthDetails);

      setTodaySales({ ...todaySummary, count: todayDetails.length, details: todayDetails });
      setWeeklySales({ ...weekSummary, count: weekDetails.length, details: weekDetails });
      setMonthlySales({ ...monthSummary, count: monthDetails.length, details: monthDetails });

      let todayExp = 0, todayExpCount = 0;
      let weekExp = 0, weekExpCount = 0;
      let monthExp = 0, monthExpCount = 0;
      const todayExpList = [];
      const weekExpList = [];
      const monthExpList = [];

      expensesList.forEach(exp => {
        const rawDate = exp.expense_date || exp.date || exp.created_at;
        if (!rawDate) return;
        const expDate = new Date(rawDate);
        const amount = parseFloat(exp.amount) || 0;
        const expenseItem = {
          id: exp.id,
          description: exp.description || exp.title,
          amount,
          date: rawDate,
          category: exp.category
        };

        if (expDate.toDateString() === todayStr) {
          todayExp += amount;
          todayExpCount++;
          todayExpList.push(expenseItem);
        }
        if (expDate >= weekStart) {
          weekExp += amount;
          weekExpCount++;
          weekExpList.push(expenseItem);
        }
        if (expDate >= monthStart) {
          monthExp += amount;
          monthExpCount++;
          monthExpList.push(expenseItem);
        }
      });

      setTodayExpenseDetails(todayExpList);
      setWeekExpenseDetails(weekExpList);
      setMonthExpenseDetails(monthExpList);

      setStats({
        todayExpenses: todayExp,
        todayExpenseCount: todayExpCount,
        weekExpenses: weekExp,
        weekExpenseCount: weekExpCount,
        monthExpenses: monthExp,
        monthExpenseCount: monthExpCount,
        // Net profit = sales profit (discount ke baad) - expenses
        todayProfit: todaySummary.profit - todayExp,
        weekProfit: weekSummary.profit - weekExp,
        monthProfit: monthSummary.profit - monthExp,
        todayDiscount: todaySummary.discount,
        weekDiscount: weekSummary.discount,
        monthDiscount: monthSummary.discount
      });

      const yearInvoices = invoicesList.filter(inv => {
        if (!inv.invoice_date) return false;
        return new Date(inv.invoice_date).getFullYear() === selectedYear;
      });

      const yearlyDetails = yearInvoices.map(inv => buildInvoiceDetail(inv, productsMap));
      const yearlySummary = summarizeDetails(yearlyDetails);

      setSelectedYearData({ ...yearlySummary, count: yearInvoices.length, details: yearlyDetails });
      setCurrentPage(1);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading data:', err);
        setError('Failed to load finance data. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }

    return () => abortController.abort();
  }, [selectedYear, fetchProducts, fetchExpenses, fetchInvoices, getStartOfWeek, getStartOfMonth, calculateFilteredData, timeFilter, customDate]);

  useEffect(() => {
    const cleanup = loadAllData();
    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup();
    };
  }, [loadAllData]);

  const flattenedItems = useMemo(() => {
    const items = [];
    selectedYearData.details.forEach(inv => {
      inv.items.forEach(item => {
        items.push({ ...item, inv });
      });
    });
    return items;
  }, [selectedYearData.details]);

  const totalItems = flattenedItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = useMemo(() =>
    flattenedItems.slice(indexOfFirstItem, indexOfLastItem),
    [flattenedItems, indexOfFirstItem, indexOfLastItem]
  );

  const paginate = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
  }, []);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  const exportToExcel = useCallback(() => {
    if (selectedYearData.details.length === 0) {
      toast.error('No data available for the selected year');
      return;
    }

    const exportData = [];
    selectedYearData.details.forEach(inv => {
      inv.items.forEach(item => {
        exportData.push({
          'Invoice #': inv.invoiceNo,
          'Customer': inv.customer,
          'Date': new Date(inv.date).toLocaleDateString(),
          'Item': item.service_name,
          'Type': item.isProduct ? 'Product' : 'Service',
          'Quantity': item.quantity,
          'Purchase Price': item.purchasePrice > 0 ? `Rs. ${item.purchasePrice.toLocaleString()}` : 'N/A',
          'Selling Price': `Rs. ${item.price.toLocaleString()}`,
          'Unit Profit': `Rs. ${item.unitProfit.toLocaleString()}`,
          'Total Profit': `Rs. ${(item.unitProfit * item.quantity).toLocaleString()}`,
          'Invoice Discount': `Rs. ${inv.discount.toLocaleString()}`
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Year_${selectedYear}_Report`);
    XLSX.writeFile(wb, `Year_${selectedYear}_Sales_Report.xlsx`);
    toast.success(`Exported to Excel for year ${selectedYear}`);
  }, [selectedYearData, selectedYear]);

  const exportToPDF = useCallback(() => {
    if (selectedYearData.details.length === 0) {
      toast.error('No data available for the selected year');
      return;
    }

    const doc = new jsPDF('landscape');
    doc.text(`Sales Report for Year ${selectedYear}`, 14, 10);
    const tableData = [];
    selectedYearData.details.forEach(inv => {
      inv.items.forEach(item => {
        tableData.push([
          inv.invoiceNo,
          inv.customer,
          new Date(inv.date).toLocaleDateString(),
          item.service_name,
          item.isProduct ? 'Product' : 'Service',
          item.quantity,
          item.purchasePrice > 0 ? `Rs. ${item.purchasePrice.toLocaleString()}` : '-',
          `Rs. ${item.price.toLocaleString()}`,
          `Rs. ${item.unitProfit.toLocaleString()}`,
          `Rs. ${(item.unitProfit * item.quantity).toLocaleString()}`
        ]);
      });
    });

    doc.autoTable({
      head: [['Invoice', 'Customer', 'Date', 'Item', 'Type', 'Qty', 'Purchase', 'Sell', 'Unit Profit', 'Total Profit']],
      body: tableData,
      startY: 20,
    });
    doc.save(`Year_${selectedYear}_Sales_Report.pdf`);
    toast.success(`Exported to PDF for year ${selectedYear}`);
  }, [selectedYearData, selectedYear]);

  if (loading) {
    return (
      <div className={`min-h-[400px] flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-5xl text-amber-400 animate-spin mx-auto mb-4" />
          <p className={`${darkMode ? 'text-white' : 'text-gray-700'}`}>Loading finance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      <div className={`flex flex-wrap items-center gap-1.5 p-3 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <span className={`text-xs font-medium mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Filter:</span>
        {[
          { key: 'all', label: 'All Time' },
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'year', label: 'This Year' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => { setTimeFilter(f.key); setShowCustomDate(false); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              timeFilter === f.key
                ? 'bg-amber-400 text-gray-900 shadow-md'
                : darkMode
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={toggleCustomDate}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
            timeFilter === 'custom'
              ? 'bg-amber-400 text-gray-900 shadow-md'
              : darkMode
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FiCalendar className="text-sm" /> Custom
        </button>
        {showCustomDate && (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={customDate}
              onChange={handleCustomDateChange}
              className={`px-2 py-1 rounded-lg text-xs border ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
            />
            {customDate && (
              <button
                onClick={clearCustomDate}
                className="text-red-400 text-xs hover:text-red-300"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <span className={`ml-auto text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Showing: <strong className={darkMode ? 'text-white' : 'text-gray-800'}>{getFilterLabel()}</strong>
        </span>
      </div>

      <div className={`rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <button
          onClick={() => setShowAllStats(!showAllStats)}
          className="w-full px-4 py-3 flex justify-between items-center hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
        >
          <div className="flex items-center gap-2">
            <FiBarChart2 className="text-amber-400 text-lg" />
            <h3 className="text-sm font-semibold">Financial Snapshot</h3>
          </div>
          {showAllStats ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
        </button>

        <div className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Sales */}
            <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-full bg-amber-500/15">
                  <FiDollarSign className="text-sm text-amber-400" />
                </div>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getFilterLabel()} Sales</span>
              </div>
              <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {filteredSalesData.total.toLocaleString()}</p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{filteredSalesData.items} items sold</p>
            </div>

            {/* 2. Profit (sales ka profit, expenses se pehle) */}
            <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-full bg-emerald-500/15">
                  <FiTrendingUp className="text-sm text-emerald-400" />
                </div>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getFilterLabel()} Profit</span>
              </div>
              <p className={`text-lg font-bold ${filteredStats.salesProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Rs. {filteredStats.salesProfit.toLocaleString()}
              </p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Sales profit (after discount)</p>
            </div>

            {/* 3. Expenses */}
            <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-full bg-blue-500/15">
                  <FiTrendingDown className="text-sm text-blue-400" />
                </div>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getFilterLabel()} Expenses</span>
              </div>
              <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {filteredStats.expenses.toLocaleString()}</p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{filteredStats.expenseCount} transactions</p>
            </div>

            {/* 4. Net Profit = Profit - Expenses */}
            <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-full ${filteredStats.profit >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                  <FiTrendingUp className={`text-sm ${filteredStats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getFilterLabel()} Net Profit</span>
              </div>
              <p className={`text-lg font-bold ${filteredStats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Rs. {filteredStats.profit.toLocaleString()}
              </p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Profit - Expenses</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} onClick={() => setShowTodayDetails(!showTodayDetails)}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-full bg-amber-500/15">
                  <FiCalendar className="text-sm text-amber-400" />
                </div>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Today's Sales</span>
              </div>
              <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {todaySales.total.toLocaleString()}</p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{todaySales.items} items sold</p>
              <p className={`text-xs text-emerald-400`}>Profit: Rs. {todaySales.profit.toLocaleString()}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}><FiClock className="text-xs" /> Click for details</p>
            </div>

            <div className={`rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} onClick={() => setShowWeekDetails(!showWeekDetails)}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-full bg-amber-500/15">
                  <FiTrendingUp className="text-sm text-amber-400" />
                </div>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This Week's Sales</span>
              </div>
              <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {weeklySales.total.toLocaleString()}</p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{weeklySales.items} items sold</p>
              <p className={`text-xs text-emerald-400`}>Profit: Rs. {weeklySales.profit.toLocaleString()}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}><FiClock className="text-xs" /> Click for details</p>
            </div>

            <div className={`rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} onClick={() => setShowMonthDetails(!showMonthDetails)}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-full bg-amber-500/15">
                  <FiDollarSign className="text-sm text-amber-400" />
                </div>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This Month's Sales</span>
              </div>
              <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {monthlySales.total.toLocaleString()}</p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{monthlySales.items} items sold</p>
              <p className={`text-xs text-emerald-400`}>Profit: Rs. {monthlySales.profit.toLocaleString()}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}><FiClock className="text-xs" /> Click for details</p>
            </div>
          </div>

          {showTodayDetails && <InvoiceDetails title="Today's Sales" data={todaySales} darkMode={darkMode} onClose={() => setShowTodayDetails(false)} />}
          {showWeekDetails && <InvoiceDetails title="This Week's Sales" data={weeklySales} darkMode={darkMode} onClose={() => setShowWeekDetails(false)} />}
          {showMonthDetails && <InvoiceDetails title="This Month's Sales" data={monthlySales} darkMode={darkMode} onClose={() => setShowMonthDetails(false)} />}

          {showAllStats && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} onClick={() => setShowTodayExpenses(!showTodayExpenses)}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-full bg-blue-500/15">
                      <FiTrendingDown className="text-sm text-blue-400" />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Today's Expenses</span>
                  </div>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {stats.todayExpenses.toLocaleString()}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{stats.todayExpenseCount} transactions</p>
                  <p className={`text-xs mt-1 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}><FiClock className="text-xs" /> Click for details</p>
                </div>

                <div className={`rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} onClick={() => setShowWeekExpenses(!showWeekExpenses)}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-full bg-blue-500/15">
                      <FiTrendingDown className="text-sm text-blue-400" />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This Week's Expenses</span>
                  </div>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {stats.weekExpenses.toLocaleString()}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{stats.weekExpenseCount} transactions</p>
                  <p className={`text-xs mt-1 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}><FiClock className="text-xs" /> Click for details</p>
                </div>

                <div className={`rounded-xl p-4 border cursor-pointer hover:scale-[1.02] transition ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} onClick={() => setShowMonthExpenses(!showMonthExpenses)}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-full bg-blue-500/15">
                      <FiTrendingDown className="text-sm text-blue-400" />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This Month's Expenses</span>
                  </div>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {stats.monthExpenses.toLocaleString()}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{stats.monthExpenseCount} transactions</p>
                  <p className={`text-xs mt-1 flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}><FiClock className="text-xs" /> Click for details</p>
                </div>
              </div>

              {showTodayExpenses && <ExpenseDetails title="Today's Expenses" expenses={todayExpenseDetails} darkMode={darkMode} onClose={() => setShowTodayExpenses(false)} />}
              {showWeekExpenses && <ExpenseDetails title="This Week's Expenses" expenses={weekExpenseDetails} darkMode={darkMode} onClose={() => setShowWeekExpenses(false)} />}
              {showMonthExpenses && <ExpenseDetails title="This Month's Expenses" expenses={monthExpenseDetails} darkMode={darkMode} onClose={() => setShowMonthExpenses(false)} />}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded-full ${stats.todayProfit >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                      <FiTrendingUp className={`text-sm ${stats.todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Today's Net Profit</span>
                  </div>
                  <p className={`text-lg font-bold ${stats.todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Rs. {stats.todayProfit?.toLocaleString() || 0}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Profit - Expenses</p>
                </div>

                <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded-full ${stats.weekProfit >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                      <FiTrendingUp className={`text-sm ${stats.weekProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This Week's Net Profit</span>
                  </div>
                  <p className={`text-lg font-bold ${stats.weekProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Rs. {stats.weekProfit?.toLocaleString() || 0}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Profit - Expenses</p>
                </div>

                <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded-full ${stats.monthProfit >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                      <FiTrendingUp className={`text-sm ${stats.monthProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This Month's Net Profit</span>
                  </div>
                  <p className={`text-lg font-bold ${stats.monthProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Rs. {stats.monthProfit?.toLocaleString() || 0}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Profit - Expenses</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-full bg-purple-500/15">
                      <FiGift className="text-sm text-purple-400" />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Today's Discount</span>
                  </div>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {stats.todayDiscount?.toLocaleString() || 0}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Given today</p>
                </div>

                <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-full bg-purple-500/15">
                      <FiGift className="text-sm text-purple-400" />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This Week's Discount</span>
                  </div>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {stats.weekDiscount?.toLocaleString() || 0}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Given this week</p>
                </div>

                <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-full bg-purple-500/15">
                      <FiGift className="text-sm text-purple-400" />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This Month's Discount</span>
                  </div>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {stats.monthDiscount?.toLocaleString() || 0}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Given this month</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <FiBarChart2 className="text-amber-400" /> Monthly Financial Summary
            <span className={`text-xs font-normal ml-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              ({getFilterLabel()})
            </span>
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4">
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Revenue</p>
            <p className="text-lg font-bold text-amber-400">Rs. {filteredSalesData.total.toLocaleString()}</p>
          </div>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Profit</p>
            <p className={`text-lg font-bold ${filteredStats.salesProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Rs. {filteredStats.salesProfit.toLocaleString()}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Expenses</p>
            <p className="text-lg font-bold text-blue-400">Rs. {filteredStats.expenses.toLocaleString()}</p>
          </div>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Discount</p>
            <p className="text-lg font-bold text-purple-400">Rs. {filteredSalesData.discount.toLocaleString()}</p>
          </div>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Net Profit</p>
            <p className={`text-lg font-bold ${filteredStats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Rs. {filteredStats.profit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className={`rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <button onClick={() => setShowYearlyReport(!showYearlyReport)} className="w-full px-4 py-3 flex justify-between items-center hover:bg-amber-50 dark:hover:bg-amber-900/20 transition">
          <div className="flex items-center gap-2">
            <FiBarChart2 className="text-amber-400 text-lg" />
            <h3 className="text-sm font-semibold">📊 Yearly Sales Report</h3>
          </div>
          {showYearlyReport ? <FiChevronUp className="text-gray-500" /> : <FiChevronDown className="text-gray-500" />}
        </button>

        {showYearlyReport && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="flex gap-2 items-center">
                <label className="text-xs font-medium">Select Year:</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className={`px-2.5 py-1 rounded-lg text-xs border focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300'}`}>
                  {[2024, 2025, 2026, 2027].map(year => (<option key={year} value={year}>{year}</option>))}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={exportToExcel} className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs hover:bg-emerald-600 transition flex items-center gap-1 font-semibold"><FiFileText className="text-xs" /> Excel</button>
                <button onClick={exportToPDF} className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 transition flex items-center gap-1 font-semibold"><FiDownload className="text-xs" /> PDF</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className={`p-3 rounded-lg text-center ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Sales</p>
                <p className="text-lg font-bold text-amber-400">Rs. {selectedYearData.total.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Invoices</p>
                <p className="text-lg font-bold">{selectedYearData.count}</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Profit</p>
                <p className="text-lg font-bold text-emerald-400">Rs. {selectedYearData.profit.toLocaleString()}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Invoice</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Customer</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Item</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Type</th>
                    <th className="px-3 py-2 text-center text-xs font-medium uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase">Purchase</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase">Sell</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase">Unit Profit</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase">Total Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-3 py-6 text-center text-sm text-gray-400">No invoices found</td>
                    </tr>
                  ) : (
                    currentItems.map((item, idx) => (
                      <tr key={idx} className={darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-xs">{new Date(item.inv.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.inv.invoiceNo}</td>
                        <td className="px-3 py-2 text-xs">{item.inv.customer}</td>
                        <td className="px-3 py-2 text-xs">{item.service_name}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${item.isProduct ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                            {item.isProduct ? 'Product' : 'Service'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-xs">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-xs">{item.purchasePrice > 0 ? `Rs. ${item.purchasePrice.toLocaleString()}` : '-'}</td>
                        <td className="px-3 py-2 text-right text-xs">Rs. {item.price.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-xs text-emerald-400">+ Rs. {item.unitProfit.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-xs text-emerald-400">Rs. {(item.unitProfit * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
                  {selectedYearData.discount > 0 && (
                    <tr>
                      <td colSpan="9" className="px-3 py-2 text-right text-xs font-bold">Discount:</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-purple-400">- Rs. {selectedYearData.discount.toLocaleString()}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan="9" className="px-3 py-2 text-right text-xs font-bold">Total Profit:</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-emerald-400">Rs. {selectedYearData.profit.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 dark:border-gray-800">
                <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, totalItems)} of {totalItems} items
                </div>
                <div className="flex gap-1">
                  <button onClick={goToPrevPage} disabled={currentPage === 1} className={`px-2 py-1 rounded-lg text-xs flex items-center gap-0.5 transition ${currentPage === 1 ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    <FiChevronLeft className="text-sm" /> Prev
                  </button>
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button key={pageNum} onClick={() => paginate(pageNum)} className={`w-7 h-7 rounded-lg text-xs transition ${currentPage === pageNum ? 'bg-amber-400 text-gray-900 font-bold' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={goToNextPage} disabled={currentPage === totalPages} className={`px-2 py-1 rounded-lg text-xs flex items-center gap-0.5 transition ${currentPage === totalPages ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    Next <FiChevronRight className="text-sm" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (<div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center"><p className="text-sm text-red-700">⚠️ {error}</p></div>)}
    </div>
  );
};

export default FinanceOverview;