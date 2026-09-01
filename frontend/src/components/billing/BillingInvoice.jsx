// src/components/billing/BillingInvoice.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  FiUser, FiCalendar, FiClock, FiDollarSign, 
  FiPlus, FiX, FiPrinter, FiFileText, FiDownload, FiCheckCircle, 
  FiAlertCircle, FiTool, FiPackage, FiShoppingCart, FiCreditCard,
  FiChevronDown, FiChevronUp, FiTrash2, FiEdit2, FiSave,
  FiSearch, FiGrid, FiList as FiListIcon, FiTag, FiPercent, FiLoader,
  FiBox, FiZap, FiDroplet, FiWind, FiThermometer,
  FiStar, FiHeart, FiShield, FiTruck, FiMapPin, FiPhone, FiMail,
  FiGlobe, FiLock, FiUnlock, FiSettings, FiHome, FiBriefcase, FiCoffee,
  FiMusic, FiFilm, FiBook, FiCamera, FiCode, FiDatabase, FiServer,
  FiCpu, FiHardDrive, FiMonitor,
  FiFacebook, FiInstagram, FiGift, FiArchive
} from 'react-icons/fi';
import api, { saveCart } from '../../services/api';
import logo from '/fusix.jpg';

// Icon list for dropdown
const iconOptions = [
  { name: 'Tool', icon: <FiTool size={24} />, value: 'tool' },
  { name: 'Zap', icon: <FiZap size={24} />, value: 'zap' },
  { name: 'Droplet', icon: <FiDroplet size={24} />, value: 'droplet' },
  { name: 'Wind', icon: <FiWind size={24} />, value: 'wind' },
  { name: 'Thermometer', icon: <FiThermometer size={24} />, value: 'thermometer' },
  { name: 'Star', icon: <FiStar size={24} />, value: 'star' },
  { name: 'Heart', icon: <FiHeart size={24} />, value: 'heart' },
  { name: 'Shield', icon: <FiShield size={24} />, value: 'shield' },
  { name: 'Truck', icon: <FiTruck size={24} />, value: 'truck' },
  { name: 'Map Pin', icon: <FiMapPin size={24} />, value: 'map-pin' },
  { name: 'Phone', icon: <FiPhone size={24} />, value: 'phone' },
  { name: 'Mail', icon: <FiMail size={24} />, value: 'mail' },
  { name: 'Globe', icon: <FiGlobe size={24} />, value: 'globe' },
  { name: 'Lock', icon: <FiLock size={24} />, value: 'lock' },
  { name: 'Unlock', icon: <FiUnlock size={24} />, value: 'unlock' },
  { name: 'Settings', icon: <FiSettings size={24} />, value: 'settings' },
  { name: 'Home', icon: <FiHome size={24} />, value: 'home' },
  { name: 'Briefcase', icon: <FiBriefcase size={24} />, value: 'briefcase' },
  { name: 'Coffee', icon: <FiCoffee size={24} />, value: 'coffee' },
  { name: 'Package', icon: <FiPackage size={24} />, value: 'package' },
  { name: 'Box', icon: <FiBox size={24} />, value: 'box' },
  { name: 'Tag', icon: <FiTag size={24} />, value: 'tag' },
  { name: 'Percent', icon: <FiPercent size={24} />, value: 'percent' },
  { name: 'Clock', icon: <FiClock size={24} />, value: 'clock' },
  { name: 'Calendar', icon: <FiCalendar size={24} />, value: 'calendar' },
  { name: 'Dollar', icon: <FiDollarSign size={24} />, value: 'dollar' },
  { name: 'Credit Card', icon: <FiCreditCard size={24} />, value: 'credit-card' }
];

const getIconComponent = (iconValue) => {
  const found = iconOptions.find(opt => opt.value === iconValue);
  return found ? found.icon : <FiTool size={24} />;
};

// Helper: Round to 2 decimals - ONLY FOR DISPLAY
const roundToTwo = (num) => {
  if (num === undefined || num === null || isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
};

// Get user role from localStorage
const getUserRole = () => {
  try {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      return userData?.role || 'employee';
    }
  } catch (e) {
    console.error('Error parsing user data:', e);
  }
  return 'employee';
};

// Helper function to format date as mm/dd/yyyy
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch (e) {
    return dateString;
  }
};

const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0]) - 1;
    const day = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
};

const formatDateForAPI = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
};

const loadImageAsBase64 = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

// ✅ Bank Names List
const BANK_NAMES = [
  { value: 'allied', label: 'Allied Bank' },
  { value: 'alfalah', label: 'Bank Alfalah' },
  { value: 'hbl', label: 'HBL (Habib Bank Limited)' },
  { value: 'meezan', label: 'Meezan Bank' },
  { value: 'ubl', label: 'UBL (United Bank Limited)' },
];

