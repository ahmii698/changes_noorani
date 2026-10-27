// src/components/finance/EmployeeLoanModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiLoader, FiInbox, FiTrash2, FiPlus, FiMinus, FiList } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import './EmployeeSalary.css';

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// "2026-10-27" -> "27/10/2026" (timezone problem se bachne ke liye string split)
const formatDate = (d) => {
  if (!d) return '-';
  const [y, m, day] = String(d).substring(0, 10).split('-');
  if (!y || !m || !day) return '-';
  return `${day}/${m}/${y}`;
};

const todayKarachi = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }); // YYYY-MM-DD

// ✅ Backend kabhi loan_date bhejta hai kabhi transaction_date - dono handle
const getTxDate = (t) => t.transaction_date || t.loan_date || t.date || null;

// ✅ Laravel error se asli message nikalo (422 validation ya normal message)
const getErrorMessage = (error, fallback) => {
  const data = error.response?.data;
  if (data?.errors) {
    const firstKey = Object.keys(data.errors)[0];
    if (firstKey && data.errors[firstKey]?.[0]) return data.errors[firstKey][0];
  }
  return data?.message || fallback;
};

const EmployeeLoanModal = ({ employee, darkMode, onClose, onChanged }) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    type: 'loan',
    amount: '',
    transaction_date: todayKarachi(),
    note: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/employee-loans/employee/${employee.id}`);
      if (res.data.success) {
        setSummary(res.data.data.summary);
        setTransactions(res.data.data.transactions || []);
      }
    } catch (error) {
      console.error('Loan history load error:', error.response?.status, error.response?.data || error.message);
      toast.error(getErrorMessage(error, 'Failed to load loan history'));
    } finally {
      setLoading(false);
    }
  }, [employee.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const remaining = parseFloat(summary?.remaining) || 0;
    if (form.type === 'repayment' && amount > remaining) {
      toast.error(`Repayment cannot exceed remaining loan (Rs. ${formatCurrency(remaining)})`);
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post('/employee-loans', {
        employee_id: employee.id,
        type: form.type,
        amount,
        loan_date: form.transaction_date,        // ✅ backend yehi maang raha hai
        transaction_date: form.transaction_date, // ✅ safety: agar controller yeh use kare
        note: form.note
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Saved');
        setForm({ type: form.type, amount: '', transaction_date: todayKarachi(), note: '' });
        await loadData();
        onChanged && onChanged();
      }
    } catch (error) {
      console.error('Loan save error:', error.response?.status, error.response?.data || error.message);
      toast.error(getErrorMessage(error, 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      const res = await api.delete(`/employee-loans/${id}`);
      if (res.data.success) {
        toast.success('Record deleted');
        await loadData();
        onChanged && onChanged();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete'));
    }
  };

  const isLoan = form.type === 'loan';

  return (
    <div className="employee-salary-modal-overlay">
      <div className={`employee-salary-modal ${darkMode ? 'dark' : ''}`}>
        <div className={`employee-salary-modal-header ${darkMode ? 'dark' : ''}`}>
          <div>
            <h2 className="employee-salary-modal-title">
              <FiList className="employee-salary-modal-title-icon" /> Employee Loan
            </h2>
            <p className="employee-salary-modal-subtitle">{employee.name}</p>
          </div>
          <button onClick={onClose} className="employee-salary-modal-close">
            <FiX />
          </button>
        </div>

        <div className="employee-salary-modal-body">
          {loading && !summary ? (
            <div className="employee-salary-empty-history">
              <FiLoader className="employee-salary-empty-history-icon animate-spin" />
              <p>Loading...</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="employee-salary-summary employee-salary-loan-summary">
                <div className="employee-salary-summary-item">
                  <p className="employee-salary-summary-label">Total Loan Given</p>
                  <p className="employee-salary-summary-value total">Rs.{formatCurrency(summary?.total_loan)}</p>
                </div>
                <div className="employee-salary-summary-item">
                  <p className="employee-salary-summary-label">Total Repaid</p>
                  <p className="employee-salary-summary-value paid">Rs.{formatCurrency(summary?.total_repaid)}</p>
                </div>
                <div className="employee-salary-summary-item">
                  <p className="employee-salary-summary-label">Remaining</p>
                  <p className="employee-salary-summary-value balance">Rs.{formatCurrency(summary?.remaining)}</p>
                </div>
              </div>

              {/* Add entry form */}
              <form onSubmit={handleSubmit} className="employee-salary-loan-form">
                <div className="employee-salary-loan-toggle">
                  <button
                    type="button"
                    className={`employee-salary-loan-toggle-btn ${isLoan ? 'active-loan' : ''}`}
                    onClick={() => setForm({ ...form, type: 'loan' })}
                  >
                    <FiPlus /> Give Loan
                  </button>
                  <button
                    type="button"
                    className={`employee-salary-loan-toggle-btn ${!isLoan ? 'active-repay' : ''}`}
                    onClick={() => setForm({ ...form, type: 'repayment' })}
                  >
                    <FiMinus /> Receive Repayment
                  </button>
                </div>

                <div className="employee-salary-loan-row">
                  <div className="employee-salary-form-group">
                    <label className={`employee-salary-form-label ${darkMode ? 'dark' : ''}`}>Amount (Rs.) *</label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className={`employee-salary-form-input ${darkMode ? 'dark' : ''}`}
                      placeholder="Enter amount"
                      min="1"
                      step="0.01"
                      required
                    />
                    {!isLoan && summary && (
                      <p className={`text-xs mt-1 font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Maximum: Rs. {formatCurrency(summary.remaining)}
                      </p>
                    )}
                  </div>
                  <div className="employee-salary-form-group">
                    <label className={`employee-salary-form-label ${darkMode ? 'dark' : ''}`}>Date</label>
                    <input
                      type="date"
                      value={form.transaction_date}
                      onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                      className={`employee-salary-form-input ${darkMode ? 'dark' : ''}`}
                      required
                    />
                  </div>
                </div>

                <div className="employee-salary-form-group">
                  <label className={`employee-salary-form-label ${darkMode ? 'dark' : ''}`}>Note (Optional)</label>
                  <input
                    type="text"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className={`employee-salary-form-input ${darkMode ? 'dark' : ''}`}
                    placeholder={isLoan ? 'e.g. Ghar mein emergency' : 'e.g. Salary se kata / cash diya'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving || (!isLoan && (parseFloat(summary?.remaining) || 0) <= 0)}
                  className={isLoan ? 'employee-salary-btn-submit employee-salary-loan-save' : 'employee-salary-btn-pay-submit employee-salary-loan-save'}
                >
                  {isSaving ? (
                    <><FiLoader className="animate-spin mr-2" /> Saving...</>
                  ) : isLoan ? 'Save Loan' : 'Save Repayment'}
                </button>
              </form>

              {/* History */}
              <h3 className="employee-salary-history-title" style={{ marginTop: '1.25rem' }}>
                Loan History
                <span className="ml-2 text-sm font-normal text-gray-500">({transactions.length} entries)</span>
              </h3>

              {transactions.length === 0 ? (
                <div className="employee-salary-empty-history">
                  <FiInbox className="employee-salary-empty-history-icon" />
                  <p>No loan records yet</p>
                </div>
              ) : (
                <div className="employee-salary-history-table-wrapper">
                  <table className="employee-salary-history-table">
                    <thead className={darkMode ? 'dark' : ''}>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th className="employee-salary-text-right">Amount (Rs.)</th>
                        <th>Note</th>
                        <th>By</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t, idx) => (
                        <tr key={t.id}>
                          <td className="font-bold">{idx + 1}</td>
                          <td className="font-bold">{formatDate(getTxDate(t))}</td>
                          <td>
                            <span className={`employee-salary-status-badge ${t.type === 'loan' ? 'pending' : 'paid'}`}>
                              {t.type === 'loan' ? 'Loan Given' : 'Repayment'}
                            </span>
                          </td>
                          <td className={`employee-salary-text-right ${t.type === 'loan' ? 'employee-salary-loan-amount-out' : 'employee-salary-amount-paid'}`}>
                            {t.type === 'loan' ? '+' : '-'} Rs.{formatCurrency(t.amount)}
                          </td>
                          <td className="font-medium">{t.note || '-'}</td>
                          <td className="font-medium">{t.created_by || 'System'}</td>
                          <td>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="text-red-500 hover:text-red-700 font-bold"
                              title="Delete"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className={`employee-salary-modal-footer ${darkMode ? 'dark' : ''}`}>
          <button onClick={onClose} className="employee-salary-btn-close">
            <FiX /> Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLoanModal;