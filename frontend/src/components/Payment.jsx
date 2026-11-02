// src/components/Payment.jsx
//
// ✅ Pehle ye install karo (QR JSX se banane ke liye):
//    npm install qrcode.react

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  FiCreditCard, FiCalendar, FiClock, FiCheckCircle,
  FiCopy, FiCheck, FiSmartphone, FiHome, FiArrowDown, FiRepeat
} from 'react-icons/fi';

// ============================================================
// ✅ YAHAN SE DATA CHANGE KARO
// ============================================================
const subscription = {
  monthlyFee: 5000,
  billingPeriod: '31 Oct 2026',
  dueDate: '31 Nov 2026',
  status: 'Pending', // 'Pending' | 'Paid'
};

// ✅ "qrValue" jo likhoge wahi QR scan karne par dikhega.
// "XXXX" wali values ko apni asli details se badal do (details aur qrValue dono main)
const paymentMethods = [
  {
    id: 'jazzcash',
    name: 'JazzCash',
    icon: FiSmartphone,
    headerClass: 'from-red-600 to-red-500',
    qrValue: 'JazzCash\nAccount Title: ACCOUNT TITLE\nMobile: 03XX-XXXXXXX',
    details: [
      { label: 'Account Title', value: 'ACCOUNT TITLE' },
      { label: 'Mobile Number', value: '03XX-XXXXXXX' },
    ],
  },
  {
    id: 'easypaisa',
    name: 'Easypaisa',
    icon: FiSmartphone,
    headerClass: 'from-green-600 to-emerald-500',
    qrValue: 'Easypaisa\nAccount Title: ACCOUNT TITLE\nMobile: 03XX-XXXXXXX',
    details: [
      { label: 'Account Title', value: 'ACCOUNT TITLE' },
      { label: 'Mobile Number', value: '03XX-XXXXXXX' },
    ],
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    icon: FiHome,
    headerClass: 'from-blue-700 to-blue-500',
    qrValue: 'Bank: BANK NAME\nAccount Title: ACCOUNT TITLE\nAccount No: XXXXXXXXXXXXXX\nIBAN: PKXXXXXXXXXXXXXXXXXXXXXX',
    details: [
      { label: 'Bank Name', value: 'BANK NAME' },
      { label: 'Account Title', value: 'ACCOUNT TITLE' },
      { label: 'Account Number', value: 'XXXXXXXXXXXXXX' },
      { label: 'IBAN', value: 'PKXXXXXXXXXXXXXXXXXXXXXX' },
    ],
  },
];

// ------------------------------------------------------------
// Copy button
// ------------------------------------------------------------
const CopyButton = ({ value, darkMode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy nahi hua');
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className={`p-1.5 rounded-lg transition flex-shrink-0 ${
        darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-amber-400' : 'text-gray-500 hover:bg-gray-100 hover:text-amber-500'
      }`}
    >
      {copied ? <FiCheck className="text-emerald-500" /> : <FiCopy />}
    </button>
  );
};

// ------------------------------------------------------------
// Payment method card (QR JSX se bana hua)
// ------------------------------------------------------------
const MethodCard = ({ method, darkMode }) => {
  const Icon = method.icon;
  const cardBg = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textColor = darkMode ? 'text-white' : 'text-gray-900';
  const textMuted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const rowBg = darkMode ? 'bg-gray-800/60' : 'bg-gray-50';

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm flex flex-col ${cardBg}`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${method.headerClass} px-5 py-4 flex items-center gap-3`}>
        <div className="p-2 rounded-xl bg-white/20">
          <Icon className="text-xl text-white" />
        </div>
        <h3 className="text-lg font-extrabold text-white">{method.name}</h3>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
        {/* QR - white background zaroori hai taake scan ho */}
        <div>
          <div className="w-44 h-44 mx-auto rounded-2xl bg-white p-3 shadow-md flex items-center justify-center">
            <QRCodeSVG
              value={method.qrValue}
              size={152}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
          <p className={`text-xs text-center mt-2 font-semibold ${textMuted}`}>Scan karke details dekho</p>
        </div>

        {/* Details */}
        <div className="space-y-2">
          {method.details.map((d) => (
            <div key={d.label} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl ${rowBg}`}>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${textMuted}`}>{d.label}</p>
                <p className={`text-sm font-bold truncate ${textColor}`}>{d.value}</p>
              </div>
              <CopyButton value={d.value} darkMode={darkMode} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Main page
// ------------------------------------------------------------
const Payment = ({ darkMode }) => {
  const methodsRef = useRef(null);

  const isPaid = subscription.status === 'Paid';
  const cardBg = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textColor = darkMode ? 'text-white' : 'text-gray-900';
  const textMuted = darkMode ? 'text-gray-400' : 'text-gray-500';

  const handlePayNow = () => {
    methodsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const infoCards = [
    { label: 'Billing Period', value: subscription.billingPeriod, icon: FiCalendar, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    { label: 'Pay Due Date', value: subscription.dueDate, icon: FiClock, color: 'text-red-400', bg: 'bg-red-500/15' },
    { label: 'Billing Cycle', value: 'Monthly', icon: FiRepeat, color: 'text-purple-400', bg: 'bg-purple-500/15' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className={`text-2xl md:text-3xl font-extrabold ${textColor}`}>
        Subscription Management System
      </h1>

      {/* Hero */}
      <div className="rounded-2xl p-6 md:p-8 bg-gradient-to-br from-amber-500 via-amber-400 to-orange-400 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <p className="text-sm font-bold text-gray-900/70 uppercase tracking-wide">Monthly Fee</p>
          <p className="text-4xl md:text-5xl font-extrabold text-gray-900 mt-1">
            Rs. {subscription.monthlyFee.toLocaleString()}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900/15 text-gray-900 text-sm font-bold">
            <FiCheckCircle />
            Payment Status:
            <span className={isPaid ? 'text-emerald-800' : 'text-red-800'}>{subscription.status}</span>
          </div>
        </div>

        <button
          onClick={handlePayNow}
          disabled={isPaid}
          className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-extrabold text-amber-400 bg-gray-900 hover:bg-gray-800 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiCreditCard className="text-xl" />
          Pay Now
          <FiArrowDown />
        </button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {infoCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-5 flex items-center gap-4 shadow-sm ${cardBg}`}>
            <div className={`p-3 rounded-full ${bg}`}>
              <Icon className={`text-xl ${color}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${textMuted}`}>{label}</p>
              <p className={`text-lg font-extrabold ${textColor}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Methods */}
      <div ref={methodsRef} className="scroll-mt-6">
        <h2 className={`text-xl font-extrabold mb-1 ${textColor}`}>Payment Methods</h2>
        <p className={`text-sm font-medium mb-4 ${textMuted}`}>
          Kisi bhi ek method se Rs. {subscription.monthlyFee.toLocaleString()} bhej do.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {paymentMethods.map((m) => (
            <MethodCard key={m.id} method={m} darkMode={darkMode} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Payment;