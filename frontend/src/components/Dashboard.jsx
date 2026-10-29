import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  FiMenu, FiChevronLeft, FiSun, FiMoon, FiLogOut, 
  FiPackage, FiDollarSign, FiFileText, FiBarChart2, 
  FiTrendingUp, FiShoppingCart, FiCheckCircle, 
  FiAlertCircle, FiClock, FiArrowRight, FiLoader, FiUsers,
  FiCreditCard, FiCalendar, FiGift, FiChevronDown, FiChevronUp, FiFile,
  FiBattery, FiArchive, FiMoreVertical, FiBell, FiBriefcase, FiRotateCcw
} from 'react-icons/fi';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  ComposedChart, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import Sidebar from './Sidebar';
import api from '../services/api';

const Inventory = lazy(() => import('./Inventory'));
const InventoryHistory = lazy(() => import('./InventoryHistory'));
const CashInHand = lazy(() => import('./CashInHand'));
const FinanceOverview = lazy(() => import('./finance/FinanceOverview'));
const FinanceExpenses = lazy(() => import('./finance/FinanceExpenses'));
const FinanceCharts = lazy(() => import('./finance/FinanceCharts'));
const FinanceReports = lazy(() => import('./finance/FinanceReports'));
const FinanceReminders = lazy(() => import('./finance/FinanceReminders'));
const Billing = lazy(() => import('./Billing'));
const Records = lazy(() => import('./Records'));
const Reminders = lazy(() => import('./Reminders'));
const Users = lazy(() => import('./Users'));
const Credit = lazy(() => import('./finance/Credit'));
const DiscardedBillsPage = lazy(() => import('./billing/DiscardedBillsPage'));
const EstimatedBill = lazy(() => import('./EstimatedBill'));
const BatteryPage = lazy(() => import('./BatteryPage'));
const EstimateRecords = lazy(() => import('./EstimateRecords'));
const LeaveApplication = lazy(() => import('./leave/LeaveApplication'));

// Shuru me hath me jitna cash tha. Abhi 0 hai.
const OPENING_CASH = 0;

// /cash-in-hand API se manual cash ka total nikalta hai (Inventory.jsx wala same logic)
const extractManualCash = (res) => {
  if (!res) return 0;
  const body = res.data || {};
  const d = body.data ?? body;

  const keys = ['total', 'balance', 'current_balance', 'cash_in_hand', 'total_cash', 'current_cash'];
  for (const src of [d, body]) {
    if (src && typeof src === 'object' && !Array.isArray(src)) {
      for (const k of keys) {
        if (src[k] !== undefined && src[k] !== null && !isNaN(parseFloat(src[k]))) {
          return parseFloat(src[k]);
        }
      }
    }
  }

  const list = Array.isArray(d)
    ? d
    : (body.history || body.entries || d?.history || d?.entries || []);
  if (Array.isArray(list) && list.length > 0) {
    const latest = list.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a));
    return parseFloat(latest.balance_after) || 0;
  }
  return 0;
};

const LoadingFallback = ({ darkMode }) => (
  <div className={`flex items-center justify-center h-96 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
    <div className="text-center">
      <FiLoader className="text-6xl text-amber-400 animate-spin mx-auto mb-4" />
      <p className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-700'}`}>Loading...</p>
    </div>
  </div>
);

