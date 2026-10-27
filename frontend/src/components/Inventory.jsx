import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  FiSearch, FiX, FiPlus, FiFileText, FiDownload,
  FiEdit2, FiPackage, FiDollarSign, FiTrendingUp,
  FiShoppingCart, FiBarChart2, FiCheckCircle, FiAlertCircle,
  FiLoader, FiUser, FiTrash2, FiEye, FiEyeOff,
  FiCalendar, FiArrowUp, FiArrowDown,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import api from '../services/api';

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
    case 'week': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
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

const filterProductsByDate = (products, filter, customDate = null) => {
  if (filter === 'all' || !products || products.length === 0) return products;
  const range = getDateRange(filter, customDate);
  if (!range) return products;

  return products.filter(product => {
    if (product.is_hidden === true) return false;
    if (!product.date_added) return false;
    const prodDate = new Date(product.date_added);
    return prodDate >= range.start && prodDate <= range.end;
  });
};

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const formatDateTime = (value) => {
  if (!value) return { date: '-', time: '' };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { date: '-', time: '' };
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  };
};

const HISTORY_FIELD_LABELS = {
  name: 'Product Name',
  purchase_price: 'Purchase Price',
  selling_price: 'Selling Price',
  quantity: 'Stock',
  low_stock_threshold: 'Low Stock Alert At',
  is_hidden: 'Visibility'
};

const HISTORY_ACTIONS = {
  created: { label: 'Product Added', dot: 'bg-green-500', badge: 'bg-green-500' },
  updated: { label: 'Updated', dot: 'bg-blue-500', badge: 'bg-blue-500' },
  hidden: { label: 'Hidden', dot: 'bg-yellow-500', badge: 'bg-yellow-500' },
  unhidden: { label: 'Unhidden', dot: 'bg-teal-500', badge: 'bg-teal-500' },
  deleted: { label: 'Deleted', dot: 'bg-red-500', badge: 'bg-red-500' }
};

const formatHistoryValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (field === 'purchase_price' || field === 'selling_price') {
    const n = Number(value);
    return isNaN(n) ? String(value) : `Rs. ${n.toLocaleString()}`;
  }
  if (field === 'is_hidden') {
    return (value === true || value === 1 || value === '1') ? 'Hidden' : 'Visible';
  }
  return String(value);
};

const normalizeChanges = (changes) => {
  if (!changes) return [];
  let data = changes;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { return []; }
  }
  if (Array.isArray(data)) {
    return data.map(c => ({ field: c.field, old: c.old, new: c.new }));
  }
  return Object.entries(data).map(([field, v]) => ({
    field,
    old: v?.old,
    new: v?.new
  }));
};

// Changed lowStockThreshold default to empty string
const emptyFormData = {
  name: '',
  purchasePrice: '',
  sellingPrice: '',
  quantity: '',
  lowStockThreshold: '',
  isCreditPurchase: false,
  vendorName: '',
  invoiceNumber: '',
  paidAmount: ''
};

const inputCls = (darkMode, extra = '') =>
  `px-2 py-1 border rounded focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'} ${extra}`;