const BillingInvoice = ({ customerDetails, darkMode, onPaymentSuccess, restoredData }) => {
  const [cart, setCart] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedBank, setSelectedBank] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [discountNote, setDiscountNote] = useState('');
  
  const [previousVisits, setPreviousVisits] = useState([]);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    purchase_price: '',
    selling_price: '',
    quantity: ''
  });
  
  // Draft Bill states
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  
  const isProcessingRef = useRef(false);
  const paymentExecutedRef = useRef(false);
  
  const userRole = getUserRole();
  const isAdmin = userRole === 'admin';

  // Get current date
  const currentDate = new Date().toISOString().split('T')[0];

  // Check for restored data and set cart
  useEffect(() => {
    if (restoredData && restoredData.cart_items && restoredData.cart_items.length > 0) {
      const restoredItems = restoredData.cart_items.map(item => ({
        ...item,
        type: item.type || 'product',
        price: item.price || 0,
        quantity: item.quantity || 1
      }));
      setCart(restoredItems);
      toast.success(`✅ ${restoredItems.length} items restored!`);
    }
  }, [restoredData]);

  const subtotal = useMemo(() => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return roundToTwo(total);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (!discountValue || parseFloat(discountValue) <= 0) return 0;
    const val = parseFloat(discountValue);
    if (discountType === 'percentage') {
      return (subtotal * val) / 100;
    } else {
      return val;
    }
  }, [subtotal, discountValue, discountType]);

  const billTotal = useMemo(() => {
    return roundToTwo(subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const paidAmount = useMemo(() => {
    if (!paymentAmount || paymentAmount === '') return 0;
    const val = parseFloat(paymentAmount);
    if (isNaN(val)) return 0;
    return val;
  }, [paymentAmount]);

  const remainingAmount = useMemo(() => {
    return billTotal - paidAmount;
  }, [billTotal, paidAmount]);

  const isFullyPaid = useMemo(() => {
    return remainingAmount <= 0.01;
  }, [remainingAmount]);

  // ✅ Get payment method display name
  const getPaymentMethodDisplay = () => {
    if (paymentMethod === 'cash') return 'Cash';
    if (paymentMethod === 'card') return 'Credit/Debit Card';
    if (paymentMethod === 'bank') {
      const bank = BANK_NAMES.find(b => b.value === selectedBank);
      return bank ? `Bank Transfer (${bank.label})` : 'Bank Transfer';
    }
    if (paymentMethod === 'online') return 'Mobile Wallet';
    return paymentMethod;
  };

  useEffect(() => {
    const fetchPreviousVisits = async () => {
      if (!isAdmin || !customerDetails?.phone) {
        setPreviousVisits([]);
        return;
      }
      
      try {
        const response = await api.get(`/invoices/customer/${customerDetails.phone}`);
        if (response.data && Array.isArray(response.data)) {
          const visits = response.data.slice(0, 10).map(inv => ({
            id: inv.id,
            date: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : 'N/A',
            products: inv.items?.map(item => item.service_name).join(', ') || 'N/A',
            total: inv.total_amount || 0,
            status: inv.status || 'Paid'
          }));
          setPreviousVisits(visits);
        } else {
          setPreviousVisits([]);
        }
      } catch (error) {
        console.error('Error fetching previous visits:', error);
        setPreviousVisits([]);
      }
    };

    fetchPreviousVisits();
  }, [customerDetails, isAdmin]);

  // ✅ UPDATED: fetchProducts with Battery filter
  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      
      let productsArray = [];
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        productsArray = response.data.data;
      } else if (response.data && Array.isArray(response.data)) {
        productsArray = response.data;
      }
      
      if (productsArray.length > 0) {
        const visibleProducts = productsArray.filter(product => {
          const isHidden = product.is_hidden === 1 || 
                          product.is_hidden === true || 
                          product.is_hidden === '1';
          // ✅ Battery wale products ko hide karo (Billing page se)
          const isBattery = product.category === 'Battery' || 
                            product.name?.toLowerCase().includes('battery');
          return !isHidden && !isBattery;
        });
        setProducts(visibleProducts);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error('Failed to load products');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchProducts();
      setLoading(false);
    };
    loadData();
  }, []);

  // ==================== SAVE AS DRAFT FUNCTION ====================
  const handleSaveDraft = async () => {
    if (cart.length === 0) {
      toast.error('No items to save as draft');
      return;
    }

    setIsSavingDraft(true);
    try {
      const cartData = {
        cart_items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: roundToTwo(item.price),
          quantity: item.quantity,
          type: item.type || 'product',
          category: item.category || null
        })),
        cart_summary: {
          total_items: cart.reduce((sum, i) => sum + i.quantity, 0),
          total_amount: billTotal,
          subtotal: subtotal,
          discount: discountAmount
        },
        customer_phone: customerDetails.phone || '',
        customer_name: customerDetails.name || '',
        customer_email: customerDetails.email || '',
      };

      const response = await saveCart(cartData);
      if (response.success) {
        toast.success('💾 Bill saved as draft successfully!');
        setCart([]);
        setPaymentAmount('');
        setDiscountValue('');
        setDiscountNote('');
        setShowDiscount(false);
        setSelectedBank('');
        window.dispatchEvent(new Event('discarded-update'));
        if (onPaymentSuccess) onPaymentSuccess();
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // ==================== PRODUCT FUNCTIONS ====================
  const handleAddProduct = async () => {
    if (!productFormData.name || !productFormData.purchase_price || !productFormData.selling_price || !productFormData.quantity) {
      toast.error('Please fill all fields');
      return;
    }
    try {
      const payload = {
        name: productFormData.name,
        purchase_price: parseFloat(productFormData.purchase_price),
        selling_price: parseFloat(productFormData.selling_price),
        quantity: parseInt(productFormData.quantity),
        is_hidden: 0
      };
      console.log('📤 Adding product payload:', payload);
      const response = await api.post('/products', payload);
      if (response.data) {
        toast.success('Product added successfully!');
        await fetchProducts();
        setIsProductModalOpen(false);
        setProductFormData({ name: '', purchase_price: '', selling_price: '', quantity: '' });
        setEditingProduct(null);
      }
    } catch (err) {
      console.error('Error adding product:', err);
      if (err.response?.data?.errors) {
        const errors = err.response.data.errors;
        Object.keys(errors).forEach(key => {
          toast.error(`${key}: ${errors[key].join(', ')}`);
        });
      } else {
        toast.error(err.response?.data?.message || 'Failed to add product');
      }
    }
  };

  const handleUpdateProduct = async () => {
    if (!productFormData.name || !productFormData.purchase_price || !productFormData.selling_price || !productFormData.quantity) {
      toast.error('Please fill all fields');
      return;
    }
    try {
      const payload = {
        name: productFormData.name,
        purchase_price: parseFloat(productFormData.purchase_price),
        selling_price: parseFloat(productFormData.selling_price),
        quantity: parseInt(productFormData.quantity)
      };
      console.log('📤 Updating product payload:', payload);
      const response = await api.put(`/products/${editingProduct.id}`, payload);
      if (response.data) {
        toast.success('Product updated successfully!');
        await fetchProducts();
        setIsProductModalOpen(false);
        setProductFormData({ name: '', purchase_price: '', selling_price: '', quantity: '' });
        setEditingProduct(null);
      }
    } catch (err) {
      console.error('Error updating product:', err);
      if (err.response?.data?.errors) {
        const errors = err.response.data.errors;
        Object.keys(errors).forEach(key => {
          toast.error(`${key}: ${errors[key].join(', ')}`);
        });
      } else {
        toast.error(err.response?.data?.message || 'Failed to update product');
      }
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (window.confirm(`Are you sure you want to delete "${productName}"?`)) {
      try {
        await api.delete(`/products/${productId}`);
        toast.success('Product deleted successfully!');
        await fetchProducts();
      } catch (err) {
        console.error('Error deleting product:', err);
        toast.error(err.response?.data?.message || 'Failed to delete product');
      }
    }
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductFormData({ name: '', purchase_price: '', selling_price: '', quantity: '' });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      quantity: product.quantity
    });
    setIsProductModalOpen(true);
  };

  const filteredProducts = searchTerm ? 
    products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : products;

  const getProductStock = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.quantity : 0;
  };

  // Add to bill
  const addToBill = (item, type) => {
    const currentStock = type === 'product' ? getProductStock(item.id) : null;
    if (currentStock !== null && currentStock <= 0) {
      toast.error(`${item.name} is out of stock!`);
      return;
    }
    const alreadyInCart = cart.find(cartItem => cartItem.id === item.id && cartItem.type === type);
    if (alreadyInCart) {
      toast.error(`${item.name} already added to bill`);
      return;
    }
    setCart([...cart, { 
      ...item, 
      quantity: 1, 
      type: type,
      price: type === 'product' ? item.selling_price : item.price,
    }]);
    toast.success(`${item.name} added`);
  };

  const updateQuantity = (id, newQuantity, type) => {
    if (newQuantity < 1) {
      removeFromBill(id, type);
      return;
    }
    if (type === 'product') {
      const stock = getProductStock(id);
      if (newQuantity > stock + (cart.find(i => i.id === id)?.quantity || 0)) {
        toast.error(`Only ${stock} items available in stock`);
        return;
      }
    }
    setCart(cart.map(item => 
      item.id === id && item.type === type ? { ...item, quantity: newQuantity } : item
    ));
  };

  const removeFromBill = (id, type) => {
    setCart(cart.filter(item => !(item.id === id && item.type === type)));
    toast.success('Removed from bill');
  };

  const addServiceReminder = async (invoiceNo, productItems) => {
    try {
      const reminderServices = [
        'oil', 'tuning', 'engine', 'performance', 
        'ac service', 'compressor', 'filter', 'gas refill',
        'ac repair', 'cooling', 'service'
      ];
      const needsReminder = productItems.some(item => 
        reminderServices.some(service => item.name?.toLowerCase().includes(service))
      );
      if (needsReminder) {
        const customerEmail = customerDetails.email || null;
        const response = await api.post('/reminders/add', {
          invoice_no: invoiceNo,
          customer_name: customerDetails.name,
          customer_phone: customerDetails.phone,
          customer_email: customerEmail,
          car_number: customerDetails.carNumber,
          service_type: 'service'
        });
        if (response.data.success) return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding reminder:', error);
      return false;
    }
  };

  // ==================== PRINT BILL ====================
  const printBill = () => {
    if (cart.length === 0) {
      toast.error('No items to print');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    if (!printWindow) {
      toast.error('Please allow popups to print bill');
      return;
    }
    
    const invoiceDate = customerDetails.date ? new Date(customerDetails.date) : new Date();
    const formattedDate = invoiceDate.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    });
    const invoiceNo = `INV-${Date.now()}`;
    
    const cartItemsHtml = cart.map((item, idx) => `
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">Part</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right;">Rs. ${roundToTwo(item.price).toLocaleString()}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right;">Rs. ${roundToTwo(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `).join('');

    const displayDiscount = roundToTwo(discountAmount);
    const discountRowHtml = discountAmount > 0 ? `
      <tr>
        <td colspan="5" style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">Discount</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">- Rs. ${displayDiscount.toLocaleString()}</td>
      </tr>
    ` : '';

    const displayPaidAmount = roundToTwo(paidAmount);
    const displayRemainingAmount = roundToTwo(remainingAmount);

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>FusixTech - Invoice</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: #f0f0f0; 
            }
            .invoice-container { 
              max-width: 800px; 
              margin: 0 auto; 
              background: white; 
              border-radius: 12px; 
              box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
              overflow: hidden; 
            }
            .header { 
              background: white; 
              padding: 18px 20px; 
              border-bottom: 2px solid #dc2626; 
              display: flex; 
              align-items: center; 
              gap: 20px; 
            }
            .header-logo { 
              width: 70px; 
              height: 70px; 
              border-radius: 50%; 
              object-fit: cover; 
              border: 3px solid #dc2626; 
              flex-shrink: 0; 
            }
            .header-text { 
              flex: 1; 
              text-align: center; 
            }
            .header-text .shop-name { 
              font-size: 24px; 
              font-weight: bold; 
              color: #1f2937; 
              letter-spacing: 1px; 
            }
            .header-text .subtitle { 
              font-size: 13px; 
              color: #6b7280; 
            }
            .customer-info { 
              margin: 15px; 
              padding: 15px; 
              border: 1px solid #e5e7eb; 
              border-radius: 8px; 
              background: #fafafa;
            }
            .customer-info h4 { 
              margin-bottom: 8px; 
              color: #1f2937; 
              font-size: 13px; 
              font-weight: 600;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 6px;
            }
            .customer-info .info-row { 
              display: flex; 
              padding: 2px 0; 
              font-size: 12px; 
            }
            .customer-info .info-label { 
              font-weight: 600; 
              min-width: 100px; 
              color: #4b5563; 
            }
            .customer-info .info-value { 
              color: #1f2937; 
            }
            .customer-info .invoice-row {
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
              font-size: 12px;
            }
            .customer-info .invoice-row strong {
              color: #1f2937;
            }
            table { 
              width: calc(100% - 30px); 
              margin: 15px; 
              border-collapse: collapse; 
            }
            th, td { 
              border: 1px solid #e5e7eb; 
              padding: 6px 8px; 
              text-align: left; 
              font-size: 12px; 
            }
            th { 
              background: #1f2937; 
              color: white; 
              font-weight: 600; 
            }
            th:nth-child(1) { text-align: center; width: 30px; }
            th:nth-child(3) { text-align: center; width: 70px; }
            th:nth-child(4) { text-align: center; width: 40px; }
            th:nth-child(5) { text-align: right; width: 80px; }
            th:nth-child(6) { text-align: right; width: 90px; }
            td:nth-child(5) { text-align: right; }
            td:nth-child(6) { text-align: right; }
            .payment-details { 
              margin: 15px; 
              padding: 12px 15px; 
              border: 1px solid #e5e7eb; 
              border-radius: 8px; 
              background: #fafafa;
            }
            .payment-details h4 { 
              margin-bottom: 8px; 
              color: #1f2937; 
              font-size: 13px; 
              font-weight: 600;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 6px;
            }
            .payment-details .payment-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 12px;
            }
            .payment-details .payment-row.total-row {
              border-top: 2px solid #dc2626;
              padding-top: 8px;
              margin-top: 4px;
              font-size: 16px;
              font-weight: bold;
            }
            .payment-details .payment-row.total-row .total-label {
              color: #1f2937;
            }
            .payment-details .payment-row.total-row .total-amount {
              color: #dc2626;
            }
            .payment-status-paid { 
              color: #16a34a; 
              font-weight: bold; 
            }
            .payment-status-pending { 
              color: #ea580c; 
              font-weight: bold; 
            }
            .payment-status-partial { 
              color: #2563eb; 
              font-weight: bold; 
            }
            .signature { 
              margin: 15px; 
              display: flex; 
              justify-content: space-between; 
              padding-top: 20px; 
              font-size: 11px; 
            }
            .signature p {
              border-top: 1px solid #000;
              padding-top: 6px;
              min-width: 120px;
            }
            .print-actions { 
              text-align: center; 
              margin-top: 20px; 
              padding: 15px; 
              background: white; 
              border-radius: 12px; 
              max-width: 800px; 
              margin-left: auto; 
              margin-right: auto; 
            }
            .print-btn, .close-btn { 
              padding: 10px 24px; 
              border: none; 
              border-radius: 8px; 
              cursor: pointer; 
              font-size: 14px; 
              font-weight: 500; 
              margin: 0 8px; 
            }
            .print-btn { background: #dc2626; color: white; }
            .close-btn { background: #6b7280; color: white; }
            @media print { 
              body { background: white; padding: 0; } 
              .print-actions { display: none; } 
              .invoice-container { box-shadow: none; border-radius: 0; } 
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <img src="${logo}" alt="FusixTech Logo" class="header-logo" />
              <div class="header-text">
                <div class="shop-name">FUSIXTECH</div>
                <div class="subtitle">NO1 Software House</div>
              </div>
            </div>
            
            <div class="customer-info">
              <h4>CUSTOMER INFORMATION</h4>
              <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${customerDetails.name || 'N/A'}</span></div>
              <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${customerDetails.phone || 'N/A'}</span></div>
              <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${customerDetails.email || 'N/A'}</span></div>
              <div class="invoice-row">
                <span><strong>Invoice #:</strong> ${invoiceNo}</span>
                <span><strong>Date:</strong> ${formattedDate}</span>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style="text-align:center;">#</th>
                  <th>Item</th>
                  <th style="text-align:center;">Type</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Price</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${cartItemsHtml}
                ${discountRowHtml}
              </tbody>
            </table>
            
            <div class="payment-details">
              <h4>PAYMENT DETAILS</h4>
              <div class="payment-row">
                <span><strong>Subtotal:</strong></span>
                <span>Rs. ${roundToTwo(subtotal).toLocaleString()}</span>
              </div>
              ${discountAmount > 0 ? `
              <div class="payment-row">
                <span><strong>Discount:</strong></span>
                <span style="color:#dc2626;">- Rs. ${displayDiscount.toLocaleString()}</span>
              </div>
              ` : ''}
              <div class="payment-row">
                <span><strong>Total Amount:</strong></span>
                <span style="font-weight:bold;color:#dc2626;">Rs. ${roundToTwo(billTotal).toLocaleString()}</span>
              </div>
              <div class="payment-row">
                <span><strong>Paid Amount:</strong></span>
                <span style="color:#16a34a;font-weight:bold;">Rs. ${displayPaidAmount.toLocaleString()}</span>
              </div>
              <div class="payment-row">
                <span><strong>Payment Method:</strong></span>
                <span>${getPaymentMethodDisplay()}</span>
              </div>
              <div class="payment-row">
                <span><strong>Remaining Balance:</strong></span>
                <span style="color:${displayRemainingAmount > 0 ? '#ea580c' : '#16a34a'};font-weight:bold;">Rs. ${displayRemainingAmount.toLocaleString()}</span>
              </div>
              <div class="payment-row" style="border-top:1px solid #e5e7eb;padding-top:6px;margin-top:4px;">
                <span><strong>Payment Status:</strong></span>
                <span class="${isFullyPaid ? 'payment-status-paid' : (displayPaidAmount > 0 ? 'payment-status-partial' : 'payment-status-pending')}">
                  ${isFullyPaid ? 'FULLY PAID' : (displayPaidAmount > 0 ? 'PARTIAL' : 'PENDING')}
                </span>
              </div>
              <div class="payment-row total-row">
                <span class="total-label">TOTAL</span>
                <span class="total-amount">Rs. ${roundToTwo(billTotal).toLocaleString()}</span>
              </div>
            </div>
            
            <div class="signature">
              <p>Customer Signature: _________________</p>
              <p>Authorized Signature: _________________</p>
            </div>
          </div>
          <div class="print-actions">
            <button class="print-btn" onclick="window.print()">🖨️ Print Bill</button>
            <button class="close-btn" onclick="window.close()">✖ Close</button>
          </div>
          <script>setTimeout(function() { window.print(); }, 500);</script>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    toast.success('Print preview opened');
  };

  // handlePayment
  const handlePayment = async () => {
    if (isProcessingRef.current || paymentExecutedRef.current) return;
    if (cart.length === 0) {
      toast.error('No items in bill');
      return;
    }
    
    if (paymentMethod === 'bank' && !selectedBank) {
      toast.error('Please select a bank for bank transfer');
      return;
    }
    
    const exactPaidAmount = paymentAmount && paymentAmount !== '' ? parseFloat(paymentAmount) : 0;
    
    if (exactPaidAmount > billTotal) {
      toast.error(`Payment amount (Rs. ${exactPaidAmount.toLocaleString()}) cannot exceed total amount (Rs. ${billTotal.toLocaleString()})`);
      return;
    }
    
    isProcessingRef.current = true;
    paymentExecutedRef.current = true;
    setIsProcessing(true);
    
    const cartSnapshot = [...cart];
    const invoiceNo = `INV-${Date.now()}`;
    
    const roundedSubtotal = roundToTwo(subtotal);
    const roundedDiscount = roundToTwo(discountAmount);
    const roundedBillTotal = roundToTwo(billTotal);
    const exactRemainingAmount = roundedBillTotal - exactPaidAmount;
    const finalStatus = exactRemainingAmount <= 0.01 ? 'Paid' : (exactPaidAmount > 0 ? 'Partial' : 'Pending');
    
    const paymentMethodDisplay = getPaymentMethodDisplay();
    
    try {
      for (const item of cartSnapshot) {
        if (item.type === 'product') {
          const currentProduct = products.find(p => p.id === item.id);
          if (currentProduct) {
            const newQuantity = currentProduct.quantity - item.quantity;
            const finalQuantity = Math.max(0, newQuantity);
            await api.put(`/products/${item.id}`, { quantity: finalQuantity });
          }
        }
      }
      
      const customerName = customerDetails.name?.trim() || 'Guest';
      const customerPhone = customerDetails.phone?.trim() || 'N/A';
      const customerEmail = customerDetails.email?.trim() || null;
      
      const payload = {
        invoice_no: invoiceNo,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        subtotal: roundedSubtotal,
        discount: roundedDiscount,
        discount_note: discountNote?.trim() || null,
        total_amount: roundedBillTotal,
        paid_amount: roundToTwo(exactPaidAmount),
        remaining_amount: roundToTwo(exactRemainingAmount),
        payment_method: paymentMethodDisplay,
        status: finalStatus,
        invoice_date: customerDetails?.date || currentDate,
        items: cartSnapshot.map(item => ({
          service_name: item.name,
          service_category: 'Product',
          price: roundToTwo(item.price),
          quantity: item.quantity,
          mileage: null
        }))
      };
      
      console.log('📤 Sending invoice payload:', JSON.stringify(payload, null, 2));
      
      await api.post('/invoices', payload);
      
      const reminderAdded = await addServiceReminder(invoiceNo, cartSnapshot);
      if (reminderAdded) {
        toast.success(customerDetails.email ? 'Invoice created! 6-month reminder scheduled!' : 'Invoice created! Reminder saved');
      } else {
        toast.success('Invoice created successfully!');
      }
      
      setCart([]);
      setPaymentAmount('');
      setDiscountValue('');
      setDiscountNote('');
      setShowDiscount(false);
      setSelectedBank('');
      await fetchProducts();

      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err) {
      console.error('❌ Payment error:', err);
      
      if (err.response?.data?.errors) {
        const errors = err.response.data.errors;
        const errorMessages = Object.keys(errors).map(key => {
          const messages = Array.isArray(errors[key]) ? errors[key].join(', ') : errors[key];
          return `${key}: ${messages}`;
        });
        toast.error(`Validation failed: ${errorMessages.join('; ')}`);
      } else if (err.response?.data?.message) {
        toast.error(`Failed: ${err.response.data.message}`);
      } else if (err.response?.data?.error) {
        toast.error(`Failed: ${err.response.data.error}`);
      } else {
        toast.error('Failed to create invoice. Please try again.');
      }
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
        paymentExecutedRef.current = false;
        setIsProcessing(false);
      }, 3000);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-[400px] flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-5xl text-amber-400 animate-spin mx-auto mb-4" />
          <p className={`${darkMode ? 'text-white' : 'text-gray-700'}`}>Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - Amber Theme */}
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200 shadow-sm'} p-4`}>
        <div className="flex items-center gap-3">
          <img 
            src={logo} 
            alt="FusixTech Logo" 
            className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-lg flex-shrink-0"
          />
          <div className="flex-1 text-center">
            <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>FUSIXTECH</h1>
            <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>NO1 Software House</p>
          </div>
        </div>
      </div>

      {/* Customer Info - Bold + Dark Mode White */}
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200 shadow-sm'} p-4`}>
        <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Customer Details</h3>
        <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Customer information from Step 1</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={`block text-xs font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Phone Number</label>
            <input type="text" value={customerDetails.phone || ''} readOnly className={`w-full px-3 py-1.5 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`} />
          </div>
          <div>
            <label className={`block text-xs font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Customer Name</label>
            <input type="text" value={customerDetails.name || ''} readOnly className={`w-full px-3 py-1.5 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`} />
          </div>
          <div>
            <label className={`block text-xs font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email Address</label>
            <input type="email" value={customerDetails.email || ''} readOnly className={`w-full px-3 py-1.5 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`} />
          </div>
        </div>

        {isAdmin && previousVisits.length > 0 && (
          <div className="mt-4">
            <h4 className={`font-bold mb-2 flex items-center gap-2 text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              <FiClock className="text-amber-400" /> Previous Visits ({previousVisits.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
                  <tr>
                    <th className={`px-3 py-1.5 text-left font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Date</th>
                    <th className={`px-3 py-1.5 text-left font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Items</th>
                    <th className={`px-3 py-1.5 text-right font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total</th>
                    <th className={`px-3 py-1.5 text-center font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                  {previousVisits.map((visit, index) => (
                    <tr key={index} className={darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                      <td className={`px-3 py-1.5 font-medium ${darkMode ? 'text-white' : 'text-gray-700'}`}>{visit.date}</td>
                      <td className={`px-3 py-1.5 font-medium ${darkMode ? 'text-white' : 'text-gray-700'}`}>{visit.products}</td>
                      <td className={`px-3 py-1.5 text-right font-bold ${darkMode ? 'text-white' : 'text-gray-700'}`}>Rs. {visit.total.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                          {visit.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Products Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Products Section - Amber Theme */}
        <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl overflow-hidden border ${darkMode ? 'border-gray-800' : 'border-gray-200 shadow-sm'}`}>
          <div className="px-4 py-3 bg-amber-400">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FiPackage className="text-gray-900 text-lg" />
                <h3 className="text-sm font-bold text-gray-900">Parts & Accessories</h3>
              </div>
              <div className="flex gap-1.5">
                <button onClick={openAddProductModal} className="p-1.5 rounded-lg bg-gray-900/20 hover:bg-gray-900/30 transition flex items-center gap-1 text-gray-900 text-xs font-bold">
                  <FiPlus className="text-sm" /> Add
                </button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-gray-900/30' : 'hover:bg-gray-900/20'}`}>
                  <FiGrid className="text-gray-900" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-gray-900/30' : 'hover:bg-gray-900/20'}`}>
                  <FiListIcon className="text-gray-900" />
                </button>
              </div>
            </div>
            <div className="relative mt-2">
              <FiSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-700/60" />
              <input type="text" placeholder="Search parts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900/20 text-gray-900 placeholder-gray-700/60 border border-gray-900/30 focus:outline-none focus:ring-2 focus:ring-gray-900/50" />
            </div>
          </div>
          
          <div className={`p-3 max-h-[500px] overflow-y-auto ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
            {products.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FiPackage className="text-3xl mx-auto mb-2 text-gray-300" />
                <p className="text-xs font-medium">No products found.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-2">
                {filteredProducts.map(product => {
                  const stock = product.quantity;
                  const isOutOfStock = stock <= 0;
                  return (
                    <div key={product.id} className={`relative group p-3 rounded-lg transition-all duration-200 cursor-pointer ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : darkMode ? 'bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500' : 'bg-white hover:bg-amber-50 border border-gray-200 hover:border-amber-300'}`}>
                      <div onClick={() => !isOutOfStock && addToBill(product, 'product')}>
                        <FiPackage className="text-2xl mb-1.5 text-gray-500" />
                        <p className={`font-bold text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>{product.name}</p>
                        <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>Stock: {stock}</p>
                        <p className="text-amber-400 font-bold text-base mt-1.5">Rs. {product.selling_price.toLocaleString()}</p>
                        {stock < 5 && stock > 0 && <p className="text-xs font-semibold text-yellow-500 mt-0.5">Only {stock} left!</p>}
                        {isOutOfStock && <p className="text-xs font-bold text-red-500 mt-0.5">Out of stock!</p>}
                      </div>
                      {isAdmin && (
                        <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={(e) => { e.stopPropagation(); openEditProductModal(product); }} className="p-1 rounded bg-blue-500 text-white hover:bg-blue-600 text-xs font-bold">
                            <FiEdit2 size={10} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id, product.name); }} className="p-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs font-bold">
                            <FiTrash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center py-6 text-gray-500">
                    <p className="text-xs font-medium">No matching products found.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredProducts.map(product => {
                  const stock = product.quantity;
                  const isOutOfStock = stock <= 0;
                  return (
                    <div key={product.id} className={`relative group flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 cursor-pointer ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-amber-50'}`}>
                      <div onClick={() => !isOutOfStock && addToBill(product, 'product')} className="flex-1 flex items-center gap-2.5">
                        <FiPackage className="text-lg text-gray-500" />
                        <div>
                          <p className={`font-bold text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>{product.name}</p>
                          <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Stock: {stock}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400 font-bold text-xs">Rs. {product.selling_price.toLocaleString()}</p>
                        {stock < 5 && stock > 0 && <p className="text-xs font-semibold text-yellow-500">Only {stock} left!</p>}
                      </div>
                      {isAdmin && (
                        <div className="absolute right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={(e) => { e.stopPropagation(); openEditProductModal(product); }} className="p-1 rounded bg-blue-500 text-white hover:bg-blue-600 text-xs font-bold">
                            <FiEdit2 size={10} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id, product.name); }} className="p-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs font-bold">
                            <FiTrash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-xs font-medium">No matching products found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bill Section - Amber Theme with Bold Text */}
        <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl overflow-hidden border ${darkMode ? 'border-gray-800' : 'border-gray-200 shadow-sm'}`}>
          <div className="px-4 py-3 bg-amber-400">
            <div className="flex items-center gap-2">
              <FiShoppingCart className="text-gray-900 text-lg" />
              <h3 className="text-sm font-bold text-gray-900">Current Bill</h3>
              <span className="ml-auto bg-gray-900/20 px-2.5 py-0.5 rounded-full text-xs font-bold text-gray-900">{cart.length} items</span>
            </div>
          </div>
          
          <div className="p-3">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-3">
                  <FiShoppingCart className="text-3xl text-amber-400" />
                </div>
                <p className={`text-sm font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Cart is empty</p>
                <p className={`text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Click on parts to add</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-[350px] overflow-y-auto mb-3 pr-1">
                  {cart.map((item, idx) => (
                    <div key={`${item.id}-${item.type}`} className={`flex items-center justify-between p-2.5 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <span className="text-amber-400 font-bold text-xs">{idx + 1}</span>
                        </div>
                        <div>
                          <p className={`font-bold text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.name}</p>
                          <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Part • Rs. {roundToTwo(item.price).toLocaleString()} each</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 rounded-lg px-1.5 py-0.5">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.type)} className="w-5 h-5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center text-xs font-bold" disabled={isProcessing}>-</button>
                          <span className={`w-6 text-center font-bold text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.type)} className="w-5 h-5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center text-xs font-bold" disabled={isProcessing}>+</button>
                        </div>
                        <p className={`font-bold text-amber-400 min-w-[60px] text-right text-xs`}>Rs. {roundToTwo(item.price * item.quantity).toLocaleString()}</p>
                        <button onClick={() => removeFromBill(item.id, item.type)} className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition flex items-center justify-center font-bold" disabled={isProcessing}>
                          <FiTrash2 className="text-xs" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t-2 dark:border-gray-700 space-y-2">
                  <div className="flex justify-between items-center py-1">
                    <span className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total Items:</span>
                    <span className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-1">
                    <span className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Subtotal:</span>
                    <span className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-700'}`}>Rs. {roundToTwo(subtotal).toLocaleString()}</span>
                  </div>

                  <div className="py-1">
                    <button onClick={() => setShowDiscount(!showDiscount)} className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition">
                      <FiGift className="text-base" />
                      {showDiscount ? 'Hide Discount' : 'Add Discount'}
                    </button>
                    
                    {showDiscount && (
                      <div className={`mt-2 p-3 rounded-lg border ${darkMode ? 'border-amber-500/30 bg-gray-800' : 'border-amber-200 bg-amber-50'}`}>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`block text-xs font-bold mb-0.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Type</label>
                            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                              <option value="percentage">%</option>
                              <option value="fixed">Rs.</option>
                            </select>
                          </div>
                          <div>
                            <label className={`block text-xs font-bold mb-0.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Value</label>
                            <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="e.g. 10" className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} min="0" />
                          </div>
                        </div>
                        {discountAmount > 0 && (
                          <div className="mt-2 pt-2 border-t dark:border-gray-700">
                            <div className="flex justify-between items-center">
                              <span className="text-amber-400 font-bold text-xs">Discount:</span>
                              <span className="text-amber-400 font-bold text-sm">- Rs. {roundToTwo(discountAmount).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center py-1 border-t dark:border-gray-700">
                    <span className={`text-lg font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Total:</span>
                    <span className="text-xl font-bold text-amber-400">Rs. {roundToTwo(billTotal).toLocaleString()}</span>
                  </div>

                  {/* Payment Details */}
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} mt-2`}>
                    <h4 className={`font-bold mb-3 flex items-center gap-2 text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <FiCreditCard className="text-amber-400" /> Payment Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Amount (Rs.)</label>
                        <input 
                          type="text" 
                          value={paymentAmount} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            setPaymentAmount(val);
                          }} 
                          placeholder="Enter amount" 
                          className={`w-full px-3 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} 
                          disabled={isProcessing} 
                        />
                        <p className="text-xs font-medium text-gray-400 mt-0.5">Total: Rs. {billTotal.toLocaleString()}</p>
                      </div>
                      <div>
                        <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Method</label>
                        <select 
                          value={paymentMethod} 
                          onChange={(e) => {
                            setPaymentMethod(e.target.value);
                            if (e.target.value !== 'bank') {
                              setSelectedBank('');
                            }
                          }} 
                          className={`w-full px-3 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} 
                          disabled={isProcessing}
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="bank">Bank Transfer</option>
                          <option value="online">Mobile Wallet</option>
                        </select>
                      </div>
                    </div>

                    {paymentMethod === 'bank' && (
                      <div className="mt-2">
                        <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Select Bank</label>
                        <select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                          disabled={isProcessing}
                        >
                          <option value="">-- Select Bank --</option>
                          {BANK_NAMES.map((bank) => (
                            <option key={bank.value} value={bank.value}>
                              {bank.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {paidAmount > 0 && (
                      <div className="mt-3 pt-3 border-t dark:border-gray-700">
                        <div className="flex justify-between py-1 text-sm">
                          <span className="font-bold">Paid:</span>
                          <span className={`font-bold ${paidAmount > billTotal ? 'text-red-500' : 'text-emerald-600'}`}>
                            Rs. {paidAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 text-sm">
                          <span className="font-bold">Remaining:</span>
                          <span className={`font-bold ${remainingAmount > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            Rs. {remainingAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 text-sm">
                          <span className="font-bold">Status:</span>
                          <span className={`font-bold flex items-center gap-1 ${isFullyPaid ? 'text-emerald-600' : 'text-orange-500'}`}>
                            {isFullyPaid ? <FiCheckCircle /> : <FiAlertCircle />}
                            {isFullyPaid ? 'PAID' : 'PENDING'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PAY NOW + SAVE AS DRAFT - Amber Theme */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button 
                      onClick={handlePayment} 
                      disabled={isProcessing || cart.length === 0 || (paymentMethod === 'bank' && !selectedBank)} 
                      className={`px-3 py-2.5 rounded-lg font-bold transition shadow-md flex items-center justify-center gap-2 text-sm ${
                        isProcessing || cart.length === 0 || (paymentMethod === 'bank' && !selectedBank)
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-amber-400 hover:bg-amber-300 text-gray-900'
                      }`}
                    >
                      {isProcessing ? <FiLoader className="animate-spin" size={16} /> : <FiDollarSign size={16} />} 
                      <span className="truncate">{isProcessing ? 'PROCESSING...' : '💳 PAY NOW'}</span>
                    </button>
                    
                    <button 
                      onClick={handleSaveDraft} 
                      disabled={isSavingDraft || cart.length === 0} 
                      className={`px-3 py-2.5 rounded-lg font-bold transition shadow-md flex items-center justify-center gap-2 text-sm ${
                        isSavingDraft || cart.length === 0 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      }`}
                    >
                      {isSavingDraft ? <FiLoader className="animate-spin" size={16} /> : <FiArchive size={16} />} 
                      {isSavingDraft ? 'SAVING...' : '💾 SAVE AS DRAFT'}
                    </button>
                  </div>

                  {/* PRINT BUTTON */}
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button 
                      onClick={printBill} 
                      disabled={cart.length === 0}
                      className={`px-3 py-2 rounded-lg font-bold transition shadow-md flex items-center justify-center gap-2 text-sm ${
                        cart.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-white'
                      }`}
                    >
                      <FiPrinter size={16} /> 🖨️ PRINT BILL
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Product Modal - Amber Theme */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-xl shadow-xl max-w-md w-full border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className={`px-5 py-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex justify-between items-center`}>
              <h3 className="text-base font-bold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => { setIsProductModalOpen(false); setEditingProduct(null); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                <FiX className="text-xl" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Product Name *</label>
                <input type="text" value={productFormData.name} onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })} className={`w-full px-3 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} placeholder="Enter product name" />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Purchase Price * (Rs.)</label>
                <input type="number" value={productFormData.purchase_price} onChange={(e) => setProductFormData({ ...productFormData, purchase_price: e.target.value })} className={`w-full px-3 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} placeholder="Enter purchase price" min="0" step="0.01" />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Selling Price * (Rs.)</label>
                <input type="number" value={productFormData.selling_price} onChange={(e) => setProductFormData({ ...productFormData, selling_price: e.target.value })} className={`w-full px-3 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} placeholder="Enter selling price" min="0" step="0.01" />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Quantity *</label>
                <input type="number" value={productFormData.quantity} onChange={(e) => setProductFormData({ ...productFormData, quantity: e.target.value })} className={`w-full px-3 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-300'}`} placeholder="Enter quantity" min="0" />
              </div>
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => { setIsProductModalOpen(false); setEditingProduct(null); }} className={`flex-1 px-4 py-2 rounded-lg transition text-sm font-bold ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>Cancel</button>
                <button type="button" onClick={editingProduct ? handleUpdateProduct : handleAddProduct} className="flex-1 px-4 py-2 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-300 transition flex items-center justify-center gap-2 shadow-md text-sm font-bold">
                  <FiCheckCircle className="text-sm" /> {editingProduct ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingInvoice;