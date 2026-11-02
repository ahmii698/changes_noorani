// src/components/Records.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FiFileText, FiDownload, FiEye, FiPrinter, FiX, FiUser,
  FiTool, FiCalendar, FiDollarSign,
  FiCheckCircle, FiAlertCircle, FiInbox, FiList, FiClock,
  FiSearch, FiChevronLeft, FiChevronRight, FiLoader,
  FiEdit2, FiSave, FiGift, FiUsers,
  FiUserX, FiUserPlus, FiEyeOff, FiTrash2, FiAlertTriangle,
  FiRefreshCw
} from 'react-icons/fi';
import api from '../services/api';
import logo from '/fusix.jpg';

// ============================================
// DATE HELPERS (Pakistan time)
// ============================================
const toPakistanTime = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

const formatTableDate = (dateString) => {
  const date = toPakistanTime(dateString);
  if (!date) return 'N/A';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi'
  });
};

const formatInvoiceDate = (dateString) => {
  const date = toPakistanTime(dateString);
  if (!date) return 'N/A';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi'
  });
};

const formatPaymentHistoryDate = (dateString) => {
  const date = toPakistanTime(dateString);
  if (!date) return 'N/A';
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi'
  });
};

const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getStartOfWeek = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getStartOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getStartOfYear = () => {
  const date = new Date();
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const roundToTwo = (num) => {
  if (num === undefined || num === null || isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
};

// ============================================
// GENERAL HELPERS
// ============================================
const isWalkinName = (name) => !name || name === 'Guest' || name === 'Walk-in';

// Accepts a plain array or the common wrapped / paginated API shapes
const extractList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.invoices)) return data.invoices;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  return [];
};

const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');
  pages.push(total);
  return pages;
};

const HIDDEN_INVOICES_KEY = 'noorani_hidden_invoices';