const modalInputCls = (darkMode) =>
  `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

const ProductRow = React.memo(({ product, darkMode, editingCell, onStartEdit, onSaveEdit, onKeyPress, onEditProduct, onDeleteProduct, onToggleHide, onViewHistory, formatPrice, isAdmin }) => {
  const isEditing = (field) => editingCell.productId === product.id && editingCell.field === field;
  const isHidden = product.is_hidden === 1 || product.is_hidden === true;
  
  // Use null check instead of defaulting to 5
  const threshold = product.low_stock_threshold; 
  const hasThreshold = threshold !== null && threshold !== undefined;

  const invoiceNo = product.credit_vendor?.invoice_number || '-';
  const vendorName = product.credit_vendor?.name || product.vendor_name || '-';
  const addedAt = formatDateTime(product.created_at || product.date_added);
  const updatedAt = formatDateTime(product.updated_at || product.created_at || product.date_added);

  const editableCell = (field, type, width, rawValue, display, textCls, title, canEdit = true) => (
    <td className="px-4 py-3">
      {isEditing(field) ? (
        <input
          type={type}
          value={editingCell.value}
          onChange={(e) => onStartEdit({ ...editingCell, value: e.target.value })}
          onBlur={() => onSaveEdit(product.id, field)}
          onKeyDown={(e) => onKeyPress(e, product.id, field)}
          className={inputCls(darkMode, width)}
          autoFocus
          min="0"
          step={type === 'number' && (field === 'purchasePrice' || field === 'sellingPrice') ? '0.01' : undefined}
        />
      ) : (
        <div
          onDoubleClick={() => canEdit && onStartEdit({ productId: product.id, field, value: rawValue })}
          className={`${canEdit ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'cursor-default'} font-bold ${textCls} px-2 py-1 rounded transition w-fit`}
          title={canEdit ? title : ''}
        >
          {display}
        </div>
      )}
    </td>
  );

  const mutedText = darkMode ? 'text-white' : 'text-gray-600';

  return (
    <tr className={`${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} ${isHidden ? 'opacity-50 bg-gray-100 dark:bg-gray-800' : ''}`}>
      <td className="px-4 py-3">
        {isEditing('name') ? (
          <input
            type="text"
            value={editingCell.value}
            onChange={(e) => onStartEdit({ ...editingCell, value: e.target.value })}
            onBlur={() => onSaveEdit(product.id, 'name')}
            onKeyDown={(e) => onKeyPress(e, product.id, 'name')}
            className={inputCls(darkMode, 'w-full')}
            autoFocus
          />
        ) : (
          <div
            onDoubleClick={() => isAdmin && onStartEdit({ productId: product.id, field: 'name', value: product.name })}
            className={`${isAdmin ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'cursor-default'} font-bold ${darkMode ? 'text-white' : 'text-gray-900'} px-2 py-1 rounded transition`}
            title={isAdmin ? 'Double-click to edit' : ''}
          >
            {product.name}
            {isHidden && <span className="ml-2 text-xs font-bold bg-yellow-500 text-white px-2 py-0.5 rounded-full">Hidden</span>}
          </div>
        )}
      </td>

      {isAdmin && editableCell('purchasePrice', 'number', 'w-28', product.purchase_price, formatPrice(product.purchase_price), mutedText, 'Double-click to edit')}
      {isAdmin && editableCell('sellingPrice', 'number', 'w-28', product.selling_price, formatPrice(product.selling_price), mutedText, 'Double-click to edit')}

      <td className="px-4 py-3">
        {isEditing('quantity') ? (
          <input
            type="number"
            value={editingCell.value}
            onChange={(e) => onStartEdit({ ...editingCell, value: e.target.value })}
            onBlur={() => onSaveEdit(product.id, 'quantity')}
            onKeyDown={(e) => onKeyPress(e, product.id, 'quantity')}
            className={inputCls(darkMode, 'w-20')}
            autoFocus
            min="0"
          />
        ) : (
          <div
            onDoubleClick={() => onStartEdit({ productId: product.id, field: 'quantity', value: product.quantity })}
            className={`cursor-pointer font-bold flex items-center gap-1 ${
              hasThreshold && product.quantity < threshold && product.quantity > 0 ? 'text-amber-500' :
              product.quantity === 0 ? 'text-red-500' :
              darkMode ? 'text-white' : 'text-gray-900'
            } hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-1 rounded transition`}
            title={`Double-click to edit ${hasThreshold ? `(Low stock at: ${threshold})` : ''}`}
          >
            {product.quantity}
            {hasThreshold && product.quantity < threshold && product.quantity > 0 && <FiAlertCircle className="text-xs" title={`Low stock! Below ${threshold}`} />}
            {product.quantity === 0 && <FiX className="text-xs" title="Out of stock!" />}
          </div>
        )}
      </td>

      {isAdmin && editableCell('lowStockThreshold', 'number', 'w-16', product.low_stock_threshold ?? '', product.low_stock_threshold ?? '-', mutedText, 'Double-click to edit alert level')}

      <td className="px-4 py-3 text-sm font-medium text-gray-400">{invoiceNo}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-400">{vendorName}</td>

      <td className="px-4 py-3 text-xs">
        <div className={`font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{addedAt.date}</div>
        <div className="text-gray-400">{addedAt.time}</div>
      </td>

      <td className="px-4 py-3 text-xs">
        <div className={`font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{updatedAt.date}</div>
        <div className="text-gray-400">{updatedAt.time}</div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1 flex-wrap">
          {isAdmin && (
            <>
              <button
                onClick={() => onViewHistory(product)}
                className="px-2.5 py-1 bg-purple-500 text-white rounded-lg text-xs hover:bg-purple-600 transition flex items-center gap-1 shadow-md font-bold"
                title="View History"
              >
                <FiEye className="text-xs" />
              </button>
              <button
                onClick={() => onEditProduct(product)}
                className="px-2.5 py-1 bg-amber-400 text-gray-900 rounded-lg text-xs hover:bg-amber-300 transition flex items-center gap-1 shadow-md font-bold"
              >
                <FiEdit2 className="text-xs" /> Edit
              </button>
              <button
                onClick={() => onToggleHide(product)}
                className={`px-2.5 py-1 rounded-lg text-xs transition flex items-center gap-1 shadow-md font-bold text-gray-900 ${
                  isHidden ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-yellow-400 hover:bg-yellow-300'
                }`}
                title={isHidden ? 'Unhide' : 'Hide'}
              >
                {isHidden ? <FiEye className="text-xs" /> : <FiEyeOff className="text-xs" />}
                {isHidden ? 'Unhide' : 'Hide'}
              </button>
              <button
                onClick={() => onDeleteProduct(product.id, product.name)}
                className="px-2.5 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 transition flex items-center gap-1 shadow-md font-bold"
              >
                <FiTrash2 className="text-xs" /> Delete
              </button>
            </>
          )}
          {!isAdmin && <span className="text-xs font-bold text-gray-400">View Only</span>}
        </div>
      </td>
    </tr>
  );
});

const Inventory = ({ darkMode }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [timeFilter, setTimeFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [sortOption, setSortOption] = useState('default');

  const [filteredStats, setFilteredStats] = useState({
    totalPurchase: 0,
    totalSelling: 0,
    totalProfit: 0
  });

  const [formData, setFormData] = useState({ ...emptyFormData });
  const [viewMode, setViewMode] = useState('active');
  const [editingCell, setEditingCell] = useState({ productId: null, field: null, value: '' });

  const [vendorsList, setVendorsList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setIsAdmin(userData.role === 'admin');
    }
  }, []);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (viewMode === 'active') {
      filtered = filtered.filter(product => product.is_hidden !== true);
    } else if (viewMode === 'hidden') {
      filtered = filtered.filter(product => product.is_hidden === true);
    }

    filtered = filterProductsByDate(filtered, timeFilter, customDate || null);

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(q)
      );
    }

    if (sortOption !== 'default') {
      filtered = [...filtered];
      switch (sortOption) {
        case 'name-asc':
          filtered.sort((a, b) => a.name?.localeCompare(b.name || '') || 0);
          break;
        case 'name-desc':
          filtered.sort((a, b) => b.name?.localeCompare(a.name || '') || 0);
          break;
        case 'price-asc':
          filtered.sort((a, b) => (a.selling_price || 0) - (b.selling_price || 0));
          break;
        case 'price-desc':
          filtered.sort((a, b) => (b.selling_price || 0) - (a.selling_price || 0));
          break;
        default:
          break;
      }
    }

    return filtered;
  }, [products, searchTerm, viewMode, timeFilter, customDate, sortOption]);

  const filteredVendorSuggestions = useMemo(() => {
    const query = (formData.vendorName || '').toLowerCase().trim();
    if (!query) return vendorsList;
    return vendorsList.filter(name => name.toLowerCase().includes(query));
  }, [vendorsList, formData.vendorName]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode, timeFilter, customDate, sortOption]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const summaryTotals = useMemo(() => {
    const data = filteredProducts;
    const totalStock = data.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalPurchaseValue = data.reduce((sum, p) => sum + ((p.purchase_price || 0) * (p.quantity || 0)), 0);
    const totalSellingValue = data.reduce((sum, p) => sum + ((p.selling_price || 0) * (p.quantity || 0)), 0);
    const totalProfit = data.reduce((sum, p) => sum + (((p.selling_price || 0) - (p.purchase_price || 0)) * (p.quantity || 0)), 0);
    return { totalStock, totalPurchaseValue, totalSellingValue, totalProfit };
  }, [filteredProducts]);

  const calculateFilteredStats = useCallback((productsList, filter, customDateVal = null) => {
    const range = getDateRange(filter, customDateVal);
    const accumulate = (list) => list.reduce((acc, product) => {
      acc.totalPurchase += (product.purchase_price || 0) * (product.quantity || 0);
      acc.totalSelling += (product.selling_price || 0) * (product.quantity || 0);
      acc.totalProfit += ((product.selling_price || 0) - (product.purchase_price || 0)) * (product.quantity || 0);
      return acc;
    }, { totalPurchase: 0, totalSelling: 0, totalProfit: 0 });

    if (!range || filter === 'all') {
      return accumulate(productsList.filter(product => product.is_hidden !== true));
    }

    return accumulate(productsList.filter(product => {
      if (product.is_hidden === true) return false;
      if (!product.date_added) return false;
      const prodDate = new Date(product.date_added);
      return prodDate >= range.start && prodDate <= range.end;
    }));
  }, []);

  useEffect(() => {
    setFilteredStats(calculateFilteredStats(products, timeFilter, customDate || null));
  }, [products, timeFilter, customDate, calculateFilteredStats]);

  const getFilterLabel = () => {
    const labels = {
      all: 'All Time',
      today: 'Today',
      week: 'This Week',
      month: 'This Month',
      year: 'This Year',
      custom: `Custom: ${customDate || 'Select Date'}`
    };
    return labels[timeFilter] || 'All Time';
  };

  const getStatsLabelText = () => {
    const labels = {
      all: 'Total',
      today: "Today's",
      week: "This Week's",
      month: "This Month's",
      year: "This Year's",
      custom: `Custom (${customDate})`
    };
    return labels[timeFilter] || 'Total';
  };

  const getSortLabel = () => {
    const labels = {
      default: 'Default',
      'name-asc': 'A → Z',
      'name-desc': 'Z → A',
      'price-asc': 'Price: Low → High',
      'price-desc': 'Price: High → Low'
    };
    return labels[sortOption] || 'Default';
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/products', { params: { show_hidden: 'true' } });

      let productsData = [];
      if (response.data?.success && Array.isArray(response.data.data)) {
        productsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        productsData = response.data;
      }

      setProducts(productsData);
      setFilteredStats(calculateFilteredStats(productsData, timeFilter, customDate || null));
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        console.error('Error fetching products:', error);
        toast.error('Failed to load products');
      }
    } finally {
      setLoading(false);
    }
  }, [calculateFilteredStats, timeFilter, customDate]);

  const fetchVendorsList = useCallback(async () => {
    try {
      const response = await api.get('/credit/vendors');
      const rawData = response.data?.success && Array.isArray(response.data.data)
        ? response.data.data
        : (Array.isArray(response.data) ? response.data : []);

      const uniqueNames = [
        ...new Map(
          rawData
            .map(v => v.vendor_name)
            .filter(Boolean)
            .map(name => [name.toLowerCase().trim(), name])
        ).values()
      ];

      setVendorsList(uniqueNames);
    } catch (error) {
      console.error('Error fetching vendors list:', error);
    }
  }, []);

  const debouncedSearch = useMemo(
    () => debounce((value) => setSearchTerm(value), 300),
    []
  );

  const handleSearchChange = (e) => {
    debouncedSearch(e.target.value);
  };

  const handleCustomDateChange = (e) => {
    const date = e.target.value;
    setCustomDate(date);
    if (date) setTimeFilter('custom');
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateProduct = useCallback(async (id, productData) => {
    try {
      const response = await api.put(`/products/${id}`, productData);
      if (response.data) {
        toast.success('Product updated successfully!');
        await fetchProducts();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error(error.response?.data?.message || 'Failed to update product');
      return false;
    }
  }, [fetchProducts]);

  const handleDeleteProduct = useCallback(async (id, name) => {
    if (window.confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone!`)) {
      try {
        await api.delete(`/products/${id}`);
        toast.success(`"${name}" deleted successfully!`);
        await fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.error(error.response?.data?.message || 'Failed to delete product');
      }
    }
  }, [fetchProducts]);

  const handleToggleHide = useCallback(async (product) => {
    const isCurrentlyHidden = product.is_hidden === true || product.is_hidden === 1;
    const newHiddenStatus = isCurrentlyHidden ? 0 : 1;

    try {
      await api.patch(`/products/${product.id}`, { is_hidden: newHiddenStatus });
      await fetchProducts();
      toast.success(newHiddenStatus === 1 ? 'Product hidden successfully!' : 'Product unhidden successfully!');
      setViewMode(newHiddenStatus === 1 ? 'hidden' : 'active');
    } catch (error) {
      console.error('Error toggling product visibility:', error);
      toast.error(error.response?.data?.message || `Failed to ${newHiddenStatus === 1 ? 'hide' : 'unhide'} product`);
    }
  }, [fetchProducts]);

  useEffect(() => {
    fetchProducts();
    fetchVendorsList();
  }, [fetchProducts, fetchVendorsList]);

  const exportToExcel = useCallback((data, filename) => {
    const exportData = data.map(p => ({
      'Product': p.name,
      ...(isAdmin && { 'Purchase Price': `Rs. ${(p.purchase_price || 0).toLocaleString()}` }),
      ...(isAdmin && { 'Selling Price': `Rs. ${(p.selling_price || 0).toLocaleString()}` }),
      'Stock': p.quantity || 0,
      ...(isAdmin && { 'Low Stock At': p.low_stock_threshold ?? '-' }),
      'Invoice No': p.credit_vendor?.invoice_number || '-',
      'Vendor': p.credit_vendor?.name || p.vendor_name || '-',
      'Date & Time': (() => { const t = formatDateTime(p.created_at || p.date_added); return `${t.date} ${t.time}`.trim(); })(),
      'Updated At': (() => { const t = formatDateTime(p.updated_at || p.created_at || p.date_added); return `${t.date} ${t.time}`.trim(); })(),
      'Status': p.is_hidden === true ? 'Hidden' : 'Active'
    }));

    exportData.push({
      'Product': 'TOTAL',
      ...(isAdmin && { 'Purchase Price': `Rs. ${summaryTotals.totalPurchaseValue.toLocaleString()}` }),
      ...(isAdmin && { 'Selling Price': `Rs. ${summaryTotals.totalSellingValue.toLocaleString()}` }),
      'Stock': summaryTotals.totalStock,
      ...(isAdmin && { 'Low Stock At': '-' }),
      'Invoice No': '-',
      'Vendor': '-',
      'Date & Time': '-',
      'Updated At': '-',
      'Status': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    toast.success('Exported to Excel');
  }, [isAdmin, summaryTotals]);

  const exportToPDF = useCallback((data, title) => {
    const doc = new jsPDF('landscape');
    doc.text(title, 14, 10);

    const head = ['Product'];
    if (isAdmin) head.push('Purchase Price', 'Selling Price');
    head.push('Stock');
    if (isAdmin) head.push('Low Stock At');
    head.push('Invoice No', 'Vendor', 'Date & Time', 'Updated At', 'Status');

    const body = data.map(p => {
      const row = [p.name || ''];
      if (isAdmin) row.push(`Rs. ${(p.purchase_price || 0).toLocaleString()}`, `Rs. ${(p.selling_price || 0).toLocaleString()}`);
      row.push(p.quantity || 0);
      if (isAdmin) row.push(p.low_stock_threshold ?? '-');
      row.push(p.credit_vendor?.invoice_number || '-', p.credit_vendor?.name || p.vendor_name || '-');
      const t = formatDateTime(p.created_at || p.date_added);
      row.push(`${t.date} ${t.time}`.trim());
      const u = formatDateTime(p.updated_at || p.created_at || p.date_added);
      row.push(`${u.date} ${u.time}`.trim());
      row.push(p.is_hidden === true ? 'Hidden' : 'Active');
      return row;
    });

    const summaryRow = ['TOTAL'];
    if (isAdmin) {
      summaryRow.push(`Rs. ${summaryTotals.totalPurchaseValue.toLocaleString()}`);
      summaryRow.push(`Rs. ${summaryTotals.totalSellingValue.toLocaleString()}`);
    }
    summaryRow.push(summaryTotals.totalStock);
    if (isAdmin) summaryRow.push('-');
    summaryRow.push('-', '-', '-', '-', '');
    body.push(summaryRow);

    doc.autoTable({ head: [head], body, startY: 20 });
    doc.save(`${title}.pdf`);
    toast.success('Exported to PDF');
  }, [isAdmin, summaryTotals]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!isAdmin) {
      toast.error('Only admin can add products');
      return;
    }

    if (!formData.name || !formData.purchasePrice || !formData.sellingPrice || !formData.quantity) {
      toast.error('Please fill all required fields');
      return;
    }

    const purchasePriceNum = parseFloat(formData.purchasePrice);
    const sellingPriceNum = parseFloat(formData.sellingPrice);
    const quantityNum = parseInt(formData.quantity);
    
    // Handle empty threshold - allow 0 or empty
    let thresholdNum = null;
    if (formData.lowStockThreshold !== '' && formData.lowStockThreshold !== null && formData.lowStockThreshold !== undefined) {
      const parsed = parseInt(formData.lowStockThreshold);
      if (!isNaN(parsed)) {
        thresholdNum = parsed;
      }
    }

    if (isNaN(purchasePriceNum) || isNaN(sellingPriceNum) || isNaN(quantityNum)) {
      toast.error('Please enter valid numbers');
      return;
    }

    if (purchasePriceNum < 0 || sellingPriceNum < 0 || quantityNum < 0 || (thresholdNum !== null && thresholdNum < 0)) {
      toast.error('Values cannot be negative');
      return;
    }

    if (formData.isCreditPurchase && (!formData.vendorName || !formData.invoiceNumber)) {
      toast.error('Vendor name aur invoice number zaroori hai credit purchase ke liye');
      return;
    }

    setIsSubmitting(true);
    try {
      const productRes = await api.post('/products', {
        name: formData.name,
        purchase_price: purchasePriceNum,
        selling_price: sellingPriceNum,
        quantity: formData.isCreditPurchase ? 0 : quantityNum,
        low_stock_threshold: thresholdNum
      });

      const newProduct = productRes.data?.data;

      if (!newProduct?.id) {
        toast.error('Product ban gaya lekin vendor link nahi ho saka. Inventory check karo.');
        setFormData({ ...emptyFormData });
        setIsModalOpen(false);
        await fetchProducts();
        return;
      }

      if (formData.isCreditPurchase) {
        const paidAmountNum = parseFloat(formData.paidAmount) || 0;
        const totalAmount = purchasePriceNum * quantityNum;

        if (paidAmountNum > totalAmount) {
          toast.error('Paid amount total amount se zyada nahi ho sakta. Product bin gaya, vendor link skip hui.');
        } else {
          try {
            await api.post('/credit/vendors', {
              vendor_name: formData.vendorName,
              invoice_number: formData.invoiceNumber,
              total_amount: totalAmount,
              paid_amount: paidAmountNum,
              stock_quantity: quantityNum,
              product_ids: [{
                product_id: newProduct.id,
                product_name: formData.name,
                quantity: quantityNum,
                purchase_price: purchasePriceNum
              }]
            });
            toast.success('Product add ho gaya aur vendor se link ho gaya!');
            fetchVendorsList();
          } catch (vendorError) {
            console.error('Vendor link error:', vendorError);
            toast.error(vendorError.response?.data?.message || 'Product ban gaya, lekin vendor link fail hua (invoice number unique honi chahiye)');
          }
        }
      } else {
        toast.success('Product added successfully!');
      }

      setFormData({ ...emptyFormData });
      setIsModalOpen(false);
      await fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error(error.response?.data?.message || 'Failed to add product');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isAdmin, fetchProducts, fetchVendorsList, isSubmitting]);

  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
    setFormData({
      ...emptyFormData,
      name: product.name,
      purchasePrice: product.purchase_price,
      sellingPrice: product.selling_price,
      quantity: product.quantity,
      // Allow empty if null/undefined
      lowStockThreshold: product.low_stock_threshold ?? ''
    });
    setIsModalOpen(true);
  }, []);

  const handleUpdateSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!isAdmin) {
      if (!formData.quantity) {
        toast.error('Please enter stock quantity');
        return;
      }
      const quantityNum = parseInt(formData.quantity);
      if (isNaN(quantityNum) || quantityNum < 0) {
        toast.error('Please enter a valid positive number');
        return;
      }

      setIsSubmitting(true);
      try {
        const success = await handleUpdateProduct(editingProduct.id, { quantity: quantityNum });
        if (success) {
          setFormData({ ...emptyFormData });
          setEditingProduct(null);
          setIsModalOpen(false);
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!formData.name || !formData.purchasePrice || !formData.sellingPrice || !formData.quantity) {
      toast.error('Please fill all required fields');
      return;
    }

    const purchasePriceNum = parseFloat(formData.purchasePrice);
    const sellingPriceNum = parseFloat(formData.sellingPrice);
    const quantityNum = parseInt(formData.quantity);
    
    // Handle empty threshold
    let thresholdNum = null;
    if (formData.lowStockThreshold !== '' && formData.lowStockThreshold !== null && formData.lowStockThreshold !== undefined) {
      const parsed = parseInt(formData.lowStockThreshold);
      if (!isNaN(parsed)) {
        thresholdNum = parsed;
      }
    }

    if (isNaN(purchasePriceNum) || isNaN(sellingPriceNum) || isNaN(quantityNum)) {
      toast.error('Please enter valid numbers');
      return;
    }

    if (purchasePriceNum < 0 || sellingPriceNum < 0 || quantityNum < 0 || (thresholdNum !== null && thresholdNum < 0)) {
      toast.error('Values cannot be negative');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await handleUpdateProduct(editingProduct.id, {
        name: formData.name,
        purchase_price: purchasePriceNum,
        selling_price: sellingPriceNum,
        quantity: quantityNum,
        low_stock_threshold: thresholdNum
      });

      if (success) {
        setFormData({ ...emptyFormData });
        setEditingProduct(null);
        setIsModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingProduct, handleUpdateProduct, isAdmin, isSubmitting]);

  const startInlineEdit = useCallback(({ productId, field, value }) => {
    setEditingCell({ productId, field, value });
  }, []);

  const saveInlineEdit = useCallback(async (productId, field) => {
    let newValue;
    const productToUpdate = products.find(p => p.id === productId);
    const resetCell = () => setEditingCell({ productId: null, field: null, value: '' });

    if (!productToUpdate) {
      resetCell();
      return;
    }

    if (!isAdmin && field !== 'quantity') {
      toast.error('You can only update stock quantity');
      resetCell();
      return;
    }

    if (field === 'name') {
      newValue = editingCell.value.trim();
      if (!newValue) {
        toast.error('Product name cannot be empty');
        resetCell();
        return;
      }
    } else if (field === 'quantity' || field === 'lowStockThreshold') {
      // Handle empty string for lowStockThreshold
      if (editingCell.value === '' && field === 'lowStockThreshold') {
        newValue = null;
      } else {
        newValue = parseInt(editingCell.value);
        if (isNaN(newValue) || newValue < 0) {
          toast.error('Please enter a valid positive number');
          resetCell();
          return;
        }
      }
    } else {
      newValue = parseFloat(editingCell.value);
      if (isNaN(newValue) || newValue < 0) {
        toast.error('Please enter a valid positive number');
        resetCell();
        return;
      }
    }

    const updateData = {
      name: productToUpdate.name,
      purchase_price: productToUpdate.purchase_price,
      selling_price: productToUpdate.selling_price,
      quantity: productToUpdate.quantity,
      low_stock_threshold: productToUpdate.low_stock_threshold ?? null
    };

    if (field === 'name') updateData.name = newValue;
    else if (field === 'quantity') updateData.quantity = newValue;
    else if (field === 'purchasePrice') updateData.purchase_price = newValue;
    else if (field === 'sellingPrice') updateData.selling_price = newValue;
    else if (field === 'lowStockThreshold') updateData.low_stock_threshold = newValue;

    try {
      await api.put(`/products/${productId}`, updateData);
      await fetchProducts();

      const successMessage = {
        name: 'Product name updated!',
        quantity: 'Stock updated!',
        purchasePrice: 'Purchase price updated!',
        sellingPrice: 'Selling price updated!',
        lowStockThreshold: 'Low stock alert level updated!'
      }[field];

      toast.success(successMessage);
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    }
    resetCell();
  }, [editingCell, products, fetchProducts, isAdmin]);

  const handleKeyPress = useCallback((e, productId, field) => {
    if (e.key === 'Enter') {
      saveInlineEdit(productId, field);
    } else if (e.key === 'Escape') {
      setEditingCell({ productId: null, field: null, value: '' });
    }
  }, [saveInlineEdit]);

  const formatPrice = useCallback((price) => `Rs. ${price?.toLocaleString() || 0}`, []);

  const getProductCount = () => filteredProducts.length;

  const getViewModeText = () => {
    if (viewMode === 'active') return 'active';
    if (viewMode === 'hidden') return 'hidden';
    return 'all';
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({ ...emptyFormData });
    setIsSubmitting(false);
    setShowVendorDropdown(false);
  };

  const openHistory = useCallback(async (product) => {
    setHistoryProduct(product);
    setHistoryEntries([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const response = await api.get(`/products/${product.id}/history`);
      const raw = response.data?.success && Array.isArray(response.data.data)
        ? response.data.data
        : (Array.isArray(response.data) ? response.data : (Array.isArray(response.data?.data) ? response.data.data : []));
      const sorted = [...raw].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setHistoryEntries(sorted);
    } catch (error) {
      console.error('Error fetching product history:', error);
      if (error.response?.status === 404) {
        setHistoryError('History ka backend abhi set nahi hua (route / table baqi hai).');
      } else {
        setHistoryError(error.response?.data?.message || 'History load nahi ho saki');
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const closeHistory = useCallback(() => {
    setHistoryProduct(null);
    setHistoryEntries([]);
    setHistoryError('');
    setHistoryLoading(false);
  }, []);

  const card = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm';
  const chip = (active) =>
    active
      ? 'bg-amber-400 text-gray-900 shadow-md'
      : darkMode
        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  const thCls = `px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`;
  const labelCls = `block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const mutedCls = darkMode ? 'text-gray-400' : 'text-gray-500';

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-950' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-5xl text-amber-400 animate-spin mx-auto mb-4" />
          <p className={darkMode ? 'text-white' : 'text-gray-700'}>Loading inventory...</p>
        </div>
      </div>
    );
  }

  const summaryColSpan = (
    <>
      <td className="px-4 py-2.5"><span className="text-xs font-bold text-gray-400">-</span></td>
      <td className="px-4 py-2.5"><span className="text-xs font-bold text-gray-400">-</span></td>
      <td className="px-4 py-2.5"><span className="text-xs font-bold text-gray-400">-</span></td>
      <td className="px-4 py-2.5"><span className="text-xs font-bold text-gray-400">-</span></td>
    </>
  );

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-1.5 p-3 rounded-xl border ${card}`}>
        <span className={`text-xs font-bold mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Filter:</span>
        {[
          { key: 'all', label: 'All Time' },
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'year', label: 'This Year' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => { setTimeFilter(f.key); setShowCustomDate(false); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${chip(timeFilter === f.key)}`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustomDate(!showCustomDate)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${chip(timeFilter === 'custom')}`}
        >
          <FiCalendar className="text-sm" /> Custom
        </button>
        {showCustomDate && (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={customDate}
              onChange={handleCustomDateChange}
              className={`px-2 py-1 rounded-lg text-xs font-medium border ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
            />
            {customDate && (
              <button
                onClick={() => { setCustomDate(''); setTimeFilter('all'); setShowCustomDate(false); }}
                className="text-red-400 text-xs font-bold hover:text-red-300"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <span className="ml-auto text-xs font-medium text-gray-500">
          Showing: <strong className={darkMode ? 'text-white' : 'text-gray-800'}>{getFilterLabel()}</strong>
        </span>
      </div>

      <div className={`flex flex-wrap items-center gap-1.5 p-3 rounded-xl border ${card}`}>
        <span className={`text-xs font-bold mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Sort:</span>
        {[
          { key: 'default', label: 'Default' },
          { key: 'name-asc', label: 'A → Z' },
          { key: 'name-desc', label: 'Z → A' },
          { key: 'price-asc', label: 'Price: Low → High' },
          { key: 'price-desc', label: 'Price: High → Low' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setSortOption(f.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-0.5 ${chip(sortOption === f.key)}`}
          >
            {f.key === 'name-asc' && <FiArrowUp className="text-xs" />}
            {f.key === 'name-desc' && <FiArrowDown className="text-xs" />}
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs font-medium text-gray-500">
          Sorting: <strong className={darkMode ? 'text-white' : 'text-gray-800'}>{getSortLabel()}</strong>
        </span>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: FiShoppingCart, tint: 'bg-blue-500/15', color: 'text-blue-400', title: 'Purchase', value: filteredStats.totalPurchase, sub: 'purchases' },
            { icon: FiDollarSign, tint: 'bg-amber-500/15', color: 'text-amber-400', title: 'Selling', value: filteredStats.totalSelling, sub: 'sales' },
            { icon: FiTrendingUp, tint: 'bg-emerald-500/15', color: 'text-emerald-400', title: 'Profit', value: filteredStats.totalProfit, sub: 'profit' }
          ].map(s => (
            <div key={s.title} className={`rounded-xl p-4 border ${card}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-full ${s.tint}`}>
                  <s.icon className={`text-sm ${s.color}`} />
                </div>
                <span className={`text-xs font-bold ${mutedCls}`}>{getStatsLabelText()} {s.title}</span>
              </div>
              <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {s.value.toLocaleString()}</p>
              <p className="text-xs font-bold text-gray-500">{getStatsLabelText().toLowerCase()} {s.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className={`rounded-xl overflow-hidden border ${card}`}>
        <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap justify-between items-center gap-3`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            <FiPackage className="text-amber-400" />
            Products Inventory
            <span className="text-xs font-bold ml-1 text-gray-500">
              ({getProductCount()} {getViewModeText()})
            </span>
          </h3>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                onChange={handleSearchChange}
                className={`px-3 py-1.5 pl-8 rounded-lg text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-amber-400 ${darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
                style={{ width: '200px' }}
              />
              <FiSearch className="absolute left-2.5 top-2 text-gray-400 text-sm" />
            </div>

            <button
              onClick={() => setViewMode('active')}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-md font-bold text-white ${viewMode === 'active' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
            >
              <FiEye className="text-xs" /> Active
            </button>
            <button
              onClick={() => setViewMode('hidden')}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-md font-bold text-white ${viewMode === 'hidden' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-600 hover:bg-gray-700'}`}
            >
              <FiEyeOff className="text-xs" /> Hidden
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-md font-bold text-white ${viewMode === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-600 hover:bg-gray-700'}`}
            >
              All
            </button>

            {isAdmin && (
              <button onClick={() => setIsModalOpen(true)} className="px-2.5 py-1.5 bg-amber-400 text-gray-900 rounded-lg text-xs hover:bg-amber-300 transition flex items-center gap-1 shadow-md font-bold">
                <FiPlus className="text-xs" /> Add
              </button>
            )}

            <button onClick={() => exportToExcel(filteredProducts, 'Inventory_Report')} className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs hover:bg-emerald-600 transition flex items-center gap-1 shadow-md font-bold">
              <FiFileText className="text-xs" /> Excel
            </button>
            <button onClick={() => exportToPDF(filteredProducts, 'Inventory_Report')} className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 transition flex items-center gap-1 shadow-md font-bold">
              <FiDownload className="text-xs" /> PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
              <tr>
                <th className={thCls}>Product</th>
                {isAdmin && <th className={thCls}>Purchase</th>}
                {isAdmin && <th className={thCls}>Selling</th>}
                <th className={thCls}>Stock</th>
                {isAdmin && <th className={thCls}>Alert At</th>}
                <th className={thCls}>Invoice</th>
                <th className={thCls}>Vendor</th>
                <th className={thCls}>Date & Time</th>
                <th className={thCls}>Updated At</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {currentProducts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 7} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FiPackage className="text-4xl text-gray-400" />
                      <p className={`text-sm font-bold ${mutedCls}`}>
                        {searchTerm ? `No products found for "${searchTerm}"` :
                          viewMode === 'active' ? 'No active products found.' :
                          viewMode === 'hidden' ? 'No hidden products found.' :
                          'No products added yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {currentProducts.map(product => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      darkMode={darkMode}
                      editingCell={editingCell}
                      onStartEdit={startInlineEdit}
                      onSaveEdit={saveInlineEdit}
                      onKeyPress={handleKeyPress}
                      onEditProduct={handleEditProduct}
                      onDeleteProduct={handleDeleteProduct}
                      onToggleHide={handleToggleHide}
                      onViewHistory={openHistory}
                      formatPrice={formatPrice}
                      isAdmin={isAdmin}
                    />
                  ))}

                  <tr className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'} border-t-2`}>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-sm flex items-center gap-2">
                        <FiBarChart2 className="text-amber-400" />
                        <span className={darkMode ? 'text-white' : 'text-gray-900'}>TOTAL</span>
                      </div>
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-blue-400 text-sm">Rs. {summaryTotals.totalPurchaseValue.toLocaleString()}</div>
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-amber-400 text-sm">Rs. {summaryTotals.totalSellingValue.toLocaleString()}</div>
                      </td>
                    )}

                    <td className="px-4 py-2.5">
                      <div className="font-bold text-base flex items-center gap-1">
                        <span className={darkMode ? 'text-white' : 'text-gray-900'}>{summaryTotals.totalStock}</span>
                        <span className="text-xs font-bold text-gray-400">units</span>
                      </div>
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-2.5"><span className="text-xs font-bold text-gray-400">-</span></td>
                    )}

                    {summaryColSpan}

                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${mutedCls}`}>Stock: {summaryTotals.totalStock}</span>
                        {isAdmin && (
                          <>
                            <span className="text-xs font-bold text-blue-400">Buy: Rs. {summaryTotals.totalPurchaseValue.toLocaleString()}</span>
                            <span className="text-xs font-bold text-amber-400">Sell: Rs. {summaryTotals.totalSellingValue.toLocaleString()}</span>
                            <span className={`text-xs font-bold ${summaryTotals.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              Profit: Rs. {summaryTotals.totalProfit.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {filteredProducts.length > itemsPerPage && (
          <div className={`px-4 py-3 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap justify-between items-center gap-3`}>
            <div className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredProducts.length)} of {filteredProducts.length} entries
            </div>
            <div className="flex gap-1 flex-wrap items-center">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed ' + chip(false) : chip(false)}`}
              >
                <FiChevronLeft className="text-sm" /> Prev
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const dots = (key) => <span key={key} className="text-xs font-bold text-gray-500">...</span>;
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  if (i === 4) return dots('dots');
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  if (i === 0) return dots('dots');
                  pageNum = totalPages - 4 + i;
                } else {
                  if (i === 0) return dots('dots1');
                  if (i === 4) return dots('dots2');
                  pageNum = currentPage - 1 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${chip(currentPage === pageNum)}`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed ' + chip(false) : chip(false)}`}
              >
                Next <FiChevronRight className="text-sm" />
              </button>
            </div>
          </div>
        )}

        <div className={`px-4 py-2 border-t ${darkMode ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-500">Products:</span>
                <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{filteredProducts.length}</span>
              </div>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-500">Stock:</span>
                <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{summaryTotals.totalStock}</span>
              </div>
              {isAdmin && (
                <>
                  <div className="w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500">Purchase:</span>
                    <span className="text-sm font-bold text-blue-400">Rs. {summaryTotals.totalPurchaseValue.toLocaleString()}</span>
                  </div>
                  <div className="w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500">Selling:</span>
                    <span className="text-sm font-bold text-amber-400">Rs. {summaryTotals.totalSellingValue.toLocaleString()}</span>
                  </div>
                  <div className="w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500">Profit:</span>
                    <span className={`text-sm font-bold ${summaryTotals.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Rs. {summaryTotals.totalProfit.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
            {isAdmin && <div className="text-xs font-bold text-gray-500 italic">* Based on current stock × price</div>}
          </div>
        </div>
      </div>

      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-900 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-200'} rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border`}>
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-center`}>
              <h3 className="text-xl font-bold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 text-2xl">
                <FiX />
              </button>
            </div>

            <form onSubmit={editingProduct ? handleUpdateSubmit : handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={modalInputCls(darkMode)}
                  placeholder="Enter product name"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className={labelCls}>Purchase Price * (Rs.)</label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleInputChange}
                  className={modalInputCls(darkMode)}
                  placeholder="Enter purchase price"
                  min="0"
                  step="0.01"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className={labelCls}>Selling Price * (Rs.)</label>
                <input
                  type="number"
                  name="sellingPrice"
                  value={formData.sellingPrice}
                  onChange={handleInputChange}
                  className={modalInputCls(darkMode)}
                  placeholder="Enter selling price"
                  min="0"
                  step="0.01"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className={labelCls}>Stock Quantity *</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className={modalInputCls(darkMode)}
                  placeholder="Enter stock quantity"
                  min="0"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className={labelCls}>
                  Low Stock Alert At
                </label>
                <input
                  type="number"
                  name="lowStockThreshold"
                  value={formData.lowStockThreshold}
                  onChange={handleInputChange}
                  className={modalInputCls(darkMode)}
                  placeholder="Enter alert level (e.g. 5, 10, 0)"
                  min="0"
                  disabled={isSubmitting}
                />
                <p className={`text-xs font-bold mt-1 ${mutedCls}`}>⚠️ UI alert only - No email will be sent</p>
              </div>

              {!editingProduct && (
                <div className={`p-3 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isCreditPurchase || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, isCreditPurchase: e.target.checked }))}
                      className="w-4 h-4 accent-amber-400"
                      disabled={isSubmitting}
                    />
                    <span className={`text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Vendor se khareeda hai? (Credit Purchase)
                    </span>
                  </label>

                  {formData.isCreditPurchase && (
                    <div className="mt-3 space-y-3">
                      <div className="relative">
                        <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Vendor Name *</label>
                        <input
                          type="text"
                          value={formData.vendorName || ''}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, vendorName: e.target.value }));
                            setShowVendorDropdown(true);
                          }}
                          onFocus={() => setShowVendorDropdown(true)}
                          onBlur={() => setTimeout(() => setShowVendorDropdown(false), 150)}
                          className={modalInputCls(darkMode)}
                          placeholder="e.g. Ahmed Malik"
                          autoComplete="off"
                          disabled={isSubmitting}
                        />

                        {showVendorDropdown && filteredVendorSuggestions.length > 0 && (
                          <ul className={`absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border shadow-lg ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                            {filteredVendorSuggestions.map((name, idx) => (
                              <li
                                key={idx}
                                onMouseDown={() => {
                                  setFormData(prev => ({ ...prev, vendorName: name }));
                                  setShowVendorDropdown(false);
                                }}
                                className={`px-3 py-2 text-sm font-medium cursor-pointer transition ${darkMode ? 'text-gray-200 hover:bg-amber-900/30' : 'text-gray-700 hover:bg-amber-50'}`}
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        )}

                        {vendorsList.length > 0 && (
                          <p className={`text-xs font-bold mt-1 ${mutedCls}`}>
                            Purana vendor select karne ke liye type karo ya list se choose karo
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Invoice Number *</label>
                        <input
                          type="text"
                          value={formData.invoiceNumber || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                          className={modalInputCls(darkMode)}
                          placeholder="Unique invoice #"
                          disabled={isSubmitting}
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Abhi Kitna Diya (Rs.)</label>
                        <input
                          type="number"
                          value={formData.paidAmount || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, paidAmount: e.target.value }))}
                          className={modalInputCls(darkMode)}
                          placeholder="0 = poora udhaar"
                          min="0"
                          step="0.01"
                          disabled={isSubmitting}
                        />
                      </div>

                      <p className={`text-xs font-bold ${mutedCls}`}>
                        Total bill: Rs. {((parseFloat(formData.purchasePrice) || 0) * (parseInt(formData.quantity) || 0)).toLocaleString()} — baqi Credit page par "Pay Now" se dete rehna.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2 rounded-lg transition font-bold disabled:opacity-60 disabled:cursor-not-allowed ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-300 transition flex items-center justify-center gap-2 shadow-md font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <FiLoader className="text-sm animate-spin" />
                      {editingProduct ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="text-sm" />
                      {editingProduct ? 'Update Product' : 'Add Product'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyProduct && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-900 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-200'} rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col border`}>
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-start`}>
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <FiEye className="text-purple-500" /> Product History
                </h3>
                <p className={`text-sm font-medium mt-1 ${mutedCls}`}>{historyProduct.name}</p>
              </div>
              <button onClick={closeHistory} className="text-gray-500 hover:text-gray-700 text-2xl">
                <FiX />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {historyLoading ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <FiLoader className="text-3xl text-purple-500 animate-spin" />
                  <p className={mutedCls}>Loading history...</p>
                </div>
              ) : historyError ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <FiAlertCircle className="text-4xl text-red-500" />
                  <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{historyError}</p>
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <FiPackage className="text-4xl text-gray-400" />
                  <p className={mutedCls}>Abhi tak koi history record nahi hui.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyEntries.map((entry, idx) => {
                    const cfg = HISTORY_ACTIONS[entry.action] || { label: entry.action || 'Change', dot: 'bg-gray-500', badge: 'bg-gray-500' };
                    const when = formatDateTime(entry.created_at);
                    const changes = normalizeChanges(entry.changes);
                    return (
                      <div key={entry.id ?? idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`w-3 h-3 rounded-full mt-1.5 ${cfg.dot}`}></span>
                          {idx < historyEntries.length - 1 && (
                            <span className={`w-px flex-1 mt-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></span>
                          )}
                        </div>
                        <div className={`flex-1 p-3 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                            <span className={`text-xs font-medium ${mutedCls}`}>{when.date} • {when.time}</span>
                          </div>
                          {entry.user_name && (
                            <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${mutedCls}`}>
                              <FiUser className="text-xs" /> {entry.user_name}
                            </p>
                          )}
                          {changes.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {changes.map((c, i) => (
                                <li key={i} className="text-sm flex flex-wrap items-center gap-1">
                                  <span className={`font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {HISTORY_FIELD_LABELS[c.field] || c.field}:
                                  </span>
                                  {entry.action === 'created' || c.old === null || c.old === undefined ? (
                                    <span className="text-emerald-500 font-bold">{formatHistoryValue(c.field, c.new)}</span>
                                  ) : (
                                    <>
                                      <span className="text-red-500 line-through">{formatHistoryValue(c.field, c.old)}</span>
                                      <span className={mutedCls}>→</span>
                                      <span className="text-emerald-500 font-bold">{formatHistoryValue(c.field, c.new)}</span>
                                    </>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`px-6 py-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={closeHistory}
                className={`w-full px-4 py-2 rounded-lg transition font-bold ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;