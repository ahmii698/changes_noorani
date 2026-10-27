// src/components/billing/CustomerForm.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  FiUser, FiPhone, FiCalendar, FiClock, FiTool, FiPackage, 
  FiCheckCircle, FiAlertCircle, FiX, FiArrowRight, FiLoader, FiMail, FiLock
} from 'react-icons/fi';
import api from '../../services/api';

// 🔒 LOCKED DATE & TIME HELPERS - hamesha system ki local date/time
const pad2 = (n) => String(n).padStart(2, '0');

// yyyy-mm-dd (LOCAL date - UTC nahi, taake raat 12 ke baad date galat na aaye)
const getLocalDateISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// HH:mm:ss (24 hour)
const getLocalTime24 = (d = new Date()) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

// mm/dd/yyyy (display)
const getLocalDateDisplay = (d = new Date()) =>
  `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;

// hh:mm:ss AM/PM (display)
const getLocalTimeDisplay = (d = new Date()) =>
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

const CustomerForm = ({ onCustomerSubmit, initialData, darkMode }) => {
  const [customerDetails, setCustomerDetails] = useState(initialData || {
    name: '',
    phone: '',
    email: '',
    date: getLocalDateISO()
  });

  // 🔒 Live clock - auto update, user change nahi kar sakta
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
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

  // ✅ Handle submit - date & time submit ke waqt system se fresh li jati hai
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submitNow = new Date();
    const lockedDate = getLocalDateISO(submitNow);
    const lockedTime = getLocalTime24(submitNow);
    const dateTimeStr = `${lockedDate} ${lockedTime}`;
    const customerName = customerDetails.name?.trim() || 'Walk-in';
    
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

  // 🔒 Locked input style
  const lockedInputClass = `w-full px-3 py-3 rounded-lg border text-base font-medium outline-none cursor-not-allowed select-none ${
    darkMode ? 'bg-gray-800/60 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-700'
  }`;

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
            <FiLock className="text-xs text-amber-400" />
          </p>
          {/* 🔒 Locked date (editable nahi) */}
          <input
            type="text"
            value={getLocalDateDisplay(now)}
            readOnly
            disabled
            tabIndex={-1}
            title="Date automatic hai - change nahi ho sakti"
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none w-40 cursor-not-allowed select-none"
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

          {/* 🔒 Invoice Date & Time - LOCKED (auto system clock) */}
          <div>
            <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <FiClock className="text-lg text-amber-400" /> 
              Invoice Date & Time
              <FiLock className="text-sm text-amber-400" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={getLocalDateDisplay(now)}
                readOnly
                disabled
                tabIndex={-1}
                title="Date automatic hai - change nahi ho sakti"
                className={lockedInputClass}
              />
              <input
                type="text"
                value={getLocalTimeDisplay(now)}
                readOnly
                disabled
                tabIndex={-1}
                title="Time automatic hai - change nahi ho sakta"
                className={lockedInputClass}
              />
            </div>
            <p className={`text-xs font-medium mt-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-400'} flex items-center gap-1.5`}>
              <FiLock className="text-sm" /> Date & time automatic hain (locked) - invoice isi waqt par banega
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
              <button type="button" onClick={() => setShowHistory(false)} className={`text-sm font-semibold ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} flex items-center gap-1`}>
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
        
    
      </form>
    </div>
  );
};

export default CustomerForm;