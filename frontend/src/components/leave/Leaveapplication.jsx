// src/components/leave/LeaveApplication.jsx

import React, { useState, useEffect } from 'react';
import {
  Calendar, User, FileText, Send, CheckCircle,
  AlertCircle, Building, X, RefreshCw, FileSpreadsheet, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './LeaveApplication.css';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ============================================
// TOASTER COMPONENT - Bottom Right
// ============================================
const Toaster = ({ message, type, onClose, darkMode }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const colors = {
    success: { bg: darkMode ? '#065f46' : '#d1fae5', border: '#22c55e', text: darkMode ? '#6ee7b7' : '#065f46', icon: CheckCircle },
    error: { bg: darkMode ? '#7f1d1d' : '#fee2e2', border: '#dc2626', text: darkMode ? '#fca5a5' : '#991b1b', icon: AlertCircle },
    info: { bg: darkMode ? '#1e3a5f' : '#dbeafe', border: '#2563eb', text: darkMode ? '#93c5fd' : '#1e40af', icon: CheckCircle },
    warning: { bg: darkMode ? '#78350f' : '#fef3c7', border: '#f59e0b', text: darkMode ? '#fcd34d' : '#92400e', icon: AlertCircle },
  };

  const style = colors[type] || colors.success;
  const Icon = style.icon;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 99999,
      maxWidth: '420px',
      width: '100%',
      animation: 'toasterSlideIn 0.4s ease'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 18px',
        background: darkMode ? '#1f2937' : '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
        borderLeft: `5px solid ${style.border}`,
        border: `1px solid ${style.border}`,
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: style.bg,
          color: style.text,
          flexShrink: 0,
          marginTop: '2px'
        }}>
          <Icon size={18} />
        </div>
        <div style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 600,
          color: darkMode ? '#f3f4f6' : style.text,
          lineHeight: 1.5
        }}>
          {message}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#9ca3af',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px'
          }}
        >
          <X size={18} />
        </button>
      </div>
      <style>{`
        @keyframes toasterSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

// ============================================
// ACTION BUTTON STYLES (Refresh / Excel / PDF)
// ============================================
const actionBtnBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '9px 18px',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  border: '1px solid transparent',
  transition: 'all 0.2s ease'
};

const actionBtnStyles = {
  refresh: {
    ...actionBtnBase,
    background: '#2563eb',
    color: '#ffffff',
    borderColor: '#2563eb'
  },
  excel: {
    ...actionBtnBase,
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e',
    borderColor: 'rgba(34, 197, 94, 0.35)'
  },
  pdf: {
    ...actionBtnBase,
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.35)'
  }
};

const LeaveApplication = ({ darkMode }) => {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [userBranch, setUserBranch] = useState(null);

  const [formData, setFormData] = useState({
    user_id: '',
    leave_date: '',
    reason: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ============================================
  // TOASTER STATE
  // ============================================
  const [toaster, setToaster] = useState({ message: '', type: 'info', show: false });

  const hideToaster = () => {
    setToaster({ message: '', type: 'info', show: false });
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      setUserBranch(user.branch_id || user.branch);
    }
    fetchEmployees();
    fetchRecentLeaves();
  }, []);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response = await api.get('/users', {
        params: { paginate: 0 }
      });

      let list = [];
      if (response.data?.success && Array.isArray(response.data.data)) {
        list = response.data.data;
      } else if (Array.isArray(response.data)) {
        list = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        list = response.data.data;
      }

      const filtered = list.filter(u => u.role === 'employee' || u.role === 'manager');
      setEmployees(filtered.length > 0 ? filtered : list);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
      toast.error('Failed to load employees');
    }
    setLoadingEmployees(false);
  };

  const fetchRecentLeaves = async () => {
    setLoadingRecent(true);
    try {
      const response = await api.get('/leaves');

      if (response.data?.success) {
        setRecentLeaves(response.data.data || []);
      } else if (Array.isArray(response.data)) {
        setRecentLeaves(response.data);
      } else {
        setRecentLeaves([]);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
      setRecentLeaves([]);
    }
    setLoadingRecent(false);
  };

  // ============================================
  // REFRESH - reloads only this page's data
  // ============================================
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEmployees(), fetchRecentLeaves()]);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const getBranchScopedEmployees = () => {
    if (userBranch) {
      return employees.filter(emp => parseInt(emp.branch_id) === parseInt(userBranch));
    }
    return employees;
  };

  // All leave records for the user's branch (used for reports)
  const getBranchScopedLeaves = () => {
    if (userBranch) {
      return recentLeaves.filter(
        leave => parseInt(leave.employee?.branch_id) === parseInt(userBranch)
      );
    }
    return recentLeaves;
  };

  const filteredEmployees = getBranchScopedEmployees();
  const allBranchLeaves = getBranchScopedLeaves();
  const filteredRecentLeaves = allBranchLeaves.slice(0, 4);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.user_id || !formData.leave_date || !formData.reason.trim()) {
      toast.error('Please select an employee, a date and enter a reason.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/leaves', formData);

      if (response.data?.success) {
        toast.success('Leave recorded successfully!');
        setFormData({ user_id: '', leave_date: '', reason: '' });
        fetchRecentLeaves();
      } else {
        toast.error(response.data?.message || 'Failed to record leave.');
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
      toast.error(error.response?.data?.message || 'Network error. Please try again.');
    }
    setSubmitting(false);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // ============================================
  // REPORT HELPERS
  // ============================================
  const buildReportRows = () =>
    allBranchLeaves.map((leave, index) => ({
      no: index + 1,
      employee: leave.employee?.name || 'Unknown',
      branch: leave.employee?.branch_id ? `Branch ${leave.employee.branch_id}` : '-',
      date: formatDate(leave.leave_date),
      reason: leave.reason || '-'
    }));

  const getFileStamp = () => new Date().toISOString().slice(0, 10);

  // ============================================
  // EXCEL EXPORT
  // ============================================
  const handleExportExcel = () => {
    const rows = buildReportRows();
    if (rows.length === 0) {
      toast.error('No leave records to export.');
      return;
    }

    try {
      const sheetData = rows.map(r => ({
        '#': r.no,
        'Employee': r.employee,
        'Branch': r.branch,
        'Leave Date': r.date,
        'Reason': r.reason
      }));

      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 26 },
        { wch: 14 },
        { wch: 16 },
        { wch: 50 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave Report');
      XLSX.writeFile(workbook, `leave-report-${getFileStamp()}.xlsx`);
      toast.success('Excel report downloaded');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to create Excel report.');
    }
  };

  // ============================================
  // PDF EXPORT
  // ============================================
  const handleExportPDF = () => {
    const rows = buildReportRows();
    if (rows.length === 0) {
      toast.error('No leave records to export.');
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      doc.setFontSize(18);
      doc.text('Leave Report', 40, 45);

      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(`Generated: ${formatDate(new Date())}`, 40, 63);
      doc.text(`Total records: ${rows.length}`, 40, 77);

      autoTable(doc, {
        startY: 92,
        head: [['#', 'Employee', 'Branch', 'Leave Date', 'Reason']],
        body: rows.map(r => [r.no, r.employee, r.branch, r.date, r.reason]),
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 30 },
          4: { cellWidth: 200 }
        }
      });

      doc.save(`leave-report-${getFileStamp()}.pdf`);
      toast.success('PDF report downloaded');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to create PDF report.');
    }
  };

  return (
    <div className={`leaveapp-page ${darkMode ? 'dark' : ''}`}>
      {/* ===== TOASTER ===== */}
      {toaster.show && (
        <Toaster
          message={toaster.message}
          type={toaster.type}
          onClose={hideToaster}
          darkMode={darkMode}
        />
      )}

      <div
        className="leaveapp-page-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h2 className={darkMode ? 'dark' : ''}>Record Leave</h2>
          <p className={darkMode ? 'dark' : ''}>Record a leave day for an employee</p>
        </div>

        {/* ===== ACTION BUTTONS ===== */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ ...actionBtnStyles.refresh, opacity: refreshing ? 0.7 : 1 }}
          >
            <RefreshCw
              size={16}
              style={refreshing ? { animation: 'leaveappSpin 0.8s linear infinite' } : undefined}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            style={actionBtnStyles.excel}
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            style={actionBtnStyles.pdf}
          >
            <Download size={16} />
            PDF
          </button>
        </div>
        <style>{`
          @keyframes leaveappSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      <div className="leaveapp-content-grid">
        {/* ===== FORM CARD ===== */}
        <div className={`leaveapp-form-card ${darkMode ? 'dark' : ''}`}>
          <form onSubmit={handleSubmit}>
            <div className="leaveapp-form-group">
              <label className={darkMode ? 'dark' : ''}>
                <User size={16} /> Employee
              </label>
              <select
                value={formData.user_id}
                onChange={(e) => handleChange('user_id', e.target.value)}
                className={`leaveapp-form-input ${darkMode ? 'dark' : ''}`}
                disabled={loadingEmployees}
              >
                <option value="">
                  {loadingEmployees ? 'Loading employees...' : 'Select employee...'}
                </option>
                {filteredEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.branch_id ? `(Branch ${emp.branch_id})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="leaveapp-form-group">
              <label className={darkMode ? 'dark' : ''}>
                <Calendar size={16} /> Leave Date
              </label>
              <input
                type="date"
                value={formData.leave_date}
                onChange={(e) => handleChange('leave_date', e.target.value)}
                className={`leaveapp-form-input ${darkMode ? 'dark' : ''}`}
              />
            </div>

            <div className="leaveapp-form-group">
              <label className={darkMode ? 'dark' : ''}>
                <FileText size={16} /> Reason
              </label>
              {/* Rows set to 7 so both cards have a matching height */}
              <textarea
                value={formData.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                className={`leaveapp-form-input leaveapp-form-textarea ${darkMode ? 'dark' : ''}`}
                placeholder="e.g. Medical leave, Family emergency, Personal work..."
                rows={7}
              />
            </div>

            <button
              type="submit"
              className={`leaveapp-submit-btn ${darkMode ? 'dark' : ''}`}
              disabled={submitting}
            >
              <Send size={16} />
              {submitting ? 'Recording...' : 'Record Leave'}
            </button>
          </form>
        </div>

        {/* ===== RECENT LEAVE RECORDS ===== */}
        <div className={`leaveapp-recent-card ${darkMode ? 'dark' : ''}`}>
          <h3 className={darkMode ? 'dark' : ''}>Recent Leave Records</h3>
          {loadingRecent ? (
            <div className="leaveapp-loading">
              <div className={`leaveapp-spinner ${darkMode ? 'dark' : ''}`}></div>
            </div>
          ) : filteredRecentLeaves.length === 0 ? (
            <div className={`leaveapp-empty ${darkMode ? 'dark' : ''}`}>
              <AlertCircle size={22} />
              <p>No leave records yet</p>
            </div>
          ) : (
            <div className="leaveapp-recent-list">
              {filteredRecentLeaves.map(leave => (
                <div key={leave.id} className={`leaveapp-recent-item ${darkMode ? 'dark' : ''}`}>
                  <div className="leaveapp-recent-top">
                    <div className={`leaveapp-recent-name ${darkMode ? 'dark' : ''}`}>
                      {leave.employee?.name || 'Unknown'}
                      {leave.employee?.branch_id && (
                        <span className={`leaveapp-recent-branch ${darkMode ? 'dark' : ''}`}>
                          <Building size={11} /> Branch {leave.employee.branch_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="leaveapp-recent-date">{formatDate(leave.leave_date)}</div>
                  <div className={`leaveapp-recent-reason ${darkMode ? 'dark' : ''}`}>{leave.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveApplication;