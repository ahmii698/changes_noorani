import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FiDollarSign,
  FiPlus,
  FiMinus,
  FiLoader,
  FiUser,
  FiClock,
  FiRefreshCw,
  FiGrid,
  FiDownload,
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';

const formatDateTime = (value) => {
  const d = new Date(value);
  if (!value || isNaN(d.getTime())) return '-';
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
};

/* Same as above but without the bullet symbol (safe for PDF / Excel) */
const formatDateTimePlain = (value) => formatDateTime(value).replace(' • ', ' ');

const rs = (n) => `Rs. ${(Number(n) || 0).toLocaleString()}`;

/* Builds a file name like Cash_In_Hand_2026-11-02 */
const exportFileName = () => `Cash_In_Hand_${new Date().toISOString().slice(0, 10)}`;

const CashInHand = ({ darkMode }) => {
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [type, setType] = useState('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      setIsAdmin(user?.role === 'admin');
    } catch (e) { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/cash-in-hand');
      setBalance(Number(res.data?.balance) || 0);
      setEntries(Array.isArray(res.data?.data) ? res.data.data : []);
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Failed to load cash in hand');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Refresh only this page's data (no full browser reload) */
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const ok = await load();
    if (ok) toast.success('Data refreshed');
    setRefreshing(false);
  };

  /* ---------- Export: Excel ---------- */
  const exportExcel = () => {
    if (!entries.length) return;

    const header = ['Date & Time', 'Type', 'Amount', 'Before', 'After', 'Note', 'By'];
    const body = entries.map((en) => [
      formatDateTimePlain(en.created_at),
      en.type === 'add' ? 'Added' : 'Withdrawn',
      (en.type === 'add' ? 1 : -1) * (Number(en.amount) || 0),
      Number(en.balance_before) || 0,
      Number(en.balance_after) || 0,
      en.note || '-',
      en.user_name || '-',
    ]);
    const balanceRow = ['', '', '', '', Number(balance) || 0, 'CURRENT BALANCE', ''];

    const ws = XLSX.utils.aoa_to_sheet([header, ...body, balanceRow]);
    ws['!cols'] = [
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 30 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash In Hand');
    XLSX.writeFile(wb, `${exportFileName()}.xlsx`);
  };

  /* ---------- Export: PDF ---------- */
  const exportPdf = () => {
    if (!entries.length) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFontSize(16);
    doc.text('Cash in Hand - History', 40, 36);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleString('en-GB')}`, 40, 52);
    doc.setFontSize(11);
    doc.text(`Current Balance: ${rs(balance)}`, 40, 70);

    const body = entries.map((en) => [
      formatDateTimePlain(en.created_at),
      en.type === 'add' ? 'Added' : 'Withdrawn',
      `${en.type === 'add' ? '+' : '-'}${rs(en.amount)}`,
      rs(en.balance_before),
      rs(en.balance_after),
      en.note || '-',
      en.user_name || '-',
    ]);

    autoTable(doc, {
      startY: 84,
      head: [['Date & Time', 'Type', 'Amount', 'Before', 'After', 'Note', 'By']],
      body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      didParseCell: (data) => {
        /* Right-align the numeric column headers too */
        if (data.section === 'head' && [2, 3, 4].includes(data.column.index)) {
          data.cell.styles.halign = 'right';
        }
      },
      margin: { left: 40, right: 40 },
    });

    doc.save(`${exportFileName()}.pdf`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await api.post('/cash-in-hand', { type, amount: num, note: note.trim() || null });
      toast.success(type === 'add' ? 'Cash added successfully!' : 'Cash withdrawn successfully!');
      setAmount('');
      setNote('');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const card = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const strong = darkMode ? 'text-white' : 'text-gray-900';
  const input = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <FiLoader className="text-4xl text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action buttons: Refresh / Excel / PDF */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh this page"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
        <button
          type="button"
          onClick={exportExcel}
          disabled={entries.length === 0}
          title="Download Excel report"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/80 text-white text-sm font-bold hover:bg-emerald-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiGrid />
          Excel
        </button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={entries.length === 0}
          title="Download PDF report"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/80 text-white text-sm font-bold hover:bg-red-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiDownload />
          PDF
        </button>
      </div>

      <div className={`rounded-xl p-5 border ${card}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-full bg-cyan-500/15"><FiDollarSign className="text-cyan-400" /></div>
          <span className={`text-xs font-bold ${muted}`}>Admin Cash in Hand (manual)</span>
        </div>
        <p className={`text-2xl font-bold ${strong}`}>{rs(balance)}</p>
        <p className="text-xs font-bold text-gray-500">This amount is added to the "Cash in Hand" card in Inventory</p>
      </div>

      {isAdmin && (
        <form onSubmit={handleSubmit} className={`rounded-xl p-5 border space-y-3 ${card}`}>
          <h3 className={`text-sm font-bold ${strong}`}>Update Cash</h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('add')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${type === 'add' ? 'bg-emerald-500 text-white' : darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
              <FiPlus /> Add
            </button>
            <button type="button" onClick={() => setType('withdraw')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${type === 'withdraw' ? 'bg-red-500 text-white' : darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
              <FiMinus /> Withdraw
            </button>
          </div>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            className={input} placeholder="Amount (Rs.) e.g. 50000" disabled={saving} />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            className={input} placeholder="Note (optional)" maxLength={255} disabled={saving} />
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-300 transition font-bold flex items-center gap-2 disabled:opacity-60">
            {saving && <FiLoader className="animate-spin" />} Save
          </button>
        </form>
      )}

      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <div className={`px-4 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <FiClock className="text-amber-400" />
          <h3 className={`text-sm font-bold ${strong}`}>History</h3>
        </div>
        {entries.length === 0 ? (
          <p className={`p-6 text-center text-sm font-bold ${muted}`}>No history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                <tr>
                  {['Date & Time', 'Type', 'Amount', 'Before', 'After', 'Note', 'By'].map(h => (
                    <th key={h} className={`px-4 py-2 text-left text-xs font-bold uppercase ${muted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                {entries.map(en => (
                  <tr key={en.id}>
                    <td className={`px-4 py-3 text-xs font-medium ${muted}`}>{formatDateTime(en.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${en.type === 'add' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        {en.type === 'add' ? 'Added' : 'Withdrawn'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-bold ${en.type === 'add' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {en.type === 'add' ? '+' : '-'}{rs(en.amount)}
                    </td>
                    <td className={`px-4 py-3 font-medium ${muted}`}>{rs(en.balance_before)}</td>
                    <td className={`px-4 py-3 font-bold ${strong}`}>{rs(en.balance_after)}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${muted}`}>{en.note || '-'}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${muted}`}>
                      <span className="flex items-center gap-1"><FiUser /> {en.user_name || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashInHand;