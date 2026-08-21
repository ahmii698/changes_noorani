// src/components/Reminders.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  FiBell, FiDollarSign, FiEdit2, FiCheck, FiX, 
  FiRefreshCw, FiClock, FiEye, FiLoader, FiUsers, FiFileText, FiTrendingUp
} from 'react-icons/fi';
import api from '../services/api';

// ✅ Bank Names List - Same as Billing
const BANK_NAMES = [
  { value: 'allied', label: 'Allied Bank' },
  { value: 'alfalah', label: 'Bank Alfalah' },
  { value: 'hbl', label: 'HBL (Habib Bank Limited)' },
  { value: 'meezan', label: 'Meezan Bank' },
  { value: 'ubl', label: 'UBL (United Bank Limited)' },
];

const Reminders = ({ darkMode }) => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedBank, setSelectedBank] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // ✅ Payment History States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ✅ Check user role on mount
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setIsAdmin(userData.role === 'admin');
    }
  }, []);

  // ✅ Get payment method display with bank name
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

  // ✅ Fetch pending payments
  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pending-payments');
      setPendingPayments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      toast.error('Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Auto-refresh every 3 hours
  useEffect(() => {
    fetchPendingPayments();
    const interval = setInterval(fetchPendingPayments, 10800000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Fetch payment history for specific invoice
  const fetchPaymentHistory = async (invoiceNo) => {
    setLoadingHistory(true);
    setSelectedInvoiceNo(invoiceNo);
    try {
      const response = await api.get(`/payment-history/${invoiceNo}`);
      if (response.data.success) {
        setPaymentHistory(response.data.data);
        setShowHistoryModal(true);
      } else {
        toast.error('Failed to fetch payment history');
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('Failed to load payment history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // ✅ Handle payment update
  const handlePaymentUpdate = async () => {
    if (!isAdmin) {
      toast.error('Only admin can record payments');
      return;
    }
    
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount > selectedPayment.remaining_amount) {
      toast.error(`Amount cannot exceed remaining balance: Rs. ${selectedPayment.remaining_amount.toLocaleString()}`);
      return;
    }

    if (paymentMethod === 'bank' && !selectedBank) {
      toast.error('Please select a bank for bank transfer');
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentMethodDisplay = getPaymentMethodDisplay();
      const currentDateTime = new Date().toISOString();
      
      await api.put(`/pending-payments/${selectedPayment.id}`, { 
        amount,
        payment_method: paymentMethodDisplay,
        paid_at: currentDateTime
      });
      
      const formattedTime = new Date(currentDateTime).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Karachi'
      });
      
      toast.success(`✅ Rs. ${amount.toLocaleString()} payment recorded via ${paymentMethodDisplay} at ${formattedTime}!`);
      setShowPaymentModal(false);
      setSelectedPayment(null);
      setPaymentAmount('');
      setPaymentMethod('cash');
      setSelectedBank('');
      fetchPendingPayments();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error(error.response?.data?.message || 'Failed to update payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentModal = (payment) => {
    if (!isAdmin) {
      toast.error('Only admin can record payments');
      return;
    }
    setSelectedPayment(payment);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setSelectedBank('');
    setShowPaymentModal(true);
  };

  // Stats calculations
  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.remaining_amount || 0), 0);
  const totalCustomers = pendingPayments.length;
  const totalInvoices = pendingPayments.filter(p => p.invoice_no).length;
  const avgPending = totalCustomers > 0 ? Math.round(totalPending / totalCustomers) : 0;

  if (loading) {
    return (
      <div className={`min-h-[400px] flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <FiLoader className="text-5xl text-amber-400 animate-spin mx-auto mb-4" />
          <p className={`${darkMode ? 'text-white' : 'text-gray-700'}`}>Loading pending payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header - Amber Theme */}
      <div className={`flex items-center justify-between flex-wrap gap-4 p-5 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <FiBell className="text-2xl text-amber-400" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Pending Payments</h1>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {isAdmin ? 'Manage all pending payments' : 'View pending payments'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchPendingPayments}
          disabled={refreshing}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
            refreshing ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-amber-400 hover:bg-amber-300 text-gray-900'
          } shadow-md`}
        >
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Content - Amber Theme */}
      <div className={`rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="p-5">
          {pendingPayments.length === 0 ? (
            <div className="text-center py-12">
              <FiDollarSign className="text-5xl text-gray-400 mx-auto mb-4" />
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No pending payments
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                All payments are up to date!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Phone</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Invoice #</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Paid</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Pending</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                  {pendingPayments.map((item, index) => (
                    <tr key={item.id || index} className={darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3.5 text-sm text-center text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3.5">
                        <span className={`font-medium text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {item.customer_name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        <span className={darkMode ? 'text-white' : 'text-gray-700'}>
                          {item.customer_phone || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-sm font-mono font-semibold ${darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                          {item.invoice_no}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-base">
                        <span className={darkMode ? 'text-white' : 'text-gray-700'}>
                          Rs. {item.total_amount?.toLocaleString() || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-base text-emerald-600 dark:text-emerald-400">
                        Rs. {item.paid_amount?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${
                          item.remaining_amount > 0 ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
                        }`}>
                          Rs. {item.remaining_amount?.toLocaleString() || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isAdmin && (
                            <button
                              onClick={() => openPaymentModal(item)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                                darkMode ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              <FiEdit2 className="text-sm" />
                              Record
                            </button>
                          )}
                          <button
                            onClick={() => fetchPaymentHistory(item.invoice_no)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                              darkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            }`}
                            title="View Payment History"
                          >
                            <FiEye className="text-sm" />
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stats - Amber Theme */}
          {pendingPayments.length > 0 && (
            <div className={`mt-5 p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Pending</p>
                  <p className={`text-xl font-bold text-red-500`}>
                    Rs. {totalPending.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Customers</p>
                  <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {totalCustomers}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Invoices</p>
                  <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {totalInvoices}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Avg Pending</p>
                  <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Rs. {avgPending.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`text-center text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        Auto-checks every 3 hours • {new Date().toLocaleTimeString()}
      </div>

      {/* ✅ Payment Modal - Amber Theme */}
      {showPaymentModal && selectedPayment && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-xl shadow-xl max-w-md w-full border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className={`px-5 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex justify-between items-center`}>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FiDollarSign className="text-xl text-amber-400" />
                Record Payment
              </h3>
              <button 
                onClick={() => { setShowPaymentModal(false); setSelectedPayment(null); setPaymentAmount(''); setPaymentMethod('cash'); setSelectedBank(''); }} 
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <FiX className="text-xl" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Customer</p>
                <p className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedPayment.customer_name}</p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>Invoice #</p>
                <p className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedPayment.invoice_no}</p>
                <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}">
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</p>
                    <p className={`font-semibold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {selectedPayment.total_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Paid</p>
                    <p className={`font-semibold text-base text-emerald-600 dark:text-emerald-400`}>Rs. {selectedPayment.paid_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Pending</p>
                    <p className={`font-semibold text-base text-red-600 dark:text-red-400`}>Rs. {selectedPayment.remaining_amount?.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Payment Amount (Rs.)
                  <span className="text-sm text-gray-400 block mt-0.5">Max: Rs. {selectedPayment.remaining_amount?.toLocaleString()}</span>
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className={`w-full px-4 py-2.5 rounded-lg border text-base focus:ring-2 focus:ring-amber-400 outline-none transition ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300'
                  }`}
                  min="0.01"
                  max={selectedPayment.remaining_amount}
                  step="0.01"
                  autoFocus
                />
              </div>

              {/* Payment Method Dropdown */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if (e.target.value !== 'bank') {
                      setSelectedBank('');
                    }
                  }}
                  className={`w-full px-4 py-2.5 rounded-lg border text-base focus:ring-2 focus:ring-amber-400 outline-none transition ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="online">Mobile Wallet</option>
                </select>
              </div>

              {/* Bank Selection */}
              {paymentMethod === 'bank' && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Select Bank
                  </label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-lg border text-base focus:ring-2 focus:ring-amber-400 outline-none transition ${
                      darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="">-- Select Bank --</option>
                    {BANK_NAMES.map((bank) => (
                      <option key={bank.value} value={bank.value}>
                        {bank.label}
                      </option>
                    ))}
                  </select>
                  {!selectedBank && paymentMethod === 'bank' && (
                    <p className={`text-sm mt-1 ${darkMode ? 'text-red-400' : 'text-red-500'}`}>
                      ⚠️ Please select a bank
                    </p>
                  )}
                  {selectedBank && paymentMethod === 'bank' && (
                    <p className={`text-sm mt-1 ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                      ✅ Selected: {BANK_NAMES.find(b => b.value === selectedBank)?.label}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); setSelectedPayment(null); setPaymentAmount(''); setPaymentMethod('cash'); setSelectedBank(''); }}
                  className={`flex-1 px-4 py-2.5 rounded-lg transition text-base font-medium ${
                    darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePaymentUpdate}
                  disabled={isSubmitting || (paymentMethod === 'bank' && !selectedBank)}
                  className={`flex-1 px-4 py-2.5 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-300 transition flex items-center justify-center gap-2 shadow-md text-base font-semibold ${
                    isSubmitting || (paymentMethod === 'bank' && !selectedBank) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <FiLoader className="animate-spin text-lg" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiCheck className="text-lg" /> Record Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Payment History Modal - Amber Theme */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-xl shadow-xl max-w-2xl w-full border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className={`px-5 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex justify-between items-center`}>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FiClock className="text-xl text-purple-400" />
                Payment History - {selectedInvoiceNo}
              </h3>
              <button 
                onClick={() => { setShowHistoryModal(false); setPaymentHistory([]); }} 
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <FiX className="text-xl" />
              </button>
            </div>
            <div className="p-6">
              {loadingHistory ? (
                <div className="text-center py-8">
                  <FiLoader className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className={`text-base ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading history...</p>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-8">
                  <FiClock className="text-4xl text-gray-400 mx-auto mb-3" />
                  <p className={`text-base ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No payment history found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">#</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Amount</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Payment Method</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Date & Time</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Received By</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                        {paymentHistory.map((payment, index) => (
                          <tr key={payment.id || index} className={darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                            <td className="px-4 py-3 text-sm text-center text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 text-base font-semibold text-emerald-600 dark:text-emerald-400">
                              Rs. {parseFloat(payment.amount).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-sm ${darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                                {payment.payment_method || 'Cash'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {payment.paid_at ? (
                                new Date(payment.paid_at).toLocaleString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                  timeZone: 'Asia/Karachi'
                                })
                              ) : (
                                <span className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>N/A</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-sm ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                Admin
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                        <tr className="font-semibold">
                          <td colSpan="1" className="px-4 py-3 text-right text-sm">Total Paid:</td>
                          <td className="px-4 py-3 text-base text-emerald-600 dark:text-emerald-400">
                            Rs. {paymentHistory.reduce((sum, p) => sum + parseFloat(p.amount), 0).toLocaleString()}
                          </td>
                          <td colSpan="3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => { setShowHistoryModal(false); setPaymentHistory([]); }}
                  className={`px-4 py-2 rounded-lg transition text-base font-medium ${
                    darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reminders;