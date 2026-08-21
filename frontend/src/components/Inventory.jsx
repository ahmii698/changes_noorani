// src/components/Inventory.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  FiSearch, FiX, FiPlus, FiFileText, FiDownload, 
  FiEdit2, FiPackage, FiDollarSign, FiTrendingUp,
  FiShoppingCart, FiBarChart2, FiCheckCircle, FiAlertCircle,
  FiLoader, FiUser, FiTrash2, FiEye, FiEyeOff, FiGrid, FiList,
  FiCalendar, FiArrowUp, FiArrowDown, FiMoreVertical,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import api from '../services/api';

// ✅ Helper: Get date range for filter
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

// ✅ Product Row Component - Bold + Dark Mode
const ProductRow = React.memo(({ product, darkMode, editingCell, onStartEdit, onSaveEdit, onKeyPress, onEditProduct, onDeleteProduct, onToggleHide, formatPrice, isAdmin }) => {
  const isEditingName = editingCell.productId === product.id && editingCell.field === 'name';
  const isEditingPurchase = editingCell.productId === product.id && editingCell.field === 'purchasePrice';
  const isEditingSelling = editingCell.productId === product.id && editingCell.field === 'sellingPrice';
  const isEditingQuantity = editingCell.productId === product.id && editingCell.field === 'quantity';
  const isEditingThreshold = editingCell.productId === product.id && editingCell.field === 'lowStockThreshold';
  const isHidden = product.is_hidden === 1 || product.is_hidden === true;
  
  const threshold = product.low_stock_threshold ?? 5;

  return (
    <tr className={`${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} ${isHidden ? 'opacity-50 bg-gray-100 dark:bg-gray-800' : ''}`}>
      <td className="px-4 py-3">
        {isEditingName ? (
          <input
            type="text"
            value={editingCell.value}
            onChange={(e) => onStartEdit({ ...editingCell, value: e.target.value })}
            onBlur={() => onSaveEdit(product.id, 'name')}
            onKeyDown={(e) => onKeyPress(e, product.id, 'name')}
            className={`w-full px-2 py-1 border rounded focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`}
            autoFocus
          />
        ) : (
          <div 
            onDoubleClick={() => isAdmin && onStartEdit({ productId: product.id, field: 'name', value: product.name })} 
            className={`${isAdmin ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'cursor-default'} font-bold ${darkMode ? 'text-white' : 'text-gray-900'} px-2 py-1 rounded transition`} 
            title={isAdmin ? "Double-click to edit" : ""}
          >
            {product.name}
            {isHidden && <span className="ml-2 text-xs font-bold bg-yellow-500 text-white px-2 py-0.5 rounded-full">Hidden</span>}
          </div>
        )}
      </td>
      
      {isAdmin && (
        <td className="px-4 py-3">
          {isEditingPurchase ? (
            <input
              type="number"
              value={editingCell.value}
              onChange={(e) => onStartEdit({ ...editingCell, value: e.target.value })}
              onBlur={() => onSaveEdit(product.id, 'purchasePrice')}
              onKeyDown={(e) => onKeyPress(e, product.id, 'purchasePrice')}
              className={`w-28 px-2 py-1 border rounded focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`}
              autoFocus
              step="0.01"
              min="0"
            />
          ) : (
            <div 
              onDoubleClick={() => isAdmin && onStartEdit({ productId: product.id, field: 'purchasePrice', value: product.purchase_price })} 
              className={`${isAdmin ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'cursor-default'} font-bold ${darkMode ? 'text-white' : 'text-gray-600'} px-2 py-1 rounded transition`} 
              title={isAdmin ? "Double-click to edit" : ""}
            >
              {formatPrice(product.purchase_price)}
            </div>
          )}
        </td>
      )}
      
      {isAdmin && (
        <td className="px-4 py-3">
          {isEditingSelling ? (
            <input
              type="number"
              value={editingCell.value}
              onChange={(e) => onStartEdit({ ...editingCell, value: e.target.value })}
              onBlur={() => onSaveEdit(product.id, 'sellingPrice')}
              onKeyDown={(e) => onKeyPress(e, product.id, 'sellingPrice')}
              className={`w-28 px-2 py-1 border rounded focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`}
              autoFocus
              step="0.01"
              min="0"
            />
          ) : (
            <div 
              onDoubleClick={() => isAdmin && onStartEdit({ productId: product.id, field: 'sellingPrice', value: product.selling_price })} 
              className={`${isAdmin ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'cursor-default'} font-bold ${darkMode ? 'text-white' : 'text-gray-600'} px-2 py-1 rounded transition`} 
              title={isAdmin ? "Double-click to edit" : ""}
            >
              {formatPrice(product.selling_price)}
            </div>
          )}
        </td>
      )}

      <td className="px-4 py-3">
        {isEditingQuantity ? (
          <input
            type="number"
            value={editingCell.value}
            onChange={(e) => onStartEdit({ ...editingCell, value: e.target.value })}
            onBlur={() => onSaveEdit(product.id, 'quantity')}
            onKeyDown={(e) => onKeyPress(e, product.id, 'quantity')}
            className={`w-20 px-2 py-1 border rounded focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`}
            autoFocus
            min="0"
          />
        ) : (
          <div 
            onDoubleClick={() => onStartEdit({ productId: product.id, field: 'quantity', value: product.quantity })} 
            className={`cursor-pointer font-bold flex items-center gap-1 ${
              product.quantity < threshold && product.quantity > 0 ? 'text-amber-500' : 
              product.quantity === 0 ? 'text-red-500' : 
              darkMode ? 'text-white' : 'text-gray-900'
            } hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-1 rounded transition`} 
            title={`Double-click to edit (Low stock at: ${threshold})`}
          >
            {product.quantity}
            {product.quantity < threshold && product.quantity > 0 && <FiAlertCircle className="text-xs" title={`Low stock! Below ${threshold}`} />}
            {product.quantity === 0 && <FiX className="text-xs" title="Out of stock!" />}
          </div>
        )}
      </td>

      {isAdmin && (
        <td className="px-4 py-3">
          {isEditingThreshold ? (
            <input
              type="number"
              value={editingCell.value}
              onChange={(e) => onStartEdit({ ...editingCell, value: e.target.value })}
              onBlur={() => onSaveEdit(product.id, 'lowStockThreshold')}
              onKeyDown={(e) => onKeyPress(e, product.id, 'lowStockThreshold')}
              className={`w-16 px-2 py-1 border rounded focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`}
              autoFocus
              min="0"
            />
          ) : (
            <div
              onDoubleClick={() => onStartEdit({ productId: product.id, field: 'lowStockThreshold', value: product.low_stock_threshold ?? 5 })}
              className={`cursor-pointer font-bold ${darkMode ? 'text-white' : 'text-gray-600'} hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-1 rounded transition w-fit`}
              title="Double-click to edit alert level"
            >
              {product.low_stock_threshold ?? 5}
            </div>
          )}
        </td>
      )}

      <td className="px-4 py-3 text-sm font-medium text-gray-400">-</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-400">-</td>
      
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 flex-wrap">
          {isAdmin && (
            <>
              <button 
                onClick={() => onEditProduct(product)} 
                className="px-2.5 py-1 bg-amber-400 text-gray-900 rounded-lg text-xs hover:bg-amber-300 transition flex items-center gap-1 shadow-md font-bold"
              >
                <FiEdit2 className="text-xs" /> Edit
              </button>
              {/* ✅ FIXED: Hide button - BLACK TEXT like Edit button */}
              <button 
                onClick={() => onToggleHide(product)} 
                className={`px-2.5 py-1 rounded-lg text-xs transition flex items-center gap-1 shadow-md font-bold text-gray-900 ${
                  product.is_hidden === 1 || product.is_hidden === true
                    ? 'bg-emerald-400 hover:bg-emerald-300' 
                    : 'bg-yellow-400 hover:bg-yellow-300'
                }`}
                title={product.is_hidden === 1 || product.is_hidden === true ? "Unhide" : "Hide"}
              >
                {product.is_hidden === 1 || product.is_hidden === true ? <FiEye className="text-xs" /> : <FiEyeOff className="text-xs" />}
                {product.is_hidden === 1 || product.is_hidden === true ? 'Unhide' : 'Hide'}
              </button>
              <button 
                onClick={() => onDeleteProduct(product.id, product.name)} 
                className="px-2.5 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 transition flex items-center gap-1 shadow-md font-bold"
              >
                <FiTrash2 className="text-xs" /> Delete
              </button>
            </>
          )}
          {!isAdmin && (
            <span className="text-xs font-bold text-gray-400">View Only</span>
          )}
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
  const [userRole, setUserRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // ✅ Pagination states
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
  
  const [formData, setFormData] = useState({
    name: '',
    purchasePrice: '',
    sellingPrice: '',
    quantity: '',
    lowStockThreshold: 5
  });
  const [viewMode, setViewMode] = useState('active');
  const [editingCell, setEditingCell] = useState({ productId: null, field: null, value: '' });

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setUserRole(userData.role);
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
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase())
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

  // ✅ Pagination - get current page items
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode, timeFilter, customDate, sortOption]);

  const summaryTotals = useMemo(() => {
    let data = filteredProducts;
    
    const totalStock = data.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalPurchaseValue = data.reduce((sum, p) => sum + ((p.purchase_price || 0) * (p.quantity || 0)), 0);
    const totalSellingValue = data.reduce((sum, p) => sum + ((p.selling_price || 0) * (p.quantity || 0)), 0);
    const totalProfit = data.reduce((sum, p) => sum + (((p.selling_price || 0) - (p.purchase_price || 0)) * (p.quantity || 0)), 0);
    
    return {
      totalStock,
      totalPurchaseValue,
      totalSellingValue,
      totalProfit
    };
  }, [filteredProducts]);

  const calculateFilteredStats = useCallback((productsList, filter, customDateVal = null) => {
    const range = getDateRange(filter, customDateVal);
    if (!range || filter === 'all') {
      const stats = productsList.reduce((acc, product) => {
        if (product.is_hidden === true) return acc;
        acc.totalPurchase += (product.purchase_price || 0) * (product.quantity || 0);
        acc.totalSelling += (product.selling_price || 0) * (product.quantity || 0);
        acc.totalProfit += ((product.selling_price || 0) - (product.purchase_price || 0)) * (product.quantity || 0);
        return acc;
      }, { totalPurchase: 0, totalSelling: 0, totalProfit: 0 });
      return stats;
    }
    
    const filtered = productsList.filter(product => {
      if (product.is_hidden === true) return false;
      if (!product.date_added) return false;
      const prodDate = new Date(product.date_added);
      return prodDate >= range.start && prodDate <= range.end;
    });
    
    const stats = filtered.reduce((acc, product) => {
      acc.totalPurchase += (product.purchase_price || 0) * (product.quantity || 0);
      acc.totalSelling += (product.selling_price || 0) * (product.quantity || 0);
      acc.totalProfit += ((product.selling_price || 0) - (product.purchase_price || 0)) * (product.quantity || 0);
      return acc;
    }, { totalPurchase: 0, totalSelling: 0, totalProfit: 0 });
    
    return stats;
  }, []);

  useEffect(() => {
    const stats = calculateFilteredStats(products, timeFilter, customDate || null);
    setFilteredStats(stats);
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
      'default': 'Default',
      'name-asc': 'A → Z',
      'name-desc': 'Z → A',
      'price-asc': 'Price: Low → High',
      'price-desc': 'Price: High → Low'
    };
    return labels[sortOption] || 'Default';
  };

  const fetchProducts = useCallback(async () => {
    const abortController = new AbortController();
    setLoading(true);
    try {
      const response = await api.get('/products', {
        signal: abortController.signal,
        params: {
          show_hidden: 'true'
        }
      });
      
      let productsData = [];
      
      if (response.data?.success && Array.isArray(response.data.data)) {
        productsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        productsData = response.data;
      } else {
        productsData = [];
      }
      
      setProducts(productsData);
      
      const stats = calculateFilteredStats(productsData, timeFilter, customDate || null);
      setFilteredStats(stats);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching products:', error);
        toast.error('Failed to load products');
      }
    } finally {
      setLoading(false);
    }
    return () => abortController.abort();
  }, [calculateFilteredStats, timeFilter, customDate]);

  const debouncedSearch = useMemo(
    () => debounce((value) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  const handleSearchChange = (e) => {
    debouncedSearch(e.target.value);
  };

  const handleCustomDateChange = (e) => {
    const date = e.target.value;
    setCustomDate(date);
    if (date) {
      setTimeFilter('custom');
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddProduct = useCallback(async (productData) => {
    if (!isAdmin) {
      toast.error('Only admin can add products');
      return false;
    }
    try {
      const response = await api.post('/products', productData);
      if (response.data) {
        toast.success('Product added successfully!');
        await fetchProducts();
        return true;
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error(error.response?.data?.message || 'Failed to add product');
      return false;
    }
  }, [fetchProducts, isAdmin]);

  const handleUpdateProduct = useCallback(async (id, productData) => {
    try {
      const response = await api.put(`/products/${id}`, productData);
      if (response.data) {
        toast.success('Product updated successfully!');
        await fetchProducts();
        return true;
      }
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
    const action = newHiddenStatus === 1 ? 'hide' : 'unhide';
    
    try {
      await api.patch(`/products/${product.id}`, {
        is_hidden: newHiddenStatus
      });
      
      await fetchProducts();
      toast.success(`Product ${action}ned successfully!`);
      
      if (newHiddenStatus === 1) {
        setViewMode('hidden');
      } else {
        setViewMode('active');
      }
      
    } catch (error) {
      console.error('Error toggling product visibility:', error);
      toast.error(error.response?.data?.message || `Failed to ${action} product`);
    }
  }, [fetchProducts]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const exportToExcel = useCallback((data, filename) => {
    const exportData = data.map(p => ({
      'Product': p.name,
      ...(isAdmin && { 'Purchase Price': `Rs. ${(p.purchase_price || 0).toLocaleString()}` }),
      ...(isAdmin && { 'Selling Price': `Rs. ${(p.selling_price || 0).toLocaleString()}` }),
      'Stock': p.quantity || 0,
      ...(isAdmin && { 'Low Stock At': p.low_stock_threshold ?? 5 }),
      'Invoice No': '-',
      'Vendor': '-',
      'Status': p.is_hidden === true ? 'Hidden' : 'Active'
    }));
    
    const summaryRow = {
      'Product': '📊 TOTAL',
      ...(isAdmin && { 'Purchase Price': `Rs. ${summaryTotals.totalPurchaseValue.toLocaleString()}` }),
      ...(isAdmin && { 'Selling Price': `Rs. ${summaryTotals.totalSellingValue.toLocaleString()}` }),
      'Stock': summaryTotals.totalStock,
      ...(isAdmin && { 'Low Stock At': '-' }),
      'Invoice No': '-',
      'Vendor': '-',
      'Status': ''
    };
    exportData.push(summaryRow);
    
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
    head.push('Invoice No', 'Vendor');
    head.push('Status');
    
    const body = data.map(p => {
      const row = [p.name || ''];
      if (isAdmin) row.push(`Rs. ${(p.purchase_price || 0).toLocaleString()}`, `Rs. ${(p.selling_price || 0).toLocaleString()}`);
      row.push(p.quantity || 0);
      if (isAdmin) row.push(p.low_stock_threshold ?? 5);
      row.push('-', '-');
      row.push(p.is_hidden === true ? 'Hidden' : 'Active');
      return row;
    });
    
    const summaryRow = ['📊 TOTAL'];
    if (isAdmin) {
      summaryRow.push(`Rs. ${summaryTotals.totalPurchaseValue.toLocaleString()}`);
      summaryRow.push(`Rs. ${summaryTotals.totalSellingValue.toLocaleString()}`);
    }
    summaryRow.push(summaryTotals.totalStock);
    if (isAdmin) summaryRow.push('-');
    summaryRow.push('-', '-');
    summaryRow.push('');
    body.push(summaryRow);
    
    doc.autoTable({
      head: [head],
      body: body,
      startY: 20,
    });
    doc.save(`${title}.pdf`);
    toast.success('Exported to PDF');
  }, [isAdmin, summaryTotals]);

  const handleInputChange = useCallback((e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Only admin can add products');
      return;
    }
    
    if (!formData.name || !formData.purchasePrice || !formData.sellingPrice || !formData.quantity) {
      toast.error('Please fill all fields');
      return;
    }

    const purchasePriceNum = parseFloat(formData.purchasePrice);
    const sellingPriceNum = parseFloat(formData.sellingPrice);
    const quantityNum = parseInt(formData.quantity);
    const thresholdNum = parseInt(formData.lowStockThreshold) || 5;

    if (isNaN(purchasePriceNum) || isNaN(sellingPriceNum) || isNaN(quantityNum)) {
      toast.error('Please enter valid numbers');
      return;
    }

    if (purchasePriceNum < 0 || sellingPriceNum < 0 || quantityNum < 0 || thresholdNum < 0) {
      toast.error('Values cannot be negative');
      return;
    }

    const success = await handleAddProduct({
      name: formData.name,
      purchase_price: purchasePriceNum,
      selling_price: sellingPriceNum,
      quantity: quantityNum,
      low_stock_threshold: thresholdNum
    });

    if (success) {
      setFormData({ name: '', purchasePrice: '', sellingPrice: '', quantity: '', lowStockThreshold: 5 });
      setIsModalOpen(false);
    }
  }, [formData, handleAddProduct, isAdmin]);

  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      purchasePrice: product.purchase_price,
      sellingPrice: product.selling_price,
      quantity: product.quantity,
      lowStockThreshold: product.low_stock_threshold ?? 5
    });
    setIsModalOpen(true);
  }, []);

  const handleUpdateSubmit = useCallback(async (e) => {
    e.preventDefault();
    
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
      
      const success = await handleUpdateProduct(editingProduct.id, {
        quantity: quantityNum
      });
      
      if (success) {
        setFormData({ name: '', purchasePrice: '', sellingPrice: '', quantity: '', lowStockThreshold: 5 });
        setEditingProduct(null);
        setIsModalOpen(false);
      }
      return;
    }
    
    if (!formData.name || !formData.purchasePrice || !formData.sellingPrice || !formData.quantity) {
      toast.error('Please fill all fields');
      return;
    }

    const purchasePriceNum = parseFloat(formData.purchasePrice);
    const sellingPriceNum = parseFloat(formData.sellingPrice);
    const quantityNum = parseInt(formData.quantity);
    const thresholdNum = parseInt(formData.lowStockThreshold) || 5;

    if (isNaN(purchasePriceNum) || isNaN(sellingPriceNum) || isNaN(quantityNum) || isNaN(thresholdNum)) {
      toast.error('Please enter valid numbers');
      return;
    }

    if (purchasePriceNum < 0 || sellingPriceNum < 0 || quantityNum < 0 || thresholdNum < 0) {
      toast.error('Values cannot be negative');
      return;
    }

    const success = await handleUpdateProduct(editingProduct.id, {
      name: formData.name,
      purchase_price: purchasePriceNum,
      selling_price: sellingPriceNum,
      quantity: quantityNum,
      low_stock_threshold: thresholdNum
    });

    if (success) {
      setFormData({ name: '', purchasePrice: '', sellingPrice: '', quantity: '', lowStockThreshold: 5 });
      setEditingProduct(null);
      setIsModalOpen(false);
    }
  }, [formData, editingProduct, handleUpdateProduct, isAdmin]);

  const startInlineEdit = useCallback(({ productId, field, value }) => {
    setEditingCell({ productId, field, value });
  }, []);

  const saveInlineEdit = useCallback(async (productId, field) => {
    let newValue;
    const productToUpdate = products.find(p => p.id === productId);
    
    if (!isAdmin && field !== 'quantity') {
      toast.error('You can only update stock quantity');
      setEditingCell({ productId: null, field: null, value: '' });
      return;
    }
    
    if (field === 'name') {
      newValue = editingCell.value.trim();
      if (!newValue) {
        toast.error('Product name cannot be empty');
        setEditingCell({ productId: null, field: null, value: '' });
        return;
      }
    } else if (field === 'quantity' || field === 'lowStockThreshold') {
      newValue = parseInt(editingCell.value);
      if (isNaN(newValue) || newValue < 0) {
        toast.error('Please enter a valid positive number');
        setEditingCell({ productId: null, field: null, value: '' });
        return;
      }
    } else {
      newValue = parseFloat(editingCell.value);
      if (isNaN(newValue) || newValue < 0) {
        toast.error('Please enter a valid positive number');
        setEditingCell({ productId: null, field: null, value: '' });
        return;
      }
    }

    const updateData = {
      name: productToUpdate.name,
      purchase_price: productToUpdate.purchase_price,
      selling_price: productToUpdate.selling_price,
      quantity: productToUpdate.quantity,
      low_stock_threshold: productToUpdate.low_stock_threshold ?? 5
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
    setEditingCell({ productId: null, field: null, value: '' });
  }, [editingCell, products, fetchProducts, isAdmin]);

  const handleKeyPress = useCallback((e, productId, field) => {
    if (e.key === 'Enter') {
      saveInlineEdit(productId, field);
    } else if (e.key === 'Escape') {
      setEditingCell({ productId: null, field: null, value: '' });
    }
  }, [saveInlineEdit]);

  const formatPrice = useCallback((price) => {
    return `Rs. ${price?.toLocaleString() || 0}`;
  }, []);

  const getProductCount = () => {
    let filtered = products;
    if (viewMode === 'active') {
      filtered = filtered.filter(p => p.is_hidden !== true);
    } else if (viewMode === 'hidden') {
      filtered = filtered.filter(p => p.is_hidden === true);
    }
    filtered = filterProductsByDate(filtered, timeFilter, customDate || null);
    return filtered.length;
  };

  const getViewModeText = () => {
    if (viewMode === 'active') return 'active';
    if (viewMode === 'hidden') return 'hidden';
    return 'all';
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-950' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-5xl text-amber-400 animate-spin mx-auto mb-4" />
          <p className={`${darkMode ? 'text-white' : 'text-gray-700'}`}>Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* FILTER BUTTONS */}
      <div className={`flex flex-wrap items-center gap-1.5 p-3 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <span className={`text-xs font-bold mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Filter:</span>
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
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
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
          onClick={() => setShowCustomDate(!showCustomDate)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
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
        <span className={`ml-auto text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Showing: <strong className={darkMode ? 'text-white' : 'text-gray-800'}>{getFilterLabel()}</strong>
        </span>
      </div>

      {/* SORTING BUTTONS */}
      <div className={`flex flex-wrap items-center gap-1.5 p-3 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <span className={`text-xs font-bold mr-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Sort:</span>
        {[
          { key: 'default', label: 'Default' },
          { key: 'name-asc', label: 'A → Z' },
          { key: 'name-desc', label: 'Z → A' },
          { key: 'price-asc', label: 'Price: Low → High' },
          { key: 'price-desc', label: 'Price: High → Low' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setSortOption(f.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-0.5 ${
              sortOption === f.key 
                ? 'bg-amber-400 text-gray-900 shadow-md' 
                : darkMode 
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.key === 'name-asc' && <FiArrowUp className="text-xs" />}
            {f.key === 'name-desc' && <FiArrowDown className="text-xs" />}
            {f.label}
          </button>
        ))}
        <span className={`ml-auto text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Sorting: <strong className={darkMode ? 'text-white' : 'text-gray-800'}>{getSortLabel()}</strong>
        </span>
      </div>

      {/* STATISTICS CARDS - Bold + Dark Mode */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-full bg-blue-500/15">
                <FiShoppingCart className="text-sm text-blue-400" />
              </div>
              <span className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getStatsLabelText()} Purchase</span>
            </div>
            <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {filteredStats.totalPurchase.toLocaleString()}</p>
            <p className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{getStatsLabelText().toLowerCase()} purchases</p>
          </div>
          
          <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-full bg-amber-500/15">
                <FiDollarSign className="text-sm text-amber-400" />
              </div>
              <span className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getStatsLabelText()} Selling</span>
            </div>
            <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {filteredStats.totalSelling.toLocaleString()}</p>
            <p className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{getStatsLabelText().toLowerCase()} sales</p>
          </div>
          
          <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-full bg-emerald-500/15">
                <FiTrendingUp className="text-sm text-emerald-400" />
              </div>
              <span className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getStatsLabelText()} Profit</span>
            </div>
            <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {filteredStats.totalProfit.toLocaleString()}</p>
            <p className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{getStatsLabelText().toLowerCase()} profit</p>
          </div>
        </div>
      )}

      {/* MAIN TABLE */}
      <div className={`rounded-xl overflow-hidden border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap justify-between items-center gap-3`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            <FiPackage className="text-amber-400" />
            Products Inventory
            <span className={`text-xs font-bold ml-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
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
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600">
                  <FiX className="text-sm" />
                </button>
              )}
            </div>
            
            <button 
              onClick={() => setViewMode('active')} 
              className={`px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-md font-bold text-white ${
                viewMode === 'active' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              <FiEye className="text-xs" /> Active
            </button>
            
            <button 
              onClick={() => setViewMode('hidden')} 
              className={`px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-md font-bold text-white ${
                viewMode === 'hidden' 
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              <FiEyeOff className="text-xs" /> Hidden
            </button>
            
            <button 
              onClick={() => setViewMode('all')} 
              className={`px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-md font-bold text-white ${
                viewMode === 'all' 
                  ? 'bg-emerald-600 hover:bg-emerald-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
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
                <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Product</th>
                {isAdmin && (
                  <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Purchase</th>
                )}
                {isAdmin && (
                  <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Selling</th>
                )}
                <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Stock</th>
                {isAdmin && (
                  <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Alert At</th>
                )}
                <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Invoice</th>
                <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Vendor</th>
                <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {currentProducts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 5} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FiPackage className="text-4xl text-gray-400" />
                      <p className={`text-sm font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
                      formatPrice={formatPrice}
                      isAdmin={isAdmin}
                    />
                  ))}
                  
                  {/* SUMMARY ROW */}
                  <tr className={`${darkMode ? 'bg-gray-800' : 'bg-gray-100'} border-t-2 ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-sm flex items-center gap-2">
                        <FiBarChart2 className="text-amber-400" />
                        <span className={darkMode ? 'text-white' : 'text-gray-900'}>📊 TOTAL</span>
                      </div>
                    </td>
                    
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-blue-400 text-sm">
                          Rs. {summaryTotals.totalPurchaseValue.toLocaleString()}
                        </div>
                      </td>
                    )}
                    
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-amber-400 text-sm">
                          Rs. {summaryTotals.totalSellingValue.toLocaleString()}
                        </div>
                      </td>
                    )}
                    
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-base flex items-center gap-1">
                        <span className={darkMode ? 'text-white' : 'text-gray-900'}>{summaryTotals.totalStock}</span>
                        <span className="text-xs font-bold text-gray-400">units</span>
                      </div>
                    </td>
                    
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-bold text-gray-400">-</span>
                      </td>
                    )}
                    
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-bold text-gray-400">-</span>
                    </td>
                    
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-bold text-gray-400">-</span>
                    </td>
                    
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Stock: {summaryTotals.totalStock}</span>
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
        
        {/* ✅ PAGINATION */}
        {filteredProducts.length > itemsPerPage && (
          <div className={`px-4 py-3 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap justify-between items-center gap-3`}>
            <div className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredProducts.length)} of {filteredProducts.length} entries
            </div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  currentPage === 1 
                    ? 'opacity-50 cursor-not-allowed' 
                    : darkMode 
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FiChevronLeft className="text-sm" /> Prev
              </button>
              
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                  if (i === 4) return <span key="dots" className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>...</span>;
                } else if (currentPage >= totalPages - 2) {
                  if (i === 0) return <span key="dots" className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>...</span>;
                  pageNum = totalPages - 4 + i;
                } else {
                  if (i === 0) return <span key="dots1" className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>...</span>;
                  if (i === 4) return <span key="dots2" className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>...</span>;
                  pageNum = currentPage - 1 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      currentPage === pageNum
                        ? 'bg-amber-400 text-gray-900 shadow-md'
                        : darkMode
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  currentPage === totalPages 
                    ? 'opacity-50 cursor-not-allowed' 
                    : darkMode 
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Next <FiChevronRight className="text-sm" />
              </button>
            </div>
          </div>
        )}
        
        {/* SUMMARY FOOTER */}
        <div className={`px-4 py-2 border-t ${darkMode ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Products:</span>
                <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{filteredProducts.length}</span>
              </div>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Stock:</span>
                <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{summaryTotals.totalStock}</span>
              </div>
              {isAdmin && (
                <>
                  <div className="w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Purchase:</span>
                    <span className={`text-sm font-bold text-blue-400`}>Rs. {summaryTotals.totalPurchaseValue.toLocaleString()}</span>
                  </div>
                  <div className="w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Selling:</span>
                    <span className={`text-sm font-bold text-amber-400`}>Rs. {summaryTotals.totalSellingValue.toLocaleString()}</span>
                  </div>
                  <div className="w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Profit:</span>
                    <span className={`text-sm font-bold ${summaryTotals.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Rs. {summaryTotals.totalProfit.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
            {isAdmin && (
              <div className={`text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-gray-500'} italic`}>
                * Based on current stock × price
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Product Modal - Bold */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-center`}>
              <h3 className="text-xl font-bold">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingProduct(null); setFormData({ name: '', purchasePrice: '', sellingPrice: '', quantity: '', lowStockThreshold: 5 }); }} className="text-gray-500 hover:text-gray-700 text-2xl">
                <FiX />
              </button>
            </div>
            
            <form onSubmit={editingProduct ? handleUpdateSubmit : handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Product Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} 
                  placeholder="Enter product name" 
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Purchase Price * (Rs.)</label>
                <input 
                  type="number" 
                  name="purchasePrice" 
                  value={formData.purchasePrice} 
                  onChange={handleInputChange} 
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} 
                  placeholder="Enter purchase price" 
                  min="0" 
                  step="0.01" 
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Selling Price * (Rs.)</label>
                <input 
                  type="number" 
                  name="sellingPrice" 
                  value={formData.sellingPrice} 
                  onChange={handleInputChange} 
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} 
                  placeholder="Enter selling price" 
                  min="0" 
                  step="0.01" 
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Stock Quantity *</label>
                <input 
                  type="number" 
                  name="quantity" 
                  value={formData.quantity} 
                  onChange={handleInputChange} 
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} 
                  placeholder="Enter stock quantity" 
                  min="0" 
                  required 
                />
              </div>

              <div>
                <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Low Stock Alert At
                  <span className="text-xs ml-1 opacity-60">(Default: 5)</span>
                </label>
                <input 
                  type="number" 
                  name="lowStockThreshold" 
                  value={formData.lowStockThreshold} 
                  onChange={handleInputChange} 
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} 
                  placeholder="Alert when stock below" 
                  min="0" 
                />
                <p className={`text-xs font-bold mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  ⚠️ UI alert only - No email will be sent
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setIsModalOpen(false); setEditingProduct(null); setFormData({ name: '', purchasePrice: '', sellingPrice: '', quantity: '', lowStockThreshold: 5 }); }} 
                  className={`flex-1 px-4 py-2 rounded-lg transition font-bold ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-300 transition flex items-center justify-center gap-2 shadow-md font-bold"
                >
                  <FiCheckCircle className="text-sm" /> 
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;