const loadHiddenIds = () => {
  try {
    const saved = localStorage.getItem(HIDDEN_INVOICES_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading hidden invoices:', e);
    return [];
  }
};

const saveHiddenIds = (ids) => {
  try {
    localStorage.setItem(HIDDEN_INVOICES_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Error saving hidden invoices:', e);
  }
};

const Records = ({ darkMode }) => {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editFormData, setEditFormData] = useState({
    discountType: 'fixed',
    discountValue: '',
    discountNote: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  const [singleDate, setSingleDate] = useState('');
  const [showSingleDate, setShowSingleDate] = useState(false);

  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');

  const [hiddenIds, setHiddenIds] = useState(() => loadHiddenIds());
  const [visibilityFilter, setVisibilityFilter] = useState('active');
  const [deleteConfirmInvoice, setDeleteConfirmInvoice] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ============================================
  // FETCH INVOICES
  // Returns the transformed list so callers can use fresh data
  // ============================================
  const fetchInvoices = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await api.get('/invoices');
      const rawList = extractList(response.data);

      const transformed = rawList.map(inv => ({
        id: inv.id,
        invoiceNo: inv.invoice_no || '',
        date: inv.invoice_date || inv.created_at,
        subtotal: Number(inv.subtotal || inv.total_amount || 0),
        discount: Number(inv.discount || 0),
        discountNote: inv.discount_note || '',
        total: Number(inv.total_amount || 0),
        paidAmount: Number(inv.paid_amount || 0),
        remainingAmount: Number(inv.remaining_amount || 0),
        paymentMethod: inv.payment_method,
        status: inv.status,
        customer: {
          name: inv.customer_name,
          phone: inv.customer_phone
        },
        createdBy: inv.created_by,
        creatorName: inv.creator_name || 'System',
        creatorRole: inv.creator_role || 'system',
        items: (inv.items || []).map(item => ({
          id: item.id,
          name: item.service_name,
          category: item.service_category,
          price: Number(item.price || 0),
          quantity: item.quantity
        }))
      }));

      setInvoices(transformed);
      if (silent) toast.success('Data refreshed');
      return transformed;
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err.response?.data?.message || 'Failed to load invoices. Please check your connection.');
      toast.error('Failed to load invoices');
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const fetchPaymentHistory = useCallback(async (invoiceNo) => {
    if (!invoiceNo) {
      setPaymentHistory([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const response = await api.get(`/payment-history/${invoiceNo}`);
      if (response.data && response.data.success) {
        setPaymentHistory(response.data.data || []);
      } else {
        setPaymentHistory([]);
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
      setPaymentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // ============================================
  // HIDE / DELETE
  // ============================================
  const toggleHideInvoice = useCallback((invoiceId) => {
    const isHiddenNow = hiddenIds.includes(invoiceId);
    const updated = isHiddenNow
      ? hiddenIds.filter(id => id !== invoiceId)
      : [...hiddenIds, invoiceId];

    setHiddenIds(updated);
    saveHiddenIds(updated);
    toast.success(isHiddenNow ? 'Invoice unhidden' : 'Invoice hidden from this page');
  }, [hiddenIds]);

  const openDeleteConfirm = useCallback((invoice) => {
    setDeleteConfirmInvoice(invoice);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirmInvoice(null);
  }, []);

  const handleDeleteInvoice = useCallback(async () => {
    if (!deleteConfirmInvoice) return;

    setIsDeleting(true);
    try {
      await api.delete(`/invoices/${deleteConfirmInvoice.id}`);

      toast.success('Invoice deleted permanently');

      setInvoices(prev => prev.filter(inv => inv.id !== deleteConfirmInvoice.id));

      const updatedHidden = hiddenIds.filter(id => id !== deleteConfirmInvoice.id);
      setHiddenIds(updatedHidden);
      saveHiddenIds(updatedHidden);

      if (selectedInvoice?.id === deleteConfirmInvoice.id) {
        setIsModalOpen(false);
        setSelectedInvoice(null);
      }
      if (editingInvoice?.id === deleteConfirmInvoice.id) {
        setIsEditModalOpen(false);
        setEditingInvoice(null);
      }

      closeDeleteConfirm();
    } catch (err) {
      console.error('Error deleting invoice:', err);
      toast.error('Failed to delete invoice: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmInvoice, hiddenIds, selectedInvoice, editingInvoice, closeDeleteConfirm]);

  // ============================================
  // FILTERING
  // ============================================
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    if (visibilityFilter === 'active') {
      filtered = filtered.filter(inv => !hiddenIds.includes(inv.id));
    } else if (visibilityFilter === 'hidden') {
      filtered = filtered.filter(inv => hiddenIds.includes(inv.id));
    }

    if (dateFilter === 'single' && singleDate) {
      const startOfDay = new Date(`${singleDate}T00:00:00`);
      const endOfDay = new Date(`${singleDate}T23:59:59.999`);

      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startOfDay && invDate <= endOfDay;
      });
    } else if (dateFilter === 'custom' && customDateFrom && customDateTo) {
      const fromDate = new Date(`${customDateFrom}T00:00:00`);
      const toDate = new Date(`${customDateTo}T23:59:59.999`);

      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= fromDate && invDate <= toDate;
      });
    } else if (['today', 'week', 'month', 'year'].includes(dateFilter)) {
      const now = new Date();
      const startMap = {
        today: getToday,
        week: getStartOfWeek,
        month: getStartOfMonth,
        year: getStartOfYear
      };
      const startDate = startMap[dateFilter]();

      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startDate && invDate <= now;
      });
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        (inv.customer?.name || '').toLowerCase().includes(term) ||
        (inv.customer?.phone || '').toLowerCase().includes(term) ||
        (inv.invoiceNo || '').toLowerCase().includes(term) ||
        (inv.creatorName || '').toLowerCase().includes(term)
      );
    }

    if (filterStatus === 'paid') {
      filtered = filtered.filter(inv => inv.status === 'Paid');
    } else if (filterStatus === 'partial') {
      filtered = filtered.filter(inv => inv.status === 'Partial');
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter(inv => inv.status === 'Pending');
    }

    if (customerTypeFilter === 'walkin') {
      filtered = filtered.filter(inv => isWalkinName(inv.customer?.name));
    } else if (customerTypeFilter === 'registered') {
      filtered = filtered.filter(inv => !isWalkinName(inv.customer?.name));
    }

    return filtered;
  }, [invoices, searchTerm, filterStatus, dateFilter, customerTypeFilter, visibilityFilter, hiddenIds, customDateFrom, customDateTo, singleDate]);

  const visibleInvoices = useMemo(
    () => invoices.filter(inv => !hiddenIds.includes(inv.id)),
    [invoices, hiddenIds]
  );

  const walkinCount = useMemo(
    () => visibleInvoices.filter(inv => isWalkinName(inv.customer?.name)).length,
    [visibleInvoices]
  );

  const registeredCount = useMemo(
    () => visibleInvoices.filter(inv => !isWalkinName(inv.customer?.name)).length,
    [visibleInvoices]
  );

  const hiddenCount = useMemo(
    () => invoices.filter(inv => hiddenIds.includes(inv.id)).length,
    [invoices, hiddenIds]
  );

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentInvoices = useMemo(
    () => filteredInvoices.slice(indexOfFirstItem, indexOfLastItem),
    [filteredInvoices, indexOfFirstItem, indexOfLastItem]
  );

  // Keep the page number valid when the list shrinks (delete, filters)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleSearch = useCallback((e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((status) => {
    setFilterStatus(status);
    setCurrentPage(1);
  }, []);

  const handleDateFilterChange = useCallback((filter) => {
    setDateFilter(filter);
    setCurrentPage(1);
    if (filter === 'custom') {
      setShowCustomDate(true);
      setShowSingleDate(false);
      setSingleDate('');
    } else if (filter === 'single') {
      setShowSingleDate(true);
      setShowCustomDate(false);
      setCustomDateFrom('');
      setCustomDateTo('');
    } else {
      setShowCustomDate(false);
      setShowSingleDate(false);
      setCustomDateFrom('');
      setCustomDateTo('');
      setSingleDate('');
    }
  }, []);

  const handleCustomerTypeFilter = useCallback((type) => {
    setCustomerTypeFilter(type);
    setCurrentPage(1);
  }, []);

  const handleVisibilityFilter = useCallback((type) => {
    setVisibilityFilter(type);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const getDateFilterLabel = () => {
    const labels = {
      all: 'All Time',
      today: 'Today',
      week: 'This Week',
      month: 'This Month',
      year: 'This Year',
      single: 'Single Date',
      custom: 'Custom Range'
    };
    if (dateFilter === 'single' && singleDate) {
      return `Single Date: ${singleDate}`;
    }
    if (dateFilter === 'custom' && customDateFrom && customDateTo) {
      return `${customDateFrom} to ${customDateTo}`;
    }
    return labels[dateFilter] || 'All Time';
  };

  // ============================================
  // EDIT INVOICE
  // ============================================
  const openEditModal = useCallback((invoice) => {
    setEditingInvoice(invoice);
    setEditFormData({
      discountType: 'fixed',
      discountValue: invoice.discount > 0 ? invoice.discount.toString() : '',
      discountNote: invoice.discountNote || ''
    });
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingInvoice(null);
    setEditFormData({
      discountType: 'fixed',
      discountValue: '',
      discountNote: ''
    });
  }, []);

  const handleEditChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'discountValue') {
      const val = value.replace(/[^0-9.]/g, '');
      setEditFormData(prev => ({ ...prev, [name]: val }));
    } else {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    }
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editingInvoice) return;

    setIsSubmitting(true);

    try {
      const { discountValue, discountNote, discountType } = editFormData;

      const subtotal = editingInvoice.subtotal || editingInvoice.total;
      let discountAmount = 0;

      if (discountValue && parseFloat(discountValue) > 0) {
        const val = parseFloat(discountValue);
        discountAmount = discountType === 'percentage' ? (subtotal * val) / 100 : val;
      }

      const newTotal = subtotal - discountAmount;
      const newPaidAmount = editingInvoice.paidAmount || 0;
      const newRemainingAmount = newTotal - newPaidAmount;
      const newStatus = newRemainingAmount <= 0.01 ? 'Paid' : (newPaidAmount > 0 ? 'Partial' : 'Pending');

      const payload = {
        subtotal: subtotal,
        discount: roundToTwo(discountAmount),
        discount_note: discountNote || null,
        total_amount: roundToTwo(newTotal),
        paid_amount: roundToTwo(newPaidAmount),
        remaining_amount: roundToTwo(newRemainingAmount),
        status: newStatus,
        payment_method: editingInvoice.paymentMethod || 'cash'
      };

      const response = await api.put(`/invoices/${editingInvoice.id}`, payload);

      if (response.data) {
        toast.success('Invoice updated successfully!');

        const freshList = await fetchInvoices({ silent: false });
        const editedId = editingInvoice.id;
        const editedInvoiceNo = editingInvoice.invoiceNo;
        closeEditModal();

        if (isModalOpen && selectedInvoice?.id === editedId) {
          const updatedInvoice = freshList.find(inv => inv.id === editedId);
          if (updatedInvoice) {
            setSelectedInvoice(updatedInvoice);
          }
          fetchPaymentHistory(editedInvoiceNo);
        }
      }
    } catch (err) {
      console.error('Error updating invoice:', err);
      toast.error('Failed to update invoice: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  }, [editingInvoice, editFormData, fetchInvoices, closeEditModal, isModalOpen, selectedInvoice, fetchPaymentHistory]);

  // ============================================
  // EXPORTS
  // ============================================
  const formatExportDate = (dateString) => {
    const date = toPakistanTime(dateString) || new Date();
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Karachi'
    });
  };

  const getSafeFileLabel = () => getDateFilterLabel().replace(/[^a-zA-Z0-9_-]+/g, '_');

  const exportToExcel = useCallback(() => {
    if (filteredInvoices.length === 0) {
      toast.error('No records to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(filteredInvoices.map(inv => ({
      'Invoice #': inv.invoiceNo,
      'Date & Time': formatExportDate(inv.date),
      'Customer Name': inv.customer?.name || 'Walk-in',
      'Phone': inv.customer?.phone || 'N/A',
      'Services': inv.items.map(i => i.name).join(', '),
      'Subtotal': `Rs. ${(inv.subtotal || inv.total).toLocaleString()}`,
      'Discount': inv.discount > 0 ? `Rs. ${inv.discount.toLocaleString()}` : 'None',
      'Total': `Rs. ${inv.total.toLocaleString()}`,
      'Paid': `Rs. ${(inv.paidAmount || 0).toLocaleString()}`,
      'Remaining': `Rs. ${(inv.remainingAmount || 0).toLocaleString()}`,
      'Status': inv.status || 'Pending',
      'Created By': inv.creatorName || 'System'
    })));

    ws['!cols'] = [
      { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 40 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Records');
    XLSX.writeFile(wb, `Records_${getSafeFileLabel()}.xlsx`);
    toast.success('Exported to Excel');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredInvoices, dateFilter, singleDate, customDateFrom, customDateTo]);

  const exportToPDF = useCallback(() => {
    if (filteredInvoices.length === 0) {
      toast.error('No records to export');
      return;
    }

    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text(`All Invoice Records - ${getDateFilterLabel()}`, 14, 12);

    autoTable(doc, {
      startY: 20,
      head: [['Invoice #', 'Date & Time', 'Customer', 'Phone', 'Services', 'Subtotal', 'Discount', 'Total', 'Status', 'Created By']],
      body: filteredInvoices.map(inv => [
        inv.invoiceNo,
        formatExportDate(inv.date),
        inv.customer?.name || 'Walk-in',
        inv.customer?.phone || 'N/A',
        inv.items.map(i => i.name).join(', ').substring(0, 30) + (inv.items.length > 2 ? '...' : ''),
        `Rs. ${(inv.subtotal || inv.total).toLocaleString()}`,
        inv.discount > 0 ? `Rs. ${inv.discount.toLocaleString()}` : 'None',
        `Rs. ${inv.total.toLocaleString()}`,
        inv.status || 'Pending',
        inv.creatorName || 'System'
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [251, 191, 36], textColor: 20 }
    });

    doc.save(`Records_${getSafeFileLabel()}.pdf`);
    toast.success('Exported to PDF');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredInvoices, dateFilter, singleDate, customDateFrom, customDateTo]);

  // ============================================
  // INVOICE DETAILS MODAL
  // ============================================
  const viewInvoiceDetails = useCallback((invoice) => {
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
    fetchPaymentHistory(invoice.invoiceNo);
  }, [fetchPaymentHistory]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedInvoice(null);
    setPaymentHistory([]);
  }, []);

  // ============================================
  // PRINT SINGLE INVOICE
  // ============================================
  const printSingleInvoice = useCallback(() => {
    if (!selectedInvoice) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    if (!printWindow) {
      toast.error('Please allow popups to print the invoice');
      return;
    }

    const cartItemsHtml = selectedInvoice.items.map((item, idx) => `
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">${item.category || 'Service'}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right;">Rs. ${(item.price || 0).toLocaleString()}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right;">Rs. ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}</td>
      </tr>
    `).join('');

    const discountRowHtml = selectedInvoice.discount > 0 ? `
      <tr>
        <td colspan="5" style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">Discount ${selectedInvoice.discountNote ? `(${selectedInvoice.discountNote})` : ''}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">- Rs. ${selectedInvoice.discount.toLocaleString()}</td>
      </tr>
    ` : '';

    const isFullyPaid = selectedInvoice.status === 'Paid';
    const remainingAmount = selectedInvoice.remainingAmount || 0;
    const paidAmount = selectedInvoice.paidAmount || 0;
    const subtotal = selectedInvoice.subtotal || selectedInvoice.total;

    const invoiceDate = toPakistanTime(selectedInvoice.date) || new Date();
    const formattedDate = invoiceDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Karachi'
    });
    const formattedTime = invoiceDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Karachi'
    });
    const fullDateTime = `${formattedDate}, ${formattedTime}`;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>FusixTech - Invoice ${selectedInvoice.invoiceNo}</title>
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
            .payment-status-paid { color: #16a34a; font-weight: bold; }
            .payment-status-pending { color: #ea580c; font-weight: bold; }
            .payment-status-partial { color: #2563eb; font-weight: bold; }
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
              <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${selectedInvoice.customer?.name || 'Walk-in Customer'}</span></div>
              <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${selectedInvoice.customer?.phone || 'N/A'}</span></div>
              <div class="invoice-row">
                <span><strong>Invoice #:</strong> ${selectedInvoice.invoiceNo}</span>
                <span><strong>Date & Time:</strong> ${fullDateTime}</span>
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
                <span>Rs. ${subtotal.toLocaleString()}</span>
              </div>
              ${selectedInvoice.discount > 0 ? `
              <div class="payment-row">
                <span><strong>Discount:</strong></span>
                <span style="color:#dc2626;">- Rs. ${selectedInvoice.discount.toLocaleString()} ${selectedInvoice.discountNote ? `(${selectedInvoice.discountNote})` : ''}</span>
              </div>
              ` : ''}
              <div class="payment-row">
                <span><strong>Total Amount:</strong></span>
                <span style="font-weight:bold;color:#dc2626;">Rs. ${selectedInvoice.total.toLocaleString()}</span>
              </div>
              <div class="payment-row">
                <span><strong>Paid Amount:</strong></span>
                <span style="color:#16a34a;font-weight:bold;">Rs. ${paidAmount.toLocaleString()}</span>
              </div>
              <div class="payment-row">
                <span><strong>Payment Method:</strong></span>
                <span>${(selectedInvoice.paymentMethod || 'Cash').toUpperCase()}</span>
              </div>
              <div class="payment-row">
                <span><strong>Remaining Balance:</strong></span>
                <span style="color:${remainingAmount > 0 ? '#ea580c' : '#16a34a'};font-weight:bold;">Rs. ${remainingAmount.toLocaleString()}</span>
              </div>
              <div class="payment-row" style="border-top:1px solid #e5e7eb;padding-top:6px;margin-top:4px;">
                <span><strong>Payment Status:</strong></span>
                <span class="${isFullyPaid ? 'payment-status-paid' : (paidAmount > 0 ? 'payment-status-partial' : 'payment-status-pending')}">
                  ${isFullyPaid ? 'FULLY PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING')}
                </span>
              </div>
              <div class="payment-row total-row">
                <span class="total-label">TOTAL</span>
                <span class="total-amount">Rs. ${selectedInvoice.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div class="print-actions">
            <button class="print-btn" onclick="window.print()">Print Bill</button>
            <button class="close-btn" onclick="window.close()">Close</button>
          </div>
          <script>
            setTimeout(function() {
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    toast.success('Print preview opened');
  }, [selectedInvoice]);

  // ============================================
  // SHARED STYLE HELPERS
  // ============================================
  const inactiveBtn = darkMode
    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  const filterBtnClass = (isActive, activeClass) =>
    `px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${isActive ? activeClass : inactiveBtn}`;

  const thClass = `px-4 py-3 text-sm font-bold uppercase whitespace-nowrap ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;

  const statusBadgeClass = (status) => {
    if (status === 'Paid') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (status === 'Partial') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (status === 'Pending') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  };

  if (loading) {
    return (
      <div className={`min-h-[400px] flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-5xl text-amber-400 animate-spin mx-auto mb-4" />
          <p className={darkMode ? 'text-white' : 'text-gray-700'}>Loading invoices...</p>
        </div>
      </div>
    );
  }

  const dateButtons = [
    { key: 'all', label: 'All', active: 'bg-amber-400 text-gray-900 shadow-md' },
    { key: 'today', label: 'Today', active: 'bg-amber-400 text-gray-900 shadow-md' },
    { key: 'week', label: 'Week', active: 'bg-amber-400 text-gray-900 shadow-md' },
    { key: 'month', label: 'Month', active: 'bg-amber-400 text-gray-900 shadow-md' },
    { key: 'year', label: 'Year', active: 'bg-amber-400 text-gray-900 shadow-md' },
    { key: 'single', label: 'Single', active: 'bg-teal-500 text-white', icon: true },
    { key: 'custom', label: 'Range', active: 'bg-purple-500 text-white', icon: true }
  ];

  const statusButtons = [
    { key: 'all', label: 'All', active: 'bg-amber-400 text-gray-900 shadow-md', Icon: null },
    { key: 'paid', label: 'Paid', active: 'bg-emerald-500 text-white', Icon: FiCheckCircle },
    { key: 'partial', label: 'Partial', active: 'bg-yellow-500 text-white', Icon: FiAlertCircle },
    { key: 'pending', label: 'Pending', active: 'bg-red-500 text-white', Icon: FiClock }
  ];

  return (
    <>
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl shadow-lg overflow-hidden border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        {/* Header */}
        <div className="px-6 py-4 bg-amber-400">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <FiList className="text-gray-900 text-xl" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">All Invoices Records</h3>
                <p className="text-sm text-gray-800 flex items-center gap-1">
                  <FiFileText className="text-sm" /> Total: {invoices.length} | Showing: {filteredInvoices.length}
                  <span className="ml-2 px-2.5 py-0.5 bg-gray-900/20 rounded-full text-sm text-gray-900">
                    {getDateFilterLabel()}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={exportToExcel} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition flex items-center gap-1.5 shadow-md font-semibold">
                <FiFileText className="text-base" /> Excel
              </button>
              <button onClick={exportToPDF} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition flex items-center gap-1.5 shadow-md font-semibold">
                <FiDownload className="text-base" /> PDF
              </button>
              <button
                onClick={() => fetchInvoices({ silent: true })}
                disabled={refreshing}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition flex items-center gap-1.5 shadow-md font-semibold disabled:opacity-70"
              >
                <FiRefreshCw className={`text-base ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Visibility Filter */}
        <div className={`p-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap gap-2 items-center`}>
          <span className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-600'} flex items-center gap-1.5 mr-1`}>
            <FiEyeOff className="text-base" /> Visibility:
          </span>
          <button
            onClick={() => handleVisibilityFilter('active')}
            className={filterBtnClass(visibilityFilter === 'active', 'bg-amber-400 text-gray-900 shadow-md')}
          >
            <FiEye className="text-sm" /> Active ({invoices.length - hiddenCount})
          </button>
          <button
            onClick={() => handleVisibilityFilter('hidden')}
            className={filterBtnClass(visibilityFilter === 'hidden', 'bg-gray-700 text-white')}
          >
            <FiEyeOff className="text-sm" /> Hidden ({hiddenCount})
          </button>
        </div>

        {/* Customer Type Filter */}
        <div className={`p-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap gap-2 items-center`}>
          <span className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-600'} flex items-center gap-1.5 mr-1`}>
            <FiUsers className="text-base" /> Customer:
          </span>
          <button
            onClick={() => handleCustomerTypeFilter('all')}
            className={filterBtnClass(customerTypeFilter === 'all', 'bg-amber-400 text-gray-900 shadow-md')}
          >
            <FiUsers className="text-sm" /> All ({invoices.length})
          </button>
          <button
            onClick={() => handleCustomerTypeFilter('registered')}
            className={filterBtnClass(customerTypeFilter === 'registered', 'bg-emerald-500 text-white')}
          >
            <FiUserPlus className="text-sm" /> Registered ({registeredCount})
          </button>
          <button
            onClick={() => handleCustomerTypeFilter('walkin')}
            className={filterBtnClass(customerTypeFilter === 'walkin', 'bg-yellow-500 text-white')}
          >
            <FiUserX className="text-sm" /> Walk-in ({walkinCount})
          </button>
        </div>

        {/* Search, Date Filter and Status Filter */}
        <div className={`p-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap justify-between items-center gap-3`}>
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-base`} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearch}
              className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-amber-400 outline-none transition ${
                darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {dateButtons.map(btn => (
              <button
                key={btn.key}
                onClick={() => handleDateFilterChange(btn.key)}
                className={filterBtnClass(dateFilter === btn.key, btn.active)}
              >
                {btn.icon && <FiCalendar className="text-sm" />} {btn.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {statusButtons.map(btn => (
              <button
                key={btn.key}
                onClick={() => handleFilterChange(btn.key)}
                className={filterBtnClass(filterStatus === btn.key, btn.active)}
              >
                {btn.Icon && <btn.Icon className="text-sm" />} {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Single Date Input */}
        {showSingleDate && (
          <div className={`p-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap items-center gap-3 bg-teal-50 dark:bg-teal-900/10`}>
            <div className="flex items-center gap-1.5">
              <FiCalendar className={`${darkMode ? 'text-teal-400' : 'text-teal-600'} text-base`} />
              <span className={`text-sm font-bold ${darkMode ? 'text-teal-400' : 'text-teal-700'}`}>Date:</span>
            </div>
            <input
              type="date"
              value={singleDate}
              onChange={(e) => {
                setSingleDate(e.target.value);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-teal-500 outline-none text-sm ${
                darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            {singleDate && (
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {singleDate} ({filteredInvoices.length} records)
              </span>
            )}
          </div>
        )}

        {/* Custom Date Range Inputs */}
        {showCustomDate && (
          <div className={`p-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex flex-wrap items-center gap-3 bg-purple-50 dark:bg-purple-900/10`}>
            <div className="flex items-center gap-1.5">
              <FiCalendar className={`${darkMode ? 'text-purple-400' : 'text-purple-600'} text-base`} />
              <span className={`text-sm font-bold ${darkMode ? 'text-purple-400' : 'text-purple-700'}`}>Range:</span>
            </div>
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => {
                setCustomDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-purple-500 outline-none text-sm ${
                darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>→</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => {
                setCustomDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-purple-500 outline-none text-sm ${
                darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            {customDateFrom && customDateTo && (
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {customDateFrom} → {customDateTo} ({filteredInvoices.length})
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
              <tr>
                <th className={`${thClass} text-left`}>Invoice</th>
                <th className={`${thClass} text-left`}>Date & Time</th>
                <th className={`${thClass} text-left`}>Customer</th>
                <th className={`${thClass} text-left`}>Phone</th>
                <th className={`${thClass} text-left`}>Services</th>
                <th className={`${thClass} text-right`}>Total</th>
                <th className={`${thClass} text-right`}>Discount</th>
                <th className={`${thClass} text-center`}>Status</th>
                <th className={`${thClass} text-left`}>Created</th>
                <th className={`${thClass} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {currentInvoices.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-12 text-center">
                    <FiInbox className="text-5xl mx-auto text-gray-400" />
                    <p className={`mt-3 text-base font-bold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {error ? 'Could not load invoices' : 'No invoices found'}
                    </p>
                    <p className={`text-sm mt-1 ${error ? 'text-red-500' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {error
                        ? error
                        : searchTerm
                          ? `No results for "${searchTerm}"`
                          : visibilityFilter === 'hidden'
                            ? 'No hidden invoices'
                            : 'Create your first invoice from the Billing section'}
                    </p>
                    {error && (
                      <button
                        onClick={() => fetchInvoices()}
                        className="mt-4 px-4 py-2 bg-amber-400 text-gray-900 rounded-lg text-sm font-bold hover:bg-amber-300 transition inline-flex items-center gap-1.5"
                      >
                        <FiRefreshCw className="text-sm" /> Try Again
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                currentInvoices.map(inv => {
                  const isWalkin = isWalkinName(inv.customer?.name);
                  const isHidden = hiddenIds.includes(inv.id);

                  return (
                    <tr key={inv.id} className={`${darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'} ${isWalkin ? (darkMode ? 'bg-yellow-900/10' : 'bg-yellow-50') : ''}`}>
                      <td className={`px-4 py-3.5 font-bold whitespace-nowrap text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{inv.invoiceNo}</td>
                      <td className={`px-4 py-3.5 font-medium whitespace-nowrap text-sm ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        {formatTableDate(inv.date)}
                      </td>
                      <td className={`px-4 py-3.5 font-semibold whitespace-nowrap text-sm ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        {isWalkin ? (
                          <span className="flex items-center gap-1.5 font-bold text-yellow-600 dark:text-yellow-400">
                            <FiUserX className="text-sm" /> Walk-in
                          </span>
                        ) : (
                          inv.customer?.name
                        )}
                      </td>
                      <td className={`px-4 py-3.5 font-medium whitespace-nowrap text-sm ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        {inv.customer?.phone || 'N/A'}
                      </td>
                      <td className={`px-4 py-3.5 font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        {inv.items.slice(0, 2).map(i => i.name).join(', ')}
                        {inv.items.length > 2 && ` +${inv.items.length - 2}`}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-amber-400 text-right whitespace-nowrap text-sm">
                        Rs. {inv.total.toLocaleString()}
                      </td>
                      <td className={`px-4 py-3.5 font-semibold text-right whitespace-nowrap text-sm ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        {inv.discount > 0 ? (
                          <span className="text-red-500 font-bold">- Rs. {inv.discount.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-sm font-bold flex items-center gap-1.5 w-fit mx-auto ${statusBadgeClass(inv.status)}`}>
                          {inv.status === 'Paid' ? <FiCheckCircle className="text-sm" /> :
                            inv.status === 'Partial' ? <FiAlertCircle className="text-sm" /> :
                              <FiClock className="text-sm" />}
                          {inv.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${
                          inv.creatorRole === 'admin'
                            ? 'bg-amber-500/20 text-amber-500'
                            : inv.creatorRole === 'employee'
                              ? 'bg-blue-500/20 text-blue-500'
                              : 'bg-gray-500/20 text-gray-500'
                        }`}>
                          {inv.creatorName || 'System'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex gap-1.5 justify-center flex-wrap">
                          <button onClick={() => viewInvoiceDetails(inv)} className="px-3 py-1.5 bg-amber-400 text-gray-900 rounded-lg text-sm hover:bg-amber-300 transition flex items-center gap-1.5 shadow-md font-bold">
                            <FiEye className="text-sm" /> View
                          </button>
                          <button onClick={() => openEditModal(inv)} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition flex items-center gap-1.5 shadow-md font-semibold">
                            <FiEdit2 className="text-sm" /> Edit
                          </button>
                          <button
                            onClick={() => toggleHideInvoice(inv.id)}
                            title={isHidden ? 'Unhide' : 'Hide'}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-md ${
                              isHidden ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                          >
                            {isHidden ? <FiEye className="text-sm" /> : <FiEyeOff className="text-sm" />} {isHidden ? 'Unhide' : 'Hide'}
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(inv)}
                            title="Delete permanently"
                            className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 transition flex items-center gap-1.5 shadow-md"
                          >
                            <FiTrash2 className="text-sm" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3">
          <div className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
            {filteredInvoices.length === 0 ? 0 : indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredInvoices.length)} of {filteredInvoices.length}
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <FiChevronLeft className="text-base" />
            </button>
            {getPageNumbers(currentPage, totalPages).map((page, idx) =>
              page === '...' ? (
                <span key={`dots-${idx}`} className="px-2 py-1 text-gray-500 text-sm">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold transition ${
                    currentPage === page ? 'bg-amber-400 text-gray-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <FiChevronRight className="text-base" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* INVOICE DETAILS MODAL */}
      {/* ============================================================ */}
      {isModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${darkMode ? 'bg-gray-900' : 'bg-white'} border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            {/* Modal Header */}
            <div className={`sticky top-0 flex justify-between items-center p-4 border-b rounded-t-xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div>
                <h2 className={`text-lg font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <FiFileText className="text-lg text-amber-400" /> Invoice Details
                </h2>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{selectedInvoice.invoiceNo}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(selectedInvoice)} className="px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 transition flex items-center gap-1 shadow-md font-semibold">
                  <FiEdit2 className="text-xs" /> Edit
                </button>
                <button onClick={printSingleInvoice} className="px-2.5 py-1.5 bg-gray-800 text-white rounded-lg text-xs hover:bg-gray-700 transition flex items-center gap-1 shadow-md font-semibold">
                  <FiPrinter className="text-xs" /> Print
                </button>
                <button onClick={closeModal} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                  <FiX className="text-lg" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Customer Information */}
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'}`}>
                <h3 className={`font-bold text-base mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <FiUser className="text-base text-amber-400" /> Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Name</p>
                    <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInvoice.customer?.name || 'Walk-in Customer'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Phone</p>
                    <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInvoice.customer?.phone || 'N/A'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Date & Time</p>
                    <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatInvoiceDate(selectedInvoice.date)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Services Table */}
              <div>
                <h3 className={`font-bold text-base mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <FiTool className="text-base text-amber-400" /> Services Provided
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
                      <tr>
                        <th className={`px-3 py-1.5 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>#</th>
                        <th className={`px-3 py-1.5 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Service Name</th>
                        <th className={`px-3 py-1.5 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Category</th>
                        <th className={`px-3 py-1.5 text-right text-xs font-bold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Price</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                      {selectedInvoice.items.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className={`px-3 py-1.5 text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{idx + 1}</td>
                          <td className={`px-3 py-1.5 text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.name}</td>
                          <td className={`px-3 py-1.5 text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.category || 'Service'}</td>
                          <td className="px-3 py-1.5 text-xs font-bold text-amber-400 text-right">Rs. {item.price.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className={darkMode ? 'bg-gray-800' : 'bg-gray-100'}>
                      <tr>
                        <td colSpan="3" className={`px-3 py-2 text-right text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Subtotal:</td>
                        <td className={`px-3 py-2 text-right text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Rs. {(selectedInvoice.subtotal || selectedInvoice.total).toLocaleString()}
                        </td>
                      </tr>
                      {selectedInvoice.discount > 0 && (
                        <tr>
                          <td colSpan="3" className="px-3 py-2 text-right text-sm font-bold text-red-500">
                            Discount {selectedInvoice.discountNote ? `(${selectedInvoice.discountNote})` : ''}:
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-red-500">
                            - Rs. {selectedInvoice.discount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan="3" className="px-3 py-2 text-right text-sm font-bold text-amber-400">Total:</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-amber-400">
                          Rs. {selectedInvoice.total.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Payment Details */}
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}>
                <h3 className={`font-bold text-base mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <FiDollarSign className="text-base text-amber-400" /> Payment Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</p>
                    <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Rs. {selectedInvoice.total.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Paid</p>
                    <p className="text-lg font-bold text-emerald-500">
                      Rs. {(selectedInvoice.paidAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Remaining</p>
                    <p className="text-lg font-bold text-red-500">
                      Rs. {(selectedInvoice.remainingAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Payment Method</p>
                    <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInvoice.paymentMethod || 'Cash'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Discount</p>
                    <p className="font-bold text-base text-red-500">
                      {selectedInvoice.discount > 0 ? `Rs. ${selectedInvoice.discount.toLocaleString()}` : 'None'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status</p>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${statusBadgeClass(selectedInvoice.status)}`}>
                      {selectedInvoice.status === 'Paid' ? <FiCheckCircle className="text-xs" /> :
                        selectedInvoice.status === 'Partial' ? <FiAlertCircle className="text-xs" /> :
                          <FiClock className="text-xs" />}
                      {selectedInvoice.status === 'Paid' ? 'PAID' : selectedInvoice.status === 'Partial' ? 'PARTIAL' : 'PENDING'}
                    </span>
                  </div>
                </div>
                {selectedInvoice.discountNote && (
                  <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Discount Note</p>
                    <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedInvoice.discountNote}</p>
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-purple-900/10 border-purple-800' : 'bg-purple-50 border-purple-200'}`}>
                <h3 className={`font-bold text-base mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <FiClock className="text-base text-purple-500" /> Payment History
                </h3>
                {loadingHistory ? (
                  <div className="text-center py-4">
                    <FiLoader className="text-2xl text-purple-500 animate-spin mx-auto mb-1.5" />
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
                  </div>
                ) : paymentHistory.length === 0 ? (
                  <div className="text-center py-4">
                    <FiClock className="text-2xl text-gray-400 mx-auto mb-1.5" />
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No payment history found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={darkMode ? 'bg-purple-900/30' : 'bg-purple-100'}>
                        <tr>
                          <th className={`px-2.5 py-1.5 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>#</th>
                          <th className={`px-2.5 py-1.5 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Amount</th>
                          <th className={`px-2.5 py-1.5 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Method</th>
                          <th className={`px-2.5 py-1.5 text-left text-xs font-bold uppercase ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${darkMode ? 'divide-purple-900/30' : 'divide-purple-100'}`}>
                        {paymentHistory.map((payment, idx) => (
                          <tr key={payment.id || idx} className={darkMode ? 'hover:bg-purple-900/10' : 'hover:bg-purple-50'}>
                            <td className={`px-2.5 py-1.5 text-xs font-bold text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{idx + 1}</td>
                            <td className="px-2.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. {parseFloat(payment.amount).toLocaleString()}
                            </td>
                            <td className="px-2.5 py-1.5 text-xs">
                              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                                {payment.payment_method || 'Cash'}
                              </span>
                            </td>
                            <td className={`px-2.5 py-1.5 text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                              {formatPaymentHistoryDate(payment.paid_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className={`${darkMode ? 'bg-purple-900/30' : 'bg-purple-100'} font-bold`}>
                        <tr>
                          <td className={`px-2.5 py-1.5 text-xs font-bold text-right ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total:</td>
                          <td className="px-2.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Rs. {paymentHistory.reduce((sum, p) => sum + parseFloat(p.amount), 0).toLocaleString()}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Created By */}
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-blue-900/10 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                <h3 className={`font-bold text-base mb-2 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <FiUser className="text-base text-blue-500" /> Created By
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Name</p>
                    <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInvoice.creatorName || 'System'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Role</p>
                    <p className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInvoice.creatorRole === 'admin' ? 'Admin' : selectedInvoice.creatorRole === 'employee' ? 'Employee' : 'System'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`sticky bottom-0 flex justify-end gap-2 p-4 border-t rounded-b-xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} flex-wrap`}>
              <button onClick={closeModal} className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-bold hover:bg-gray-600 transition flex items-center gap-1">
                <FiX className="text-xs" /> Close
              </button>
              <button onClick={() => toggleHideInvoice(selectedInvoice.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-md ${hiddenIds.includes(selectedInvoice.id) ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'}`}>
                {hiddenIds.includes(selectedInvoice.id) ? <FiEye className="text-xs" /> : <FiEyeOff className="text-xs" />} {hiddenIds.includes(selectedInvoice.id) ? 'Unhide' : 'Hide'}
              </button>
              <button onClick={() => openDeleteConfirm(selectedInvoice)} className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-xs font-bold hover:bg-red-800 transition flex items-center gap-1 shadow-md">
                <FiTrash2 className="text-xs" /> Delete
              </button>
              <button onClick={() => openEditModal(selectedInvoice)} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition flex items-center gap-1 shadow-md">
                <FiEdit2 className="text-xs" /> Edit
              </button>
              <button onClick={printSingleInvoice} className="px-3 py-1.5 bg-amber-400 text-gray-900 rounded-lg text-xs font-bold hover:bg-amber-300 transition flex items-center gap-1 shadow-md">
                <FiPrinter className="text-xs" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {isEditModalOpen && editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${darkMode ? 'bg-gray-900' : 'bg-white'} border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className={`sticky top-0 flex justify-between items-center p-4 border-b rounded-t-xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div>
                <h2 className={`text-lg font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <FiEdit2 className="text-lg text-blue-500" /> Edit Invoice
                </h2>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{editingInvoice.invoiceNo} - {editingInvoice.customer?.name || 'Walk-in'}</p>
              </div>
              <button onClick={closeEditModal} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                <FiX className="text-lg" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Current Invoice Summary */}
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <h3 className={`font-bold text-base mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Current Invoice Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Subtotal</p>
                    <p className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Rs. {(editingInvoice.subtotal || editingInvoice.total).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Discount</p>
                    <p className="font-bold text-sm text-red-500">
                      {editingInvoice.discount > 0 ? `Rs. ${editingInvoice.discount.toLocaleString()}` : 'None'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</p>
                    <p className="font-bold text-sm text-amber-400">
                      Rs. {editingInvoice.total.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Paid</p>
                    <p className="font-bold text-sm text-emerald-500">
                      Rs. {(editingInvoice.paidAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Remaining</p>
                    <p className="font-bold text-sm text-red-500">
                      Rs. {(editingInvoice.remainingAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${statusBadgeClass(editingInvoice.status)}`}>
                      {editingInvoice.status || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discount Section */}
              <div className={`p-4 rounded-xl border ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-amber-200 bg-amber-50'}`}>
                <h3 className={`font-bold text-base mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <FiGift className="text-base text-amber-400" /> Add / Update Discount
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Discount Type</label>
                    <select
                      name="discountType"
                      value={editFormData.discountType}
                      onChange={handleEditChange}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    >
                      <option value="fixed">Fixed Amount (Rs.)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {editFormData.discountType === 'percentage' ? 'Discount %' : 'Discount Amount (Rs.)'}
                    </label>
                    <input
                      type="text"
                      name="discountValue"
                      value={editFormData.discountValue}
                      onChange={handleEditChange}
                      placeholder={editFormData.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                </div>

                <div className="mt-2.5">
                  <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Discount Note (Optional)</label>
                  <input
                    type="text"
                    name="discountNote"
                    value={editFormData.discountNote}
                    onChange={handleEditChange}
                    placeholder="e.g. Premium Customer Discount"
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:ring-2 focus:ring-amber-400 outline-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </div>
              </div>

              {/* Preview Changes */}
              {(() => {
                const subtotal = editingInvoice.subtotal || editingInvoice.total;
                let discountAmount = 0;
                if (editFormData.discountValue && parseFloat(editFormData.discountValue) > 0) {
                  const val = parseFloat(editFormData.discountValue);
                  discountAmount = editFormData.discountType === 'percentage' ? (subtotal * val) / 100 : val;
                }
                const newTotal = subtotal - discountAmount;
                const newPaidAmount = editingInvoice.paidAmount || 0;
                const newRemaining = newTotal - newPaidAmount;
                const newStatus = newRemaining <= 0.01 ? 'Paid' : (newPaidAmount > 0 ? 'Partial' : 'Pending');

                return (
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <h3 className={`font-bold text-base mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Preview Changes</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Subtotal</p>
                        <p className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Rs. {subtotal.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Discount</p>
                        <p className="font-bold text-sm text-red-500">
                          {discountAmount > 0 ? `- Rs. ${discountAmount.toLocaleString()}` : 'None'}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>New Total</p>
                        <p className="font-bold text-sm text-amber-400">
                          Rs. {newTotal.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>New Remaining</p>
                        <p className="font-bold text-sm text-red-500">
                          Rs. {newRemaining.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>New Status</p>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadgeClass(newStatus)}`}>
                        {newStatus === 'Paid' ? 'FULLY PAID' : newStatus === 'Partial' ? 'PARTIAL' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className={`sticky bottom-0 flex justify-end gap-2 p-4 border-t rounded-b-xl ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <button onClick={closeEditModal} className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-bold hover:bg-gray-600 transition flex items-center gap-1">
                <FiX className="text-xs" /> Cancel
              </button>
              <button onClick={handleEditSubmit} disabled={isSubmitting} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition flex items-center gap-1 shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? <FiLoader className="animate-spin text-xs" /> : <FiSave className="text-xs" />}
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`max-w-md w-full rounded-xl shadow-2xl ${darkMode ? 'bg-gray-900' : 'bg-white'} border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                <FiAlertTriangle className="text-2xl text-red-600 dark:text-red-400" />
              </div>
              <h3 className={`text-base font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Delete Permanently?
              </h3>
              <p className={`text-sm font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {deleteConfirmInvoice.invoiceNo} ({deleteConfirmInvoice.customer?.name || 'Walk-in'})
              </p>
              <p className={`text-sm font-bold mb-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={closeDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-bold hover:bg-gray-600 transition flex items-center gap-1 disabled:opacity-50"
                >
                  <FiX className="text-xs" /> Cancel
                </button>
                <button
                  onClick={handleDeleteInvoice}
                  disabled={isDeleting}
                  className="px-4 py-1.5 bg-red-700 text-white rounded-lg text-xs font-bold hover:bg-red-800 transition flex items-center gap-1 shadow-md disabled:opacity-50"
                >
                  {isDeleting ? <FiLoader className="animate-spin text-xs" /> : <FiTrash2 className="text-xs" />}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Records;