const Sparkline = ({ data, color }) => (
  <div className="h-10 mt-3 -mx-1">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        {/* Negative profit bhi dikhane ke liye auto domain */}
        <YAxis domain={['auto', 'auto']} hide />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.15}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const StatsCard = React.memo(({ 
  title, value, icon: Icon, iconBg, iconColor, 
  trend, subtitle, sparkData, sparkColor, 
  progressPercent, progressLabel, darkMode, negative
}) => (
  <div className={`rounded-2xl p-5 border flex flex-col ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} style={{ minHeight: '165px' }}>
    <div className="flex items-center gap-2.5 mb-2">
      <div className={`p-2 rounded-full ${iconBg}`}>
        <Icon className={`text-base ${iconColor}`} />
      </div>
      <span className={`text-sm font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</span>
    </div>
    
    <p className={`text-2xl font-extrabold ${negative ? 'text-red-400' : darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</p>

    <div className="h-7 flex items-center mt-0.5">
      {trend !== null && trend !== undefined && (
        <p className={`text-sm flex items-center gap-1 font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </p>
      )}
      {subtitle && (trend === null || trend === undefined) && (
        <p className={`text-sm font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{subtitle}</p>
      )}
    </div>

    {sparkData ? (
      <Sparkline data={sparkData} color={sparkColor} />
    ) : progressPercent !== undefined ? (
      <div className="mt-2">
        <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, progressPercent)}%` }} />
        </div>
        {progressLabel && <p className={`text-sm font-bold mt-1.5 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{progressLabel}</p>}
      </div>
    ) : null}
  </div>
));

const getInvoiceDiscount = (inv) => parseFloat(inv?.discount) || 0;
const getInvoiceGross = (inv) => (parseFloat(inv?.total_amount) || 0) + getInvoiceDiscount(inv);

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
  if (filter === 'all') return invoices;
  const range = getDateRange(filter, customDate);
  if (!range) return invoices;
  
  return invoices.filter(inv => {
    const invDate = new Date(inv.invoice_date);
    return invDate >= range.start && invDate <= range.end;
  });
};

const filterExpensesByDate = (expenses, filter, customDate = null) => {
  if (filter === 'all') return expenses;
  const range = getDateRange(filter, customDate);
  if (!range) return expenses;
  
  return expenses.filter(exp => {
    const expDate = new Date(exp.date || exp.created_at);
    return expDate >= range.start && expDate <= range.end;
  });
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  
  const getDefaultMenu = () => {
    const userData = localStorage.getItem('user');
    let role = null;
    if (userData) {
      try {
        const user = JSON.parse(userData);
        role = user?.role;
      } catch (e) {
        console.error('Error parsing user:', e);
        role = null;
      }
    }
    return role === 'employee' ? 'billing' : 'all-data';
  };
  
  const [activeMenu, setActiveMenu] = useState(getDefaultMenu());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : true;
  });

  const [timeFilter, setTimeFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [isLowStockOpen, setIsLowStockOpen] = useState(false);

  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [services, setServices] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [inventoryCashExpenses, setInventoryCashExpenses] = useState([]);
  const [vendorPaymentExpenses, setVendorPaymentExpenses] = useState([]);
  const [manualCashTotal, setManualCashTotal] = useState(0);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserRole(user.role);
        if (user.role === 'employee') {
          setActiveMenu('billing');
        } else {
          setActiveMenu('all-data');
        }
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  const productsArray = useMemo(() => Array.isArray(products) ? products : [], [products]);

  // Dashboard ke Expenses: sirf normal expenses + salary.
  // Inventory ki cost aur vendor payments yahan NAHI ginti.
  const expensesArray = useMemo(
    () => [
      ...(Array.isArray(expenses) ? expenses : []),
      ...salaryPayments
    ],
    [expenses, salaryPayments]
  );

  // Cash in Hand ke liye cash nikalne wali sari cheezein (expenses + cash inventory + vendor payments)
  const cashOutflowArray = useMemo(
    () => [
      ...expensesArray,
      ...inventoryCashExpenses,
      ...vendorPaymentExpenses
    ],
    [expensesArray, inventoryCashExpenses, vendorPaymentExpenses]
  );

  const invoicesArray = useMemo(() => Array.isArray(invoices) ? invoices : [], [invoices]);
  const servicesArray = useMemo(() => Array.isArray(services) ? services : [], [services]);

  const filteredInvoices = useMemo(() => 
    filterInvoicesByDate(invoicesArray, timeFilter, customDate || null),
    [invoicesArray, timeFilter, customDate]
  );

  const filteredExpenses = useMemo(() => 
    filterExpensesByDate(expensesArray, timeFilter, customDate || null),
    [expensesArray, timeFilter, customDate]
  );

  const activeProducts = useMemo(() => {
    const filtered = productsArray.filter(p => {
      const isHidden = p.is_hidden === true || p.is_hidden === 1;
      return !isHidden;
    });
    return filtered;
  }, [productsArray]);

  const totalSales = useMemo(() => 
    filteredInvoices.reduce((sum, inv) => sum + getInvoiceGross(inv), 0),
    [filteredInvoices]
  );

  const totalExpensesSum = useMemo(() => 
    filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0),
    [filteredExpenses]
  );

  const totalDiscount = useMemo(() => 
    filteredInvoices.reduce((sum, inv) => sum + getInvoiceDiscount(inv), 0),
    [filteredInvoices]
  );

  // NET PROFIT = invoices ka profit - expenses (salary samet)
  const totalProfitCalc = useMemo(() => {
    let profit = 0;
    for (const inv of filteredInvoices) {
      if (inv.items && inv.items.length > 0) {
        for (const item of inv.items) {
          const product = activeProducts.find(p => p.name === item.service_name);
          if (product) {
            const itemProfit = (parseFloat(item.price) - parseFloat(product.purchase_price)) * parseInt(item.quantity || 1);
            profit += itemProfit;
          } else {
            profit += parseFloat(item.price) * parseInt(item.quantity || 1);
          }
        }
      }
      profit -= getInvoiceDiscount(inv);
    }
    return profit - totalExpensesSum;
  }, [filteredInvoices, activeProducts, totalExpensesSum]);

  const profitMargin = useMemo(() => 
    totalSales > 0 ? (totalProfitCalc / totalSales) * 100 : 0,
    [totalSales, totalProfitCalc]
  );

  // CASH IN HAND (all-time, time filter se independent)
  // Manual cash (Cash in Hand page se add kiya hua) + sale ka poora paisa jama hota hai.
  // Cash se liya hua maal (inventory) aur vendor ko di hui payments minus hoti hain.
  // Normal expenses / salary yahan NAHI katte.
  const cashInHand = useMemo(() => {
    const received = invoicesArray.reduce(
      (sum, inv) => sum + (parseFloat(inv.total_amount) || 0),
      0
    );

    const inventorySpent = inventoryCashExpenses.reduce(
      (sum, e) => sum + (parseFloat(e.amount) || 0),
      0
    );

    const vendorPaid = vendorPaymentExpenses.reduce(
      (sum, e) => sum + (parseFloat(e.amount) || 0),
      0
    );

    return {
      received,
      inventorySpent,
      vendorPaid,
      manual: manualCashTotal,
      cash: OPENING_CASH + manualCashTotal + received - inventorySpent - vendorPaid
    };
  }, [invoicesArray, inventoryCashExpenses, vendorPaymentExpenses, manualCashTotal]);

  const totalProductsCount = useMemo(() => activeProducts.length, [activeProducts]);
  const totalStock = useMemo(() => 
    activeProducts.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0),
    [activeProducts]
  );

  const lowStockProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const threshold = p.low_stock_threshold ?? 5;
      return (parseInt(p.quantity) || 0) < threshold;
    });
  }, [activeProducts]);

  const recentInvoices = useMemo(() => 
    [...filteredInvoices]
      .sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date))
      .slice(0, 5),
    [filteredInvoices]
  );

  const monthlyData = useMemo(() => {
    const monthly = {};
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    monthOrder.forEach(m => {
      monthly[m] = { sales: 0, profit: 0, expenses: 0, discount: 0 };
    });
    
    filteredInvoices.forEach(inv => {
      if (inv.invoice_date) {
        const date = new Date(inv.invoice_date);
        const month = date.toLocaleString('default', { month: 'short' });
        if (monthly[month]) {
          const invDiscount = getInvoiceDiscount(inv);
          monthly[month].sales += getInvoiceGross(inv);
          monthly[month].discount += invDiscount;
          
          if (inv.items && inv.items.length > 0) {
            inv.items.forEach(item => {
              const product = activeProducts.find(p => p.name === item.service_name);
              if (product) {
                monthly[month].profit += (parseFloat(item.price) - parseFloat(product.purchase_price)) * parseInt(item.quantity || 1);
              } else {
                monthly[month].profit += parseFloat(item.price) * parseInt(item.quantity || 1);
              }
            });
          }
          monthly[month].profit -= invDiscount;
        }
      }
    });
    
    filteredExpenses.forEach(exp => {
      if (exp.date || exp.created_at) {
        const date = new Date(exp.date || exp.created_at);
        const month = date.toLocaleString('default', { month: 'short' });
        if (monthly[month]) {
          monthly[month].expenses += parseFloat(exp.amount) || 0;
        }
      }
    });
    
    return monthOrder.map(month => ({
      month,
      sales: monthly[month]?.sales || 0,
      // Net profit = invoice profit - expenses
      profit: (monthly[month]?.profit || 0) - (monthly[month]?.expenses || 0),
      expenses: monthly[month]?.expenses || 0,
      discount: monthly[month]?.discount || 0
    }));
  }, [filteredInvoices, filteredExpenses, activeProducts]);

  const trimmedMonthlyData = useMemo(() => {
    const hasData = (m) => m.sales > 0 || m.profit !== 0 || m.expenses > 0 || m.discount > 0;
    const firstIdx = monthlyData.findIndex(hasData);
    if (firstIdx === -1) return monthlyData;
    let lastIdx = monthlyData.length - 1;
    while (lastIdx > firstIdx && !hasData(monthlyData[lastIdx])) lastIdx--;
    return monthlyData.slice(firstIdx, lastIdx + 1);
  }, [monthlyData]);

  const getTrend = useCallback((key) => {
    const nonZero = monthlyData.filter(m => m[key] > 0);
    if (nonZero.length < 2) return null;
    const last = nonZero[nonZero.length - 1][key];
    const prev = nonZero[nonZero.length - 2][key];
    if (!prev) return null;
    return ((last - prev) / prev) * 100;
  }, [monthlyData]);

  const salesSpark = useMemo(() => trimmedMonthlyData.map(m => ({ value: m.sales })), [trimmedMonthlyData]);
  const profitSpark = useMemo(() => trimmedMonthlyData.map(m => ({ value: m.profit })), [trimmedMonthlyData]);
  const expensesSpark = useMemo(() => trimmedMonthlyData.map(m => ({ value: m.expenses })), [trimmedMonthlyData]);
  const discountSpark = useMemo(() => trimmedMonthlyData.map(m => ({ value: m.discount })), [trimmedMonthlyData]);

  const productSalesData = useMemo(() => {
    const allProducts = activeProducts
      .map(p => ({
        name: p.name,
        value: (parseFloat(p.selling_price) || 0) * (parseInt(p.quantity) || 0)
      }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value);

    const TOP_N = 8;
    if (allProducts.length <= TOP_N) return allProducts;

    const top = allProducts.slice(0, TOP_N);
    const others = allProducts.slice(TOP_N);
    const othersValue = others.reduce((sum, p) => sum + p.value, 0);

    if (othersValue > 0) {
      top.push({ name: `Others (${others.length} products)`, value: othersValue });
    }
    return top;
  }, [activeProducts]);

  const productSalesTotal = useMemo(() => 
    productSalesData.reduce((sum, p) => sum + p.value, 0),
    [productSalesData]
  );

  const topProductPercent = useMemo(() => 
    productSalesTotal > 0 && productSalesData.length > 0 
      ? (productSalesData[0].value / productSalesTotal) * 100 
      : 0,
    [productSalesData, productSalesTotal]
  );

  const COLORS = useMemo(() => ['#fbbf24', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#94a3b8'], []);

  const fetchAllData = useCallback(async (silent = false) => {
    const abortController = new AbortController();
    if (!silent) setLoading(true);
    try {
      const [productsRes, expensesRes, invoicesRes, servicesRes, employeesRes, allProductsRes, vendorsRes, manualCashRes] = await Promise.all([
        api.get('/products', { signal: abortController.signal }),
        api.get('/expenses', { signal: abortController.signal }),
        api.get('/invoices', { signal: abortController.signal }),
        api.get('/services', { signal: abortController.signal }),
        api.get('/employees', { signal: abortController.signal }).catch(() => null),
        api.get('/products', { params: { show_hidden: 'true' }, signal: abortController.signal }).catch(() => null),
        api.get('/credit/vendors', { signal: abortController.signal }).catch(() => null),
        api.get('/cash-in-hand', { signal: abortController.signal }).catch(() => null)
      ]);
      
      let productsData = [];
      if (productsRes.data?.success && Array.isArray(productsRes.data.data)) {
        productsData = productsRes.data.data;
      } else if (Array.isArray(productsRes.data)) {
        productsData = productsRes.data;
      } else {
        productsData = [];
      }

      let employeesList = [];
      if (Array.isArray(employeesRes?.data?.data)) {
        employeesList = employeesRes.data.data;
      } else if (Array.isArray(employeesRes?.data)) {
        employeesList = employeesRes.data;
      }
      const salaryList = employeesList.flatMap(emp =>
        (emp.payments || []).map(p => ({
          id: `salary-${p.id}`,
          amount: p.amount,
          date: p.payment_date || p.created_at,
          title: `Salary - ${emp.name}`,
          category: 'Salary'
        }))
      );
      
      const parseProductsRes = (res) => {
        if (res?.data?.success && Array.isArray(res.data.data)) return res.data.data;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.data?.data)) return res.data.data;
        return [];
      };
      const allProductsData = allProductsRes ? parseProductsRes(allProductsRes) : productsData;
      const invoicesData = Array.isArray(invoicesRes.data) ? invoicesRes.data : [];

      const soldByName = {};
      invoicesData.forEach(inv => {
        (inv.items || []).forEach(item => {
          const key = (item.service_name || '').toLowerCase().trim();
          if (!key) return;
          soldByName[key] = (soldByName[key] || 0) + (parseInt(item.quantity || 1) || 0);
        });
      });

      const inventoryCashList = allProductsData
        .filter(p => !(p.credit_vendor || p.vendor_name))
        .map(p => {
          const key = (p.name || '').toLowerCase().trim();
          const purchasedQty = (parseInt(p.quantity) || 0) + (soldByName[key] || 0);
          return {
            id: `inventory-${p.id}`,
            amount: (parseFloat(p.purchase_price) || 0) * purchasedQty,
            date: p.date_added || p.created_at,
            title: `Inventory (Cash) - ${p.name}`,
            category: 'Inventory (Cash)'
          };
        })
        .filter(e => e.amount > 0);

      let vendorRecords = [];
      if (Array.isArray(vendorsRes?.data?.data)) {
        vendorRecords = vendorsRes.data.data;
      } else if (Array.isArray(vendorsRes?.data)) {
        vendorRecords = vendorsRes.data;
      }

      const vendorPaymentList = vendorRecords.flatMap(v => {
        const payments = Array.isArray(v.payments) ? v.payments : [];
        const paymentsSum = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

        const items = payments.map(p => ({
          id: `vendor-payment-${p.id}`,
          amount: parseFloat(p.amount) || 0,
          date: p.date || p.payment_date || p.created_at,
          title: `Vendor Payment - ${v.vendor_name}`,
          category: 'Vendor Payment'
        }));

        const initialPaid = (parseFloat(v.paid_amount) || 0) - paymentsSum;
        if (initialPaid > 0.5) {
          items.push({
            id: `vendor-initial-${v.id}`,
            amount: initialPaid,
            date: v.created_at,
            title: `Vendor Payment - ${v.vendor_name}`,
            category: 'Vendor Payment'
          });
        }
        return items;
      });

      setProducts(productsData);
      setExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : []);
      setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setSalaryPayments(salaryList);
      setInventoryCashExpenses(inventoryCashList);
      setVendorPaymentExpenses(vendorPaymentList);
      setManualCashTotal(extractManualCash(manualCashRes));
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching data:', err);
        toast.error('Failed to load data');
        setProducts([]);
        setExpenses([]);
        setInvoices([]);
        setServices([]);
        setSalaryPayments([]);
        setInventoryCashExpenses([]);
        setVendorPaymentExpenses([]);
        setManualCashTotal(0);
      }
    } finally {
      setLoading(false);
    }
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const cleanup = fetchAllData();
    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup();
    };
  }, [fetchAllData]);

  const isFirstMenuRender = useRef(true);
  useEffect(() => {
    if (isFirstMenuRender.current) {
      isFirstMenuRender.current = false;
      return;
    }
    if (activeMenu === 'all-data') fetchAllData(true);
  }, [activeMenu, fetchAllData]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const handleAddProduct = useCallback(async (product) => {
    try {
      const response = await api.post('/products', product);
      if (response.data) {
        await fetchAllData();
        toast.success('Product added successfully');
        return true;
      }
    } catch (err) {
      console.error('Error adding product:', err);
      toast.error('Failed to add product');
      return false;
    }
  }, [fetchAllData]);

  const handleUpdateProduct = useCallback(async (updatedProduct) => {
    try {
      const response = await api.put(`/products/${updatedProduct.id}`, updatedProduct);
      if (response.data) {
        await fetchAllData();
        toast.success('Product updated successfully');
        return true;
      }
    } catch (err) {
      console.error('Error updating product:', err);
      toast.error('Failed to update product');
      return false;
    }
  }, [fetchAllData]);

  const handleAddExpense = useCallback(async (expense) => {
    try {
      const response = await api.post('/expenses', expense);
      if (response.data) {
        await fetchAllData();
        toast.success('Expense added successfully');
        return true;
      }
    } catch (err) {
      console.error('Error adding expense:', err);
      toast.error('Failed to add expense');
      return false;
    }
  }, [fetchAllData]);

  const handleUpdateExpense = useCallback(async (updatedExpense) => {
    try {
      const response = await api.put(`/expenses/${updatedExpense.id}`, updatedExpense);
      if (response.data) {
        await fetchAllData();
        toast.success('Expense updated successfully');
        return true;
      }
    } catch (err) {
      console.error('Error updating expense:', err);
      toast.error('Failed to update expense');
      return false;
    }
  }, [fetchAllData]);

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out');
    navigate('/');
  }, [navigate]);

  const getMenuTitle = useCallback(() => {
    const titles = {
      'all-data': 'Business Overview',
      inventory: 'Inventory Management',
      'inventory-history': 'Inventory History',
      'cash-in-hand': 'Cash in Hand',
      'finance-overview': 'Finance Dashboard',
      'finance-expenses': 'Expenses Management',
      'finance-charts': 'Financial Charts & Analytics',
      'finance-reports': 'Finance Reports & Distribution',
      'finance-reminders': 'Upcoming Payments & Reminders',
      'finance-credit': 'Credit Management',
      billing: 'Billing System',
      estimate: 'Estimate / Quotation',
      'estimate-records': 'Estimate Records',
      battery: 'Battery Sale',
      record: 'Records Archive',
      reminders: 'Reminders',
      users: 'User Management',
      discarded: 'Drafted Bills',
      leave: 'Leave Application'
    };
    return titles[activeMenu] || 'Dashboard';
  }, [activeMenu]);

  const getMenuDescription = useCallback(() => {
    const descriptions = {
      'all-data': 'Everything at a glance – Sales, Expenses, Products, Invoices',
      inventory: 'Manage products, track purchases and sales',
      'inventory-history': 'Track which items came on cash or credit, purchased or sold',
      'cash-in-hand': 'Add or withdraw cash and view the full history',
      'finance-overview': 'View daily, weekly and monthly financial overview',
      'finance-expenses': 'Add, edit and manage all expenses',
      'finance-charts': 'Visualize financial data with interactive charts',
      'finance-reports': 'Analyze expense distribution and generate reports',
      'finance-reminders': 'Track upcoming bills, salaries and payments',
      'finance-credit': 'Manage vendor credits, payments and history',
      billing: 'Create bills, print invoices, export data',
      estimate: 'Create and print customer estimates / quotations',
      'estimate-records': 'View all estimate records with search and filters',
      battery: 'Sell batteries with trade-in option',
      record: 'View all transaction history',
      reminders: 'Birthday, Tuning & Oil Change reminders',
      users: 'Manage system users and employees',
      discarded: 'View and restore drafted bills',
      leave: 'Record and manage employee leave applications'
    };
    return descriptions[activeMenu] || '';
  }, [activeMenu]);

  const getActiveIcon = useCallback(() => {
    const icons = {
      'all-data': <FiBarChart2 className="text-2xl" />,
      inventory: <FiPackage className="text-2xl" />,
      'inventory-history': <FiRotateCcw className="text-2xl" />,
      'cash-in-hand': <FiBriefcase className="text-2xl" />,
      'finance-overview': <FiDollarSign className="text-2xl" />,
      'finance-expenses': <FiFileText className="text-2xl" />,
      'finance-charts': <FiBarChart2 className="text-2xl" />,
      'finance-reports': <FiBarChart2 className="text-2xl" />,
      'finance-reminders': <FiBell className="text-2xl" />,
      'finance-credit': <FiCreditCard className="text-2xl" />,
      billing: <FiFileText className="text-2xl" />,
      estimate: <FiFile className="text-2xl" />,
      'estimate-records': <FiArchive className="text-2xl" />,
      battery: <FiBattery className="text-2xl" />,
      record: <FiBarChart2 className="text-2xl" />,
      reminders: <FiBell className="text-2xl" />,
      users: <FiUsers className="text-2xl" />,
      discarded: <FiClock className="text-2xl" />,
      leave: <FiCalendar className="text-2xl" />
    };
    return icons[activeMenu] || <FiPackage className="text-2xl" />;
  }, [activeMenu]);

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
    }
  };

  const renderChart = (data, darkMode) => {
    const commonProps = {
      data: data,
      margin: { top: 5, right: 5, left: -5, bottom: 5 }
    };

    const axisProps = {
      stroke: darkMode ? '#6b7280' : '#9ca3af',
      tick: { fontSize: 12, fontWeight: 600 }
    };

    const gridProps = {
      stroke: darkMode ? '#1f2937' : '#e5e7eb',
      strokeDasharray: '3 3',
      vertical: false
    };

    const tooltipProps = {
      contentStyle: { 
        backgroundColor: darkMode ? '#111827' : '#ffffff',
        border: darkMode ? '1px solid #1f2937' : '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '13px',
        fontWeight: 600
      }
    };

    const legendProps = {
      wrapperStyle: { color: darkMode ? '#d1d5db' : '#374151', fontSize: '13px', fontWeight: 600 },
      iconType: 'circle',
      iconSize: 10
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend {...legendProps} />
            <Line type="monotone" dataKey="sales" stroke="#fbbf24" name="Sales" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="profit" stroke="#22c55e" name="Profit" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="expenses" stroke="#3b82f6" name="Expenses" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="discount" stroke="#a855f7" name="Discount" strokeWidth={3} dot={false} />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend {...legendProps} />
            <Area type="monotone" dataKey="sales" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.3} name="Sales" />
            <Area type="monotone" dataKey="profit" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Profit" />
            <Area type="monotone" dataKey="expenses" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Expenses" />
            <Area type="monotone" dataKey="discount" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} name="Discount" />
          </AreaChart>
        );

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend {...legendProps} />
            <Bar dataKey="expenses" barSize={14} fill="#3b82f6" name="Expenses" radius={[3, 3, 0, 0]} />
            <Bar dataKey="discount" barSize={14} fill="#a855f7" name="Discount" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="sales" stroke="#fbbf24" name="Sales" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="profit" stroke="#22c55e" name="Profit" strokeWidth={3} dot={false} />
          </ComposedChart>
        );

      case 'bar':
      default:
        return (
          <BarChart {...commonProps} barCategoryGap="35%" barGap={3}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Legend {...legendProps} />
            <Bar dataKey="sales" fill="#fbbf24" name="Sales" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="profit" fill="#22c55e" name="Profit" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="expenses" fill="#3b82f6" name="Expenses" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="discount" fill="#a855f7" name="Discount" radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        );
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-950' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-6xl text-amber-400 animate-spin mx-auto mb-4" />
          <p className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-700'}`}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statusPillClass = (status) => {
    if (status === 'Paid') return darkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-700';
    if (status === 'Partial') return darkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-700';
    if (status === 'Unpaid') return darkMode ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-100 text-amber-700';
    return darkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700';
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-950' : 'bg-gray-100'}`}>
      <div className="flex h-screen">
        <Sidebar 
          activeMenu={activeMenu} 
          setActiveMenu={setActiveMenu} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          darkMode={darkMode}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`${darkMode ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-200'} px-5 py-3 flex justify-between items-center border-b`}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-800'}`}
              >
                {isSidebarOpen ? <FiChevronLeft className="text-xl" /> : <FiMenu className="text-xl" />}
              </button>
              <div>
                <h2 className={`text-lg font-extrabold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {getMenuTitle()}
                </h2>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {getMenuDescription()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeMenu === 'all-data' && (
                <button
                  onClick={() => setShowCustomDate(!showCustomDate)}
                  className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold ${darkMode ? 'bg-gray-900 border border-gray-800 text-gray-300 hover:bg-gray-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <FiCalendar className="text-amber-400 text-base" />
                  {getFilterLabel()}
                  <FiChevronDown className="text-sm" />
                </button>
              )}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-full transition ${darkMode ? 'bg-gray-900 border border-gray-800 text-amber-400 hover:text-amber-300' : 'bg-gray-100 text-gray-600 hover:text-gray-800'}`}
              >
                {darkMode ? <FiSun className="text-lg" /> : <FiMoon className="text-lg" />}
              </button>
              <button onClick={handleLogout} className={`p-2 rounded-full transition ${darkMode ? 'bg-gray-900 border border-gray-800 text-red-400 hover:text-red-300' : 'bg-gray-100 text-red-500 hover:text-red-600'}`}>
                <FiLogOut className="text-lg" />
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto p-4 ${darkMode ? 'bg-gray-950' : 'bg-gray-100'}`}>
            
            {activeMenu === 'all-data' && userRole !== 'employee' && (
              <div className="space-y-4">
                <div className={`flex flex-wrap items-center gap-1.5 p-3 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <span className={`text-sm font-bold mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Filter:</span>
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
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${timeFilter === f.key ? 'bg-amber-400 text-gray-900 shadow-md' : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCustomDate(!showCustomDate)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${timeFilter === 'custom' ? 'bg-amber-400 text-gray-900 shadow-md' : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    <FiCalendar className="text-base" /> Custom
                  </button>
                  {showCustomDate && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={customDate}
                        onChange={handleCustomDateChange}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                      />
                      {customDate && (
                        <button
                          onClick={() => { setCustomDate(''); setTimeFilter('all'); setShowCustomDate(false); }}
                          className="text-red-400 text-sm font-bold hover:text-red-300"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <StatsCard 
                    title="Total Sales" 
                    value={`Rs. ${totalSales.toLocaleString()}`} 
                    icon={FiDollarSign} 
                    iconBg="bg-amber-400/15" 
                    iconColor="text-amber-400"
                    trend={getTrend('sales')}
                    sparkData={salesSpark}
                    sparkColor="#fbbf24"
                    darkMode={darkMode} 
                  />
                  <StatsCard 
                    title="Total Profit" 
                    value={`Rs. ${totalProfitCalc.toLocaleString()}`} 
                    subtitle={`Margin: ${profitMargin.toFixed(1)}%`}
                    icon={FiTrendingUp} 
                    iconBg="bg-emerald-500/15" 
                    iconColor="text-emerald-400"
                    trend={null}
                    sparkData={profitSpark}
                    sparkColor={totalProfitCalc < 0 ? '#ef4444' : '#22c55e'}
                    negative={totalProfitCalc < 0}
                    darkMode={darkMode} 
                  />
                  <StatsCard 
                    title="Total Expenses" 
                    value={`Rs. ${totalExpensesSum.toLocaleString()}`} 
                    icon={FiShoppingCart} 
                    iconBg="bg-blue-500/15" 
                    iconColor="text-blue-400"
                    trend={getTrend('expenses')}
                    sparkData={expensesSpark}
                    sparkColor="#3b82f6"
                    darkMode={darkMode} 
                  />
                  <StatsCard 
                    title="Active Products" 
                    value={totalProductsCount} 
                    icon={FiPackage} 
                    iconBg="bg-purple-500/15" 
                    iconColor="text-purple-400"
                    progressPercent={Math.min(100, (totalStock / 50) * 100)}
                    progressLabel={`${totalStock} units`}
                    darkMode={darkMode} 
                  />
                  <StatsCard 
                    title="Total Discount" 
                    value={`Rs. ${totalDiscount.toLocaleString()}`} 
                    icon={FiGift} 
                    iconBg="bg-orange-500/15" 
                    iconColor="text-orange-400"
                    trend={getTrend('discount')}
                    sparkData={discountSpark}
                    sparkColor="#f97316"
                    darkMode={darkMode} 
                  />
                  <StatsCard 
                    title="Cash in Hand" 
                    value={`Rs. ${cashInHand.cash.toLocaleString()}`} 
                    subtitle={`Manual: ${cashInHand.manual.toLocaleString()} | Sales: ${cashInHand.received.toLocaleString()} | Purchases: ${(cashInHand.inventorySpent + cashInHand.vendorPaid).toLocaleString()}`}
                    icon={FiCreditCard} 
                    iconBg="bg-teal-500/15" 
                    iconColor="text-teal-400"
                    trend={null}
                    negative={cashInHand.cash < 0}
                    darkMode={darkMode} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className={`lg:col-span-2 rounded-xl p-4 border flex flex-col ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} style={{ height: '430px' }}>
                    <div className="flex justify-between items-center mb-3 flex-shrink-0">
                      <h3 className={`text-base font-extrabold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        <FiTrendingUp className="text-amber-400 text-xl" /> Monthly Sales, Profit, Expenses & Discount
                      </h3>
                      <select
                        value={chartType}
                        onChange={(e) => setChartType(e.target.value)}
                        className={`text-sm font-bold px-3 py-1 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700'}`}
                      >
                        <option value="bar">Bar</option>
                        <option value="line">Line</option>
                        <option value="area">Area</option>
                        <option value="composed">Composed</option>
                      </select>
                    </div>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        {renderChart(trimmedMonthlyData, darkMode)}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {productSalesData.length > 0 && (
                    <div className={`lg:col-span-1 rounded-xl p-4 border flex flex-col ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`} style={{ height: '430px' }}>
                      <h3 className={`text-base font-extrabold mb-2 flex items-center gap-2 flex-shrink-0 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        <FiBarChart2 className="text-amber-400 text-xl" /> Product Sales
                      </h3>
                      <div className="h-48 flex-shrink-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={productSalesData} 
                              cx="50%" 
                              cy="50%" 
                              innerRadius={45}
                              outerRadius={70} 
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {productSalesData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `Rs. ${value.toLocaleString()}`} contentStyle={{ backgroundColor: darkMode ? '#111827' : '#ffffff', border: darkMode ? '1px solid #1f2937' : '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: 600 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className={`text-sm font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</span>
                          <span className={`text-lg font-extrabold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{topProductPercent.toFixed(0)}%</span>
                        </div>
                      </div>

                      <div className={`flex justify-between text-sm font-bold mt-2 pb-1.5 border-b flex-shrink-0 ${darkMode ? 'text-gray-500 border-gray-800' : 'text-gray-400 border-gray-200'}`}>
                        <span>PRODUCT</span>
                        <span>SALES</span>
                      </div>
                      <div className="mt-1 flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
                        {productSalesData.map((entry, index) => (
                          <div key={`legend-${index}`} className="flex items-center gap-2 text-sm">
                            <span 
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></span>
                            <span className={`truncate flex-1 font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} title={entry.name}>
                              {entry.name}
                            </span>
                            <span className={`flex-shrink-0 font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Rs. {entry.value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => setActiveMenu('finance-reports')}
                        className="w-full mt-2 py-2 bg-amber-400 text-gray-900 rounded-lg text-sm font-extrabold hover:bg-amber-300 transition flex-shrink-0"
                      >
                        View Full Report
                      </button>
                    </div>
                  )}
                </div>

                <div className={`rounded-xl overflow-hidden border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="px-4 py-2.5 flex justify-between items-center">
                    <h3 className={`font-extrabold flex items-center gap-2 text-base ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      <FiFileText className="text-amber-400 text-xl" /> Recent Invoices
                    </h3>
                    <button onClick={() => setActiveMenu('record')} className="text-amber-400 text-sm font-bold hover:text-amber-300 flex items-center gap-1">
                      View All <FiArrowRight className="text-sm" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={darkMode ? 'text-gray-500' : 'text-gray-500'}>
                          <th className="px-4 py-2 text-left text-sm font-bold uppercase">Invoice #</th>
                          <th className="px-4 py-2 text-left text-sm font-bold uppercase">Customer</th>
                          <th className="px-4 py-2 text-left text-sm font-bold uppercase">Date</th>
                          <th className="px-4 py-2 text-right text-sm font-bold uppercase">Amount</th>
                          <th className="px-4 py-2 text-center text-sm font-bold uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
                        {recentInvoices.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-4 py-5 text-center">
                              <p className={`text-sm font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                No invoices found
                              </p>
                            </td>
                          </tr>
                        ) : (
                          recentInvoices.map(inv => (
                            <tr key={inv.id} className={darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                              <td className={`px-4 py-2.5 text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{inv.invoice_no || inv.invoiceNo}</td>
                              <td className={`px-4 py-2.5 text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{inv.customer_name || inv.customer?.name || 'Walk-in'}</td>
                              <td className={`px-4 py-2.5 text-sm font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                              </td>
                              <td className={`px-4 py-2.5 text-sm font-extrabold text-right ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Rs. {(inv.total_amount || inv.total || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-sm text-center">
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusPillClass(inv.status)}`}>
                                  {inv.status || 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`rounded-xl overflow-hidden border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div 
                    className={`px-4 py-2.5 flex justify-between items-center cursor-pointer hover:opacity-80 transition`}
                    onClick={() => setIsLowStockOpen(!isLowStockOpen)}
                  >
                    <h3 className={`font-extrabold flex items-center gap-2 text-base ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      <FiAlertCircle className="text-amber-400 text-xl" /> Low Stock Alerts
                      <span className={`text-sm font-bold ml-1 ${lowStockProducts.length > 0 ? 'text-amber-400' : darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        ({lowStockProducts.length})
                      </span>
                    </h3>
                    <div className="flex items-center gap-2">
                      {lowStockProducts.length > 0 && (
                        <span className="text-sm bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse font-bold">
                          ⚠️
                        </span>
                      )}
                      {isLowStockOpen ? (
                        <FiChevronUp className={`text-lg ${darkMode ? 'text-gray-500' : 'text-gray-500'}`} />
                      ) : (
                        <FiChevronDown className={`text-lg ${darkMode ? 'text-gray-500' : 'text-gray-500'}`} />
                      )}
                    </div>
                  </div>
                  {isLowStockOpen && (
                    <div className="px-4 pb-2.5">
                      {lowStockProducts.length === 0 ? (
                        <div className="text-center py-5">
                          <FiCheckCircle className="text-4xl mx-auto text-emerald-400 mb-1.5" />
                          <p className={`text-sm font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            All products have sufficient stock
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {lowStockProducts.map(p => {
                            const threshold = p.low_stock_threshold ?? 5;
                            return (
                              <div key={p.id} className={`flex justify-between items-center p-2.5 rounded-lg border ${p.quantity <= 3 ? (darkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200') : (darkMode ? 'bg-orange-900/10 border-orange-900/40' : 'bg-orange-50 border-orange-200')}`}>
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-1.5 h-8 rounded-full ${p.quantity <= 3 ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                                  <div>
                                    <span className={`font-extrabold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {p.name}
                                    </span>
                                    <span className={`text-sm font-bold ml-1.5 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                      {p.quantity} (Threshold: {threshold})
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <span className={`font-extrabold text-sm ${p.quantity <= 3 ? 'text-red-400' : 'text-orange-400'}`}>
                                    {p.quantity} left
                                  </span>
                                  <button 
                                    onClick={() => setActiveMenu('inventory')} 
                                    className="px-3 py-1 bg-amber-400 text-gray-900 rounded-lg text-sm font-extrabold hover:bg-amber-300 transition flex items-center gap-1"
                                  >
                                    <FiPackage className="text-sm" /> Restock
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button onClick={() => setActiveMenu('billing')} className="w-full py-2.5 bg-amber-400 text-gray-900 rounded-xl font-extrabold hover:bg-amber-300 transition shadow-md flex items-center justify-center gap-2 text-base">
                    <FiFileText className="text-lg" /> New Bill
                  </button>
                  <button onClick={() => setActiveMenu('inventory')} className={`w-full py-2.5 rounded-xl font-extrabold transition shadow-md flex items-center justify-center gap-2 text-base ${darkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                    <FiPackage className="text-lg" /> Add Product
                  </button>
                  <button onClick={() => setActiveMenu('record')} className={`w-full py-2.5 rounded-xl font-extrabold transition shadow-md flex items-center justify-center gap-2 text-base ${darkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                    <FiShoppingCart className="text-lg" /> View Records
                  </button>
                  <button 
                    onClick={() => setActiveMenu('finance-expenses')} 
                    className="w-full py-2.5 bg-blue-500 text-white rounded-xl font-extrabold hover:bg-blue-600 transition shadow-md flex items-center justify-center gap-2 text-base"
                  >
                    <FiDollarSign className="text-lg" /> Add Expense
                  </button>
                </div>
              </div>
            )}

            <Suspense fallback={<LoadingFallback darkMode={darkMode} />}>
              {activeMenu === 'inventory' && (
                <Inventory products={productsArray} darkMode={darkMode} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} />
              )}

              {activeMenu === 'inventory-history' && userRole === 'admin' && (
                <InventoryHistory darkMode={darkMode} />
              )}

              {activeMenu === 'cash-in-hand' && userRole === 'admin' && (
                <CashInHand darkMode={darkMode} />
              )}
              
              {activeMenu === 'finance-overview' && userRole !== 'employee' && (
                <FinanceOverview darkMode={darkMode} />
              )}
              {activeMenu === 'finance-expenses' && userRole !== 'employee' && (
                <FinanceExpenses darkMode={darkMode} />
              )}
              {activeMenu === 'finance-charts' && userRole !== 'employee' && (
                <FinanceCharts darkMode={darkMode} />
              )}
              {activeMenu === 'finance-reports' && userRole !== 'employee' && (
                <FinanceReports darkMode={darkMode} />
              )}
              {activeMenu === 'finance-reminders' && userRole !== 'employee' && (
                <FinanceReminders darkMode={darkMode} />
              )}
              
              {activeMenu === 'finance-credit' && userRole !== 'employee' && (
                <Credit darkMode={darkMode} />
              )}
              
              {activeMenu === 'billing' && (
                <Billing 
                  darkMode={darkMode} 
                  services={servicesArray}
                  invoices={invoicesArray}
                  setInvoices={setInvoices}
                  products={productsArray}
                  setProducts={setProducts}
                />
              )}

              {activeMenu === 'estimate' && (
                <EstimatedBill darkMode={darkMode} />
              )}

              {activeMenu === 'estimate-records' && (
                <EstimateRecords darkMode={darkMode} />
              )}

              {activeMenu === 'battery' && (
                <BatteryPage darkMode={darkMode} />
              )}
              
              {activeMenu === 'record' && userRole !== 'employee' && (
                <Records darkMode={darkMode} />
              )}

              {activeMenu === 'reminders' && (
                <Reminders darkMode={darkMode} />
              )}

              {activeMenu === 'users' && userRole === 'admin' && (
                <Users darkMode={darkMode} />
              )}

              {activeMenu === 'discarded' && (
                <DiscardedBillsPage darkMode={darkMode} />
              )}

              {activeMenu === 'leave' && (
                <LeaveApplication darkMode={darkMode} />
              )}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;