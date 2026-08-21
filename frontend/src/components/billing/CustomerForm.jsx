// src/components/billing/CustomerForm.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  FiUser, FiPhone, FiCalendar, FiClock, FiTool, FiPackage, 
  FiCheckCircle, FiAlertCircle, FiX, FiArrowRight, FiLoader, FiMail
} from 'react-icons/fi';
import api from '../../services/api';

const CustomerForm = ({ onCustomerSubmit, initialData, darkMode }) => {
  const [customerDetails, setCustomerDetails] = useState(initialData || {
    name: '',
    phone: '',
    email: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  // ✅ Invoice Date & Time states
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [invoiceTime, setInvoiceTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  });
  
  const [customerHistory, setCustomerHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searching, setSearching] = useState(false);
  
  // ✅ Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false);

  // ✅ Check user role on mount
  useEffect(() => {
    try {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        const role = userData?.role || 'employee';
        setIsAdmin(role === 'admin');
      }
    } catch (e) {
      console.error('Error parsing user data:', e);
      setIsAdmin(false);
    }
  }, []);

  // ✅ FORCE UPDATE - Always set current date when component mounts
  useEffect(() => {
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    setInvoiceDate(currentDate);
    console.log('📅 Current date set to:', currentDate);
  }, []);

  // ✅ Update invoiceDate when initialData changes (for restored data)
  useEffect(() => {
    if (initialData?.date) {
      const datePart = initialData.date.split('T')[0];
      if (datePart) {
        setInvoiceDate(datePart);
      }
    }
  }, [initialData]);

  // Search customer history when phone number changes
  useEffect(() => {
    const searchCustomerHistory = async () => {
      if (customerDetails.phone && customerDetails.phone.length >= 4) {
        setSearching(true);
        try {
          let customerData = null;
          try {
            const customerRes = await api.get(`/customers/phone/${customerDetails.phone}`);
            if (customerRes.data && customerRes.data.id) {
              customerData = customerRes.data;
            }
          } catch (err) {
            console.log('Customer not found in customers table, checking invoices...');
          }

          const response = await api.get('/invoices');
          if (response.data && Array.isArray(response.data)) {
            const history = response.data
              .filter(inv => inv.customer_phone === customerDetails.phone)
              .sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date))
              .slice(0, 10);
            
            setCustomerHistory(history);
            
            if (history.length > 0) {
              setShowHistory(true);
            } else {
              setShowHistory(false);
            }
            
            if (customerData || history.length > 0) {
              const lastInvoice = history[0] || {};
              
              setCustomerDetails(prev => ({
                ...prev,
                name: customerData?.name || lastInvoice.customer_name || prev.name,
                email: customerData?.email || lastInvoice.customer_email || prev.email,
              }));
              
              if (customerData?.name || lastInvoice.customer_name) {
                toast.success(`Welcome back ${customerData?.name || lastInvoice.customer_name}!`, { duration: 2000 });
              }
            }
          }
        } catch (err) {
          console.error('Error fetching customer history:', err);
        } finally {
          setSearching(false);
        }
      } else {
        setShowHistory(false);
        setCustomerHistory([]);
      }
    };
    
    searchCustomerHistory();
  }, [customerDetails.phone]);

  // ✅ Handle submit with Date & Time
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dateTimeStr = `${invoiceDate} ${invoiceTime}:00`;
    const customerName = customerDetails.name?.trim() || 'Walk-in';
    
    console.log('📅 Invoice DateTime:', {
      date: invoiceDate,
      time: invoiceTime,
      full: dateTimeStr,
      name: customerName
    });
    
    onCustomerSubmit({
      name: customerName,
      phone: customerDetails.phone || '',
      email: customerDetails.email || '',
      date: dateTimeStr
    });
  };

  const updateField = (field, value) => {
    if (field === 'phone') {
      setCustomerDetails({ ...customerDetails, phone: value, name: '', email: '' });
    } else {
      setCustomerDetails({ ...customerDetails, [field]: value });
    }
  };

  return (
    <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200 shadow-sm'}`}>
      {/* Header - Amber Theme */}
      <div className="px-6 py-5 border-b flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <FiUser className="text-2xl text-amber-400" />
            <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Step 1: Customer Details</h3>
          </div>
          <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} mt-1`}>All fields are optional - Just click Continue to proceed</p>
        </div>
        <div className="text-right">
          <p className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-500'} flex items-center gap-1 justify-end`}>
            <FiCalendar className="text-xs" /> Date
          </p>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 w-40"
          />
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ✅ Phone Number */}
          <div>
            <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <FiPhone className="text-lg text-amber-400" /> 
              Phone Number 
              <span className="text-xs text-gray-400">(Optional)</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                value={customerDetails.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="Enter phone number (auto-searches history)"
                className={`w-full px-4 py-3 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                  darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
              {searching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <FiLoader className="animate-spin text-amber-400 text-lg" />
                </div>
              )}
            </div>
            <p className={`text-xs font-medium mt-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
              Enter at least 4 digits to search history
            </p>
          </div>
          
          {/* ✅ Customer Name */}
          <div>
            <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <FiUser className="text-lg text-amber-400 inline mr-2" /> 
              Customer Name 
              <span className="text-xs text-gray-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={customerDetails.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Enter customer name (optional)"
              className={`w-full px-4 py-3 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
          </div>
          
          {/* ✅ Email Address */}
          <div>
            <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <FiMail className="text-lg text-amber-400" /> 
              Email Address 
              <span className="text-xs text-gray-400">(Optional)</span>
            </label>
            <input
              type="email"
              value={customerDetails.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="customer@example.com"
              className={`w-full px-4 py-3 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
            <p className={`text-xs font-medium mt-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-400'} flex items-center gap-1.5`}>
              <FiClock className="text-sm" /> We'll send a service reminder after 6 months
            </p>
          </div>

          {/* ✅ Invoice Date & Time */}
          <div>
            <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <FiClock className="text-lg text-amber-400" /> 
              Invoice Date & Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={`px-3 py-3 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                  darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
              <input
                type="time"
                value={invoiceTime}
                onChange={(e) => setInvoiceTime(e.target.value)}
                className={`px-3 py-3 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                  darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <p className={`text-xs font-medium mt-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-400'} flex items-center gap-1.5`}>
              <FiClock className="text-sm" /> This date & time will be used for the invoice
            </p>
          </div>
        </div>
        
        {/* ✅ Customer History Section */}
        {showHistory && customerHistory.length > 0 && (
          <div className={`mt-6 p-5 rounded-xl ${darkMode ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h4 className={`font-bold flex items-center gap-2 text-base ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                <FiClock className="text-base" /> Previous Visits ({customerHistory.length})
              </h4>
              <button onClick={() => setShowHistory(false)} className={`text-sm font-semibold ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} flex items-center gap-1`}>
                <FiX className="text-sm" /> Hide
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${darkMode ? 'border-amber-800' : 'border-amber-200'}`}>
                    <th className={`text-left py-2 px-2 text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Date</th>
                    <th className={`text-left py-2 px-2 text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Services</th>
                    {isAdmin && (
                      <>
                        <th className={`text-left py-2 px-2 text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total</th>
                        <th className={`text-left py-2 px-2 text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {customerHistory.map((inv, idx) => (
                    <tr key={inv.id || idx}>
                      <td className={`py-2 px-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {new Date(inv.invoice_date).toLocaleDateString()}
                      </td>
                      <td className={`py-2 px-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {inv.items?.map(i => i.service_name).slice(0, 2).join(', ') || 'N/A'}
                        {inv.items?.length > 2 && ` +${inv.items.length - 2}`}
                      </td>
                      {isAdmin && (
                        <>
                          <td className={`py-2 px-2 font-bold text-xs ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                            Rs. {inv.total_amount?.toLocaleString() || 0}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${
                              inv.status === 'Paid' 
                                ? darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                                : darkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {inv.status === 'Paid' ? <FiCheckCircle className="text-xs" /> : <FiAlertCircle className="text-xs" />}
                              {inv.status}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {customerHistory.length >= 10 && (
              <p className={`text-xs font-medium text-center mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Showing last 10 visits</p>
            )}
          </div>
        )}
        
        {/* Continue Button - Amber Theme */}
        <div className="mt-6">
          <button
            type="submit"
            className="w-full bg-amber-400 text-gray-900 font-bold py-3.5 rounded-lg hover:bg-amber-300 transition shadow-md flex items-center justify-center gap-3 text-lg"
          >
            Continue to Billing <FiArrowRight className="text-2xl" />
          </button>
        </div>
        
        {/* Note - Amber Theme */}
        <div className={`mt-4 p-4 rounded-lg text-sm ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          <p className="flex items-center gap-2.5 font-medium">
            <FiClock className="text-xl text-amber-400" />
            <strong>Note:</strong> All fields are optional. If you provide an email address, we'll automatically send a service reminder after 6 months!
          </p>
        </div>
      </form>
    </div>
  );
};

export default CustomerForm;