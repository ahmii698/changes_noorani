// src/components/billing/DiscardedBillsPage.jsx

import React, { useState, useEffect } from 'react';
import { 
  FiTrash2, 
  FiRefreshCw, 
  FiClock, 
  FiUser, 
  FiPhone, 
  FiMail, 
  FiTruck,
  FiPackage,
  FiDollarSign,
  FiCalendar,
  FiTool,
  FiArrowLeft,
  FiArchive,
  FiEye
} from 'react-icons/fi';
import { 
  getDiscardedCarts, 
  restoreCart, 
  deleteDiscardedCart, 
  clearAllDiscarded 
} from '../../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const DiscardedBillsPage = ({ darkMode, onRestore }) => {
  const [discardedBills, setDiscardedBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const navigate = useNavigate();

  const fetchDiscardedBills = async () => {
    setLoading(true);
    try {
      const response = await getDiscardedCarts();
      if (response.success) {
        setDiscardedBills(response.data || []);
      } else {
        setDiscardedBills([]);
      }
    } catch (error) {
      console.error('Error fetching discarded bills:', error);
      toast.error('Failed to load discarded bills');
      setDiscardedBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscardedBills();
  }, []);

  const handleRestore = async (cartId) => {
    try {
      const response = await restoreCart(cartId);
      if (response.success) {
        const restoredData = response.data;
        
        if (onRestore) {
          onRestore(restoredData);
        } else {
          localStorage.setItem('restoredBill', JSON.stringify({
            cart_items: restoredData.cart_items || [],
            customer_name: restoredData.customer_name || '',
            customer_phone: restoredData.customer_phone || '',
            customer_email: restoredData.customer_email || '',
            customer_car_number: restoredData.customer_car_number || '',
            customer_car_model: restoredData.customer_car_model || '',
            customer_birthday: restoredData.customer_birthday || '',
            cart_summary: restoredData.cart_summary || {}
          }));
        }
        
        toast.success('✅ Bill restored! Redirecting to billing...');
        setDiscardedBills(prev => prev.filter(c => c.id !== cartId));
        window.dispatchEvent(new Event('discarded-update'));
        
        setTimeout(() => {
          navigate('/billing');
        }, 500);
      }
    } catch (error) {
      console.error('Error restoring bill:', error);
      toast.error(error.response?.data?.message || 'Failed to restore bill');
    }
  };

  const handleDelete = async (cartId) => {
    if (!window.confirm('Delete this discarded bill permanently?')) return;
    try {
      const response = await deleteDiscardedCart(cartId);
      if (response.success) {
        toast.success('Bill deleted permanently');
        setDiscardedBills(prev => prev.filter(c => c.id !== cartId));
        window.dispatchEvent(new Event('discarded-update'));
      }
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast.error(error.response?.data?.message || 'Failed to delete bill');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete all discarded bills permanently?')) return;
    try {
      const response = await clearAllDiscarded();
      if (response.success) {
        toast.success(response.message || 'All discarded bills cleared');
        setDiscardedBills([]);
        window.dispatchEvent(new Event('discarded-update'));
      }
    } catch (error) {
      console.error('Error clearing bills:', error);
      toast.error(error.response?.data?.message || 'Failed to clear bills');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const getTotalItems = (cartItems) => {
    if (!cartItems || !Array.isArray(cartItems)) return 0;
    return cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const getTotalAmount = (cartSummary) => {
    if (!cartSummary) return 0;
    return cartSummary.total_amount || 0;
  };

  const getItemCount = (cartItems) => {
    if (!cartItems || !Array.isArray(cartItems)) return 0;
    return cartItems.length;
  };

  const toggleBillDetails = (id) => {
    if (selectedBill === id) {
      setSelectedBill(null);
    } else {
      setSelectedBill(id);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-950' : 'bg-gray-100'} p-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header - Amber Theme */}
        <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl shadow-xl p-6 border ${darkMode ? 'border-gray-800' : 'border-gray-200'} mb-6`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-3`}>
                <FiArchive className="text-2xl text-amber-400" />
                Drafted Bills
                <span className={`ml-2 text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  ({discardedBills.length})
                </span>
              </h1>
              <p className={`text-base font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                Bills that were discarded and can be restored
              </p>
            </div>
            <button
              onClick={() => navigate('/billing')}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                darkMode 
                  ? 'bg-amber-400 text-gray-900 hover:bg-amber-300' 
                  : 'bg-amber-400 text-gray-900 hover:bg-amber-300'
              } shadow-md`}
            >
              <FiArrowLeft className="text-base" /> Back to Billing
            </button>
          </div>
        </div>

        {/* Body - Amber Theme */}
        <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl shadow-xl p-6 border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin text-amber-400 text-4xl mb-4">⏳</div>
              <p className={`text-base font-bold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Loading discarded bills...</p>
            </div>
          ) : discardedBills.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📭</div>
              <p className={`text-lg font-bold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>No discarded bills</p>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-400'} mt-1`}>
                Go to billing page and discard a bill to see it here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {discardedBills.map((bill) => {
                const isExpanded = selectedBill === bill.id;
                const totalItems = getTotalItems(bill.cart_items);
                const totalAmount = getTotalAmount(bill.cart_summary);
                const itemCount = getItemCount(bill.cart_items);
                const hasCustomer = bill.customer_name || bill.customer_phone;

                return (
                  <div 
                    key={bill.id} 
                    className={`p-5 rounded-xl border transition-all duration-200 ${
                      darkMode 
                        ? `bg-gray-800 border-gray-700 ${isExpanded ? 'border-amber-500 ring-2 ring-amber-500/50' : 'hover:border-amber-500/40'}` 
                        : `bg-gray-50 border-gray-200 ${isExpanded ? 'border-amber-400 ring-2 ring-amber-400/50' : 'hover:border-amber-400/60'}`
                    }`}
                  >
                    <div 
                      className="cursor-pointer"
                      onClick={() => toggleBillDetails(bill.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                            }`}>
                              🗑️ Draft
                            </span>
                            <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-500'}`}>
                              {formatDate(bill.discarded_at)}
                            </span>
                            <span className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                              #{bill.id}
                            </span>
                            {hasCustomer && (
                              <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-600'}`}>
                                • {bill.customer_name || bill.customer_phone}
                              </span>
                            )}
                          </div>

                          {/* Quick Stats - Bold */}
                          <div className="mt-2 flex items-center gap-4 flex-wrap text-sm">
                            <span className={`flex items-center gap-1.5 font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              <FiPackage size={14} />
                              {itemCount} item{itemCount !== 1 ? 's' : ''}
                            </span>
                            <span className={`flex items-center gap-1.5 font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              <FiDollarSign size={14} />
                              Total: <span className="font-bold text-amber-400">Rs. {totalAmount.toLocaleString()}</span>
                            </span>
                            <span className={`flex items-center gap-1.5 font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              <FiCalendar size={14} />
                              Qty: <span className="font-bold">{totalItems}</span>
                            </span>
                          </div>

                          {/* Customer Info - Quick Preview */}
                          {hasCustomer && (
                            <div className="mt-1.5 flex items-center gap-4 flex-wrap text-sm">
                              {bill.customer_name && (
                                <span className={`flex items-center gap-1.5 font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                  <FiUser size={14} /> {bill.customer_name}
                                </span>
                              )}
                              {bill.customer_phone && (
                                <span className={`flex items-center gap-1.5 font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                  <FiPhone size={14} /> {bill.customer_phone}
                                </span>
                              )}
                              {bill.customer_car_number && (
                                <span className={`flex items-center gap-1.5 font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                  <FiTruck size={14} /> {bill.customer_car_number}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons - Amber Theme */}
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(bill.id);
                            }}
                            className={`p-2 rounded-lg transition font-bold ${
                              darkMode 
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400' 
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-600'
                            }`}
                            title="Restore this bill"
                          >
                            <FiRefreshCw size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(bill.id);
                            }}
                            className={`p-2 rounded-lg transition font-bold ${
                              darkMode 
                                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
                                : 'bg-red-100 hover:bg-red-200 text-red-600'
                            }`}
                            title="Delete this bill permanently"
                          >
                            <FiTrash2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBillDetails(bill.id);
                            }}
                            className={`p-2 rounded-lg transition font-bold ${
                              darkMode 
                                ? 'hover:bg-gray-700 text-gray-400' 
                                : 'hover:bg-gray-200 text-gray-500'
                            }`}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            <FiEye size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t dark:border-gray-700">
                        {/* Full Customer Details */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                          {bill.customer_name && (
                            <div className={`flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                              <FiUser className="text-gray-400" size={14} /> {bill.customer_name}
                            </div>
                          )}
                          {bill.customer_phone && (
                            <div className={`flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                              <FiPhone className="text-gray-400" size={14} /> {bill.customer_phone}
                            </div>
                          )}
                          {bill.customer_email && (
                            <div className={`flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                              <FiMail className="text-gray-400" size={14} /> {bill.customer_email}
                            </div>
                          )}
                          {bill.customer_car_number && (
                            <div className={`flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                              <FiTruck className="text-gray-400" size={14} /> {bill.customer_car_number}
                            </div>
                          )}
                          {bill.customer_car_model && (
                            <div className={`flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                              <FiTool className="text-gray-400" size={14} /> {bill.customer_car_model}
                            </div>
                          )}
                          {bill.customer_birthday && (
                            <div className={`flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                              <FiCalendar className="text-gray-400" size={14} /> {bill.customer_birthday}
                            </div>
                          )}
                        </div>

                        {/* Cart Items */}
                        <div className="mt-3">
                          <p className={`text-sm font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                            Cart Items ({itemCount})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {bill.cart_items && Array.isArray(bill.cart_items) && bill.cart_items.map((item, idx) => (
                              <span 
                                key={idx} 
                                className={`px-2.5 py-1 rounded text-sm flex items-center gap-1.5 font-semibold ${
                                  darkMode 
                                    ? 'bg-gray-700 text-white border border-gray-600' 
                                    : 'bg-white text-gray-700 border border-gray-200'
                                }`}
                              >
                                {item.type === 'service' ? (
                                  <FiTool size={12} className="text-amber-400" />
                                ) : (
                                  <FiPackage size={12} className="text-blue-400" />
                                )}
                                {item.name}
                                {item.mileage && (
                                  <span className="text-blue-400 text-xs">({item.mileage}km)</span>
                                )}
                                <span className="text-gray-400">×</span>
                                <span className="font-bold">{item.quantity}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Summary */}
                        {bill.cart_summary && (
                          <div className="mt-3 pt-3 border-t dark:border-gray-700 flex items-center gap-4 flex-wrap text-sm">
                            <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              Subtotal: Rs. {(bill.cart_summary.subtotal || 0).toLocaleString()}
                            </span>
                            {bill.cart_summary.discount > 0 && (
                              <span className={`font-semibold text-red-400`}>
                                Discount: -Rs. {(bill.cart_summary.discount || 0).toLocaleString()}
                              </span>
                            )}
                            <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              Total: <span className="font-bold text-amber-400">Rs. {(bill.cart_summary.total_amount || 0).toLocaleString()}</span>
                            </span>
                            <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              Items: {bill.cart_summary.total_items || 0}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions - Amber Theme */}
        {discardedBills.length > 0 && (
          <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl shadow-xl p-4 border ${darkMode ? 'border-gray-800' : 'border-gray-200'} mt-6 flex justify-between items-center flex-wrap gap-3`}>
            <button
              onClick={handleClearAll}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                darkMode 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              <FiTrash2 size={16} />
              Clear All ({discardedBills.length})
            </button>
            <button
              onClick={fetchDiscardedBills}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                darkMode 
                  ? 'bg-gray-800 text-white hover:bg-gray-700' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <FiRefreshCw size={16} />
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscardedBillsPage;