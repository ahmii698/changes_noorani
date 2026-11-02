import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanelLeftOpen,
  PanelLeftClose,
  History,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../services/api"; // Adjust this path to match your folder structure

const PAGE_SIZE = 15;
const SIDEBAR_WIDTH = 288;

const money = (n) => (n ? `Rs. ${Number(n).toLocaleString("en-PK")}` : "-");

const toTime = (v) => {
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
};

const fmtDate = (d) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return { date: "-", time: "" };
  return {
    date: dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
};

/* Fixed categories of the Expenses page */
const FIXED_CATEGORIES = ["Rent", "Utilities", "Salary", "Office", "Staff"];

const COLUMNS = [
  { label: "S.No", align: "left" },
  { label: "Date", align: "left" },
  { label: "Invoice No", align: "left" },
  { label: "Details", align: "left" },
  { label: "Product", align: "left" },
  { label: "Price", align: "right" },
  { label: "Quantity", align: "right" },
  { label: "Cash In", align: "right" },
  { label: "Cash Out", align: "right" },
  { label: "Vendor Payable Inventory", align: "right" },
  { label: "Cash Inventory", align: "right" },
  { label: "Cash IN Hand", align: "right" },
  { label: "Total Inventory Cost", align: "right" },
  { label: "Expense", align: "right" },
  { label: "Profit", align: "right" },
];

const alignCls = { left: "text-left", right: "text-right" };

const RANK = {
  cash: 0,
  purchase: 1,
  credit: 2,
  sell: 3,
  vendorPay: 4,
  expense: 5,
};

const toArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

const parseCashEntries = (res) => {
  const body = res?.data || {};
  const list = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
  return list.filter((c) => c && (c.type === "add" || c.type === "withdraw"));
};

const parseManualCash = (res) => {
  const body = res?.data || {};
  const d = body.data ?? body;
  const keys = ["total", "balance", "current_balance", "cash_in_hand", "total_cash", "current_cash"];
  for (const src of [d, body]) {
    if (src && typeof src === "object" && !Array.isArray(src)) {
      for (const k of keys) {
        if (src[k] !== undefined && src[k] !== null && !isNaN(parseFloat(src[k]))) {
          return parseFloat(src[k]);
        }
      }
    }
  }
  const list = Array.isArray(d) ? d : body.history || body.entries || d?.history || d?.entries || [];
  if (Array.isArray(list) && list.length > 0) {
    const latest = list.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a));
    return parseFloat(latest.balance_after) || 0;
  }
  return 0;
};

const buildEntries = ({
  products,
  vendors,
  invoices,
  cashEntries,
  manualCash,
  expenses = [],
  employees = [],
}) => {
  const entries = [];

  const soldByName = {};
  invoices.forEach((inv) =>
    (inv.items || []).forEach((item) => {
      const key = (item.service_name || "").toLowerCase().trim();
      if (!key) return;
      soldByName[key] = (soldByName[key] || 0) + (parseInt(item.quantity || 1) || 0);
    })
  );

  const purchaseByName = {};
  products.forEach((p) => {
    const key = (p.name || "").toLowerCase().trim();
    if (key) purchaseByName[key] = parseFloat(p.purchase_price) || 0;
  });

  /* 1) INVENTORY PURCHASE - CASH */
  products
    .filter((p) => !(p.credit_vendor || p.vendor_name))
    .forEach((p) => {
      const key = (p.name || "").toLowerCase().trim();
      const qty = (parseInt(p.quantity) || 0) + (soldByName[key] || 0);
      const price = parseFloat(p.purchase_price) || 0;
      if (qty <= 0) return;
      entries.push({
        key: `prod-${p.id}`,
        rank: RANK.purchase,
        id: Number(p.id) || 0,
        ts: toTime(p.created_at || p.date_added),
        date: p.created_at || p.date_added,
        invoiceNo: p.invoice_number || p.invoice_no || "-",
        details: "Inventory Purchase",
        product: p.name,
        price,
        qty,
        cashIn: 0,
        cashOut: 0,
        ownerDelta: qty * price,
        costDelta: qty * price,
        payableDelta: 0,
        isVendor: false,
      });
    });

  /* 2) CREDIT PURCHASE + VENDOR PAYMENTS */
  vendors.forEach((v) => {
    const recordTime = toTime(v.created_at);
    const payments = Array.isArray(v.payments) ? v.payments : [];
    let laterForRecord = 0;

    payments.forEach((p) => {
      const payTime = toTime(p.created_at || p.date || p.payment_date);
      const note = String(p.note || "").toLowerCase();
      const isInitial =
        note.includes("initial") || (recordTime && payTime && Math.abs(payTime - recordTime) <= 5000);
      if (isInitial) return;

      const amount = parseFloat(p.amount) || 0;
      laterForRecord += amount;
      entries.push({
        key: `pay-${v.id}-${p.id ?? payTime}`,
        rank: RANK.vendorPay,
        id: Number(p.id) || 0,
        ts: payTime,
        date: p.created_at || p.date || p.payment_date,
        invoiceNo: v.invoice_number || "-",
        details: "Vendor Payment",
        product: v.products || "-",
        price: 0,
        qty: 0,
        cashIn: 0,
        cashOut: amount,
        ownerDelta: 0,
        payableDelta: -amount,
        isVendor: true,
      });
    });

    const total = parseFloat(v.total_amount) || 0;
    const initialPaid = Math.max(0, (parseFloat(v.paid_amount) || 0) - laterForRecord);
    const qty = parseInt(v.stock_quantity) || 0;

    entries.push({
      key: `cred-${v.id}`,
      rank: RANK.credit,
      id: Number(v.id) || 0,
      ts: recordTime,
      date: v.created_at,
      invoiceNo: v.invoice_number || "-",
      details: "Inventory Purchase - Credit",
      product: v.products || "-",
      price: qty ? total / qty : total,
      qty,
      cashIn: 0,
      cashOut: 0,
      ownerDelta: initialPaid,
      costDelta: total,
      payableDelta: total - initialPaid,
      isVendor: true,
    });
  });

  /* 3) INVENTORY SELL (billing invoices) */
  invoices.forEach((inv) => {
    (inv.items || []).forEach((item, idx) => {
      const qty = parseInt(item.quantity || 1) || 0;
      const unit = parseFloat(item.price ?? item.unit_price ?? item.selling_price) || 0;
      const key = (item.service_name || "").toLowerCase().trim();

      /* Service item = service_category is present and is not "Product" */
      const cat = String(item.service_category || "").trim().toLowerCase();
      const isService = cat !== "" && cat !== "product";

      const hasProfitField =
        item.profit !== undefined && item.profit !== null && !isNaN(parseFloat(item.profit));

      let cost;
      if (isService) {
        cost = 0; // a service has no purchase cost
      } else if (hasProfitField) {
        cost = unit * qty - parseFloat(item.profit);
      } else {
        cost = (parseFloat(item.purchase_price ?? item.cost_price ?? purchaseByName[key]) || 0) * qty;
      }

      const knownCost =
        hasProfitField ||
        item.purchase_price != null ||
        item.cost_price != null ||
        purchaseByName[key] !== undefined;

      /* Service: whole amount is profit. Product: selling - purchase. */
      const profit = isService ? unit * qty : knownCost ? unit * qty - cost : 0;

      entries.push({
        key: `inv-${inv.id}-${idx}`,
        rank: RANK.sell,
        id: Number(inv.id) * 1000 + idx,
        ts: toTime(inv.invoice_date || inv.created_at),
        date: inv.invoice_date || inv.created_at,
        invoiceNo: inv.invoice_no || inv.invoice_number || `#${inv.id}`,
        details: isService ? "Service Sell" : "Inventory Sell",
        product: item.service_name,
        price: unit,
        qty,
        cashIn: cost,
        cashOut: 0,
        profit,
        ownerDelta: 0,
        ownerReturn: cost,
        costDelta: -cost,
        payableDelta: 0,
        isVendor: false,
      });
    });
  });

  /* 3b) EXPENSES - fixed + monthly/extra */
  expenses.forEach((ex) => {
    const amount = parseFloat(ex.amount) || 0;
    if (amount <= 0) return;
    const date = ex.expense_date || ex.date || ex.created_at;
    const isFixed = FIXED_CATEGORIES.includes(ex.category);
    entries.push({
      key: `exp-${ex.id}`,
      rank: RANK.expense,
      id: Number(ex.id) || 0,
      ts: toTime(date),
      date,
      invoiceNo: "-",
      details: isFixed ? "Fixed Expense" : "Extra Expense",
      product: ex.description ? `${ex.description} (${ex.category || "General"})` : ex.category || "-",
      price: 0,
      qty: 0,
      cashIn: 0,
      cashOut: 0,
      expense: amount,
      ownerDelta: 0,
      payableDelta: 0,
      isVendor: false,
    });
  });

  /* 3c) EMPLOYEE SALARY - each payment on its own date */
  employees.forEach((emp) => {
    (Array.isArray(emp.payments) ? emp.payments : []).forEach((p) => {
      const amount = parseFloat(p.amount) || 0;
      if (amount <= 0) return;
      const date = p.payment_date || p.created_at;
      entries.push({
        key: `sal-${emp.id}-${p.id}`,
        rank: RANK.expense,
        id: Number(p.id) || 0,
        ts: toTime(date),
        date,
        invoiceNo: "-",
        details: "Salary",
        product: emp.name || "-",
        price: 0,
        qty: 0,
        cashIn: 0,
        cashOut: 0,
        expense: amount,
        ownerDelta: 0,
        payableDelta: 0,
        isVendor: false,
      });
    });
  });

  /* 4) Manual Cash in Hand */
  if (cashEntries.length > 0) {
    cashEntries.forEach((c) => {
      const amount = parseFloat(c.amount) || 0;
      if (amount <= 0) return;
      const isAdd = c.type === "add";
      entries.push({
        key: `cash-${c.id}`,
        rank: RANK.cash,
        id: Number(c.id) || 0,
        ts: toTime(c.created_at),
        date: c.created_at,
        invoiceNo: "-",
        details: isAdd ? "Cash in Hand (Add)" : "Cash in Hand (Withdraw)",
        product: c.note || "-",
        price: 0,
        qty: 0,
        cashIn: isAdd ? amount : 0,
        cashOut: isAdd ? 0 : amount,
        ownerDelta: 0,
        payableDelta: 0,
        isVendor: false,
      });
    });
  } else if (manualCash > 0) {
    const firstTs = entries.length ? Math.min(...entries.map((e) => e.ts)) : Date.now();
    entries.push({
      key: "manual-cash",
      rank: RANK.cash,
      id: 0,
      ts: firstTs,
      date: firstTs,
      invoiceNo: "-",
      details: "Cash in Hand (Manual)",
      product: "-",
      price: 0,
      qty: 0,
      cashIn: manualCash,
      cashOut: 0,
      ownerDelta: 0,
      payableDelta: 0,
      isVendor: false,
    });
  }

  entries.sort((a, b) => a.ts - b.ts || a.rank - b.rank || a.id - b.id);

  return entries;
};

const getPageList = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const list = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) result.push("...");
    result.push(p);
  });
  return result;
};

const PageBtn = ({ children, onClick, disabled, active, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-semibold transition ${
      active
        ? "bg-amber-400 text-slate-900"
        : "bg-slate-800/70 text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800/70"
    }`}
  >
    {children}
  </button>
);

const plainNum = (n) => Number(n || 0);

const exportFileName = () => `Inventory_History_${new Date().toISOString().slice(0, 10)}`;

export default function InventoryHistory() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [page, setPage] = useState(1);

  const [raw, setRaw] = useState({
    products: [],
    vendors: [],
    invoices: [],
    cashEntries: [],
    manualCash: 0,
    expenses: [],
    employees: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const jumpedToLast = useRef(false);
  const tableScrollRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [prodRes, vendRes, invRes, cashRes, expRes, empRes] = await Promise.all([
        api.get("/products", { params: { show_hidden: "true" } }),
        api.get("/credit/vendors"),
        api.get("/invoices"),
        api.get("/cash-in-hand").catch(() => null),
        api.get("/expenses").catch(() => null),
        api.get("/employees").catch(() => null),
      ]);
      setRaw({
        products: toArray(prodRes),
        vendors: toArray(vendRes),
        invoices: toArray(invRes),
        cashEntries: cashRes ? parseCashEntries(cashRes) : [],
        manualCash: cashRes ? parseManualCash(cashRes) : 0,
        expenses: expRes ? toArray(expRes) : [],
        employees: empRes ? toArray(empRes) : [],
      });
      jumpedToLast.current = false;
    } catch (e) {
      console.error("Inventory history load error:", e);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    const entries = buildEntries(raw);
    let cash = 0;
    let payable = 0;
    let owner = 0;
    let invCost = 0;
    return entries.map((e, i) => {
      cash += e.cashIn - e.cashOut - e.ownerDelta;
      payable += e.payableDelta;
      owner = Math.max(0, owner + e.ownerDelta - (e.ownerReturn || 0));
      invCost += e.costDelta || 0;
      return {
        ...e,
        sr: i + 1,
        cashInHand: cash,
        vendorPay: e.isVendor ? payable : 0,
        ownerCapital: owner,
        inventoryCost: invCost,
      };
    });
  }, [raw]);

  const totals = useMemo(
    () => ({
      cashIn: rows.reduce((s, r) => s + r.cashIn, 0),
      cashOut: rows.reduce((s, r) => s + r.cashOut, 0),
      expense: rows.reduce((s, r) => s + (r.expense || 0), 0),
      profit: rows.reduce((s, r) => s + (r.profit || 0), 0),
      vendorPay: rows.reduce((s, r) => s + r.payableDelta, 0),
      ownerCapital: rows.length ? rows[rows.length - 1].ownerCapital : 0,
      inventoryCost: rows.length ? rows[rows.length - 1].inventoryCost : 0,
      cashInHand: rows.length ? rows[rows.length - 1].cashInHand : 0,
    }),
    [rows]
  );

  /* ---------- Export: Excel ---------- */
  const exportExcel = () => {
    if (!rows.length) return;

    const header = COLUMNS.map((c) => c.label);
    const body = rows.map((r) => {
      const dt = fmtDate(r.date);
      return [
        r.sr,
        `${dt.date} ${dt.time}`.trim(),
        r.invoiceNo,
        r.details,
        r.product || "-",
        plainNum(r.price),
        plainNum(r.qty),
        plainNum(r.cashIn),
        plainNum(r.cashOut),
        r.isVendor ? plainNum(r.vendorPay) : "",
        plainNum(r.ownerCapital),
        plainNum(r.cashInHand),
        plainNum(r.inventoryCost),
        plainNum(r.expense),
        plainNum(r.profit),
      ];
    });

    const totalRow = [
      "", "", "", "", "", "",
      "GRAND TOTAL",
      plainNum(totals.cashIn),
      plainNum(totals.cashOut),
      plainNum(totals.vendorPay),
      plainNum(totals.ownerCapital),
      plainNum(totals.cashInHand),
      plainNum(totals.inventoryCost),
      plainNum(totals.expense),
      plainNum(totals.profit),
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...body, totalRow]);
    ws["!cols"] = [
      { wch: 7 }, { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 26 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
      { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory History");
    XLSX.writeFile(wb, `${exportFileName()}.xlsx`);
  };

  /* ---------- Export: PDF ---------- */
  const exportPdf = () => {
    if (!rows.length) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });

    doc.setFontSize(16);
    doc.text("Inventory History - Balance Sheet", 40, 36);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleString("en-GB")}`, 40, 52);

    const num = (n) => Number(n || 0).toLocaleString("en-PK");

    const body = rows.map((r) => {
      const dt = fmtDate(r.date);
      return [
        r.sr,
        `${dt.date}\n${dt.time}`,
        r.invoiceNo,
        r.details,
        r.product || "-",
        r.price ? num(r.price) : "-",
        r.qty || "-",
        r.cashIn ? num(r.cashIn) : "-",
        r.cashOut ? num(r.cashOut) : "-",
        r.isVendor ? num(r.vendorPay) : "-",
        num(r.ownerCapital),
        num(r.cashInHand),
        num(r.inventoryCost),
        r.expense ? num(r.expense) : "-",
        r.profit ? num(r.profit) : "-",
      ];
    });

    const foot = [
      [
        { content: "GRAND TOTAL", colSpan: 7, styles: { halign: "right" } },
        num(totals.cashIn),
        num(totals.cashOut),
        num(totals.vendorPay),
        num(totals.ownerCapital),
        num(totals.cashInHand),
        num(totals.inventoryCost),
        num(totals.expense),
        num(totals.profit),
      ],
    ];

    autoTable(doc, {
      startY: 66,
      head: [COLUMNS.map((c) => c.label)],
      body,
      foot,
      showFoot: "lastPage",
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, valign: "middle" },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: "bold" },
      columnStyles: {
        0: { halign: "left", cellWidth: 34 },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
        10: { halign: "right" },
        11: { halign: "right" },
        12: { halign: "right" },
        13: { halign: "right" },
        14: { halign: "right" },
      },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index >= 5) {
          data.cell.styles.halign = "right";
        }
      },
      margin: { left: 40, right: 40 },
    });

    doc.save(`${exportFileName()}.pdf`);
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    if (!loading && rows.length && !jumpedToLast.current) {
      jumpedToLast.current = true;
      setPage(totalPages);
    }
  }, [loading, rows.length, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
  }, [page]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = rows.length ? startIdx + 1 : 0;
  const showingTo = Math.min(startIdx + PAGE_SIZE, rows.length);

  const exportDisabled = loading || rows.length === 0;

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 flex flex-col overflow-hidden bg-[#050a14] text-slate-200 transition-all duration-300"
      style={{ left: showSidebar ? SIDEBAR_WIDTH : 0 }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1700px] flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0b1220] px-4 py-3">
          <button
            onClick={() => setShowSidebar((s) => !s)}
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
              showSidebar
                ? "border-amber-400 bg-amber-400 text-slate-900"
                : "border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {showSidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
            <History className="text-amber-400" size={18} />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight text-white">Inventory History</h1>
            <p className="text-xs text-slate-500">Balance Sheet</p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh this page"
            className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={exportExcel}
            disabled={exportDisabled}
            title="Download Excel report"
            className="flex h-10 items-center gap-2 rounded-lg bg-emerald-600/80 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>

          <button
            onClick={exportPdf}
            disabled={exportDisabled}
            title="Download PDF report"
            className="flex h-10 items-center gap-2 rounded-lg bg-red-600/80 px-4 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileDown size={16} />
            PDF
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0b1220]">
          <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
            {loading && rows.length === 0 ? (
              <div className="flex h-full items-center justify-center gap-3 text-slate-400">
                <Loader2 className="animate-spin text-amber-400" size={22} />
                Loading history...
              </div>
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                <p>{error}</p>
                <button
                  onClick={loadData}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300"
                >
                  Retry
                </button>
              </div>
            ) : (
              <table className="w-full min-w-[1700px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-[#0b1220]">
                  <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
                    {COLUMNS.map((c) => (
                      <th
                        key={c.label}
                        className={`whitespace-nowrap border-r border-slate-800 px-4 py-3.5 last:border-r-0 ${alignCls[c.align]}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="px-4 py-10 text-center font-semibold text-slate-500">
                        No records found
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => {
                      const dt = fmtDate(r.date);
                      return (
                        <tr key={r.key} className="border-b border-slate-800/70 hover:bg-slate-800/30">
                          <td className="border-r border-slate-800/60 px-4 py-3 text-slate-500">{r.sr}</td>
                          <td className="whitespace-nowrap border-r border-slate-800/60 px-4 py-3">
                            <div className="text-slate-300">{dt.date}</div>
                            <div className="text-xs text-slate-500">{dt.time}</div>
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 font-semibold text-amber-400">
                            {r.invoiceNo}
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-slate-300">{r.details}</td>
                          <td className="border-r border-slate-800/60 px-4 py-3 font-medium text-white">
                            {r.product || "-"}
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right">{money(r.price)}</td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right">{r.qty || "-"}</td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right font-semibold text-emerald-400">
                            {money(r.cashIn)}
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right font-semibold text-rose-400">
                            {money(r.cashOut)}
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right font-semibold text-purple-300">
                            {r.isVendor ? money(r.vendorPay) : "-"}
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right font-semibold text-blue-400">
                            {money(r.ownerCapital)}
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right font-bold text-white">
                            {money(r.cashInHand)}
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right font-semibold text-cyan-400">
                            {money(r.inventoryCost)}
                          </td>
                          <td className="border-r border-slate-800/60 px-4 py-3 text-right font-semibold text-orange-400">
                            {money(r.expense)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-lime-400">
                            {money(r.profit)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                <tfoot className="sticky bottom-0 bg-[#0b1220]">
                  <tr className="border-t-2 border-slate-600 text-sm font-bold">
                    <td colSpan={7} className="px-4 py-3.5 text-right uppercase tracking-wide text-slate-400">
                      Grand Total
                    </td>
                    <td className="px-4 py-3.5 text-right text-emerald-400">{money(totals.cashIn)}</td>
                    <td className="px-4 py-3.5 text-right text-rose-400">{money(totals.cashOut)}</td>
                    <td className="px-4 py-3.5 text-right text-purple-300">{money(totals.vendorPay)}</td>
                    <td className="px-4 py-3.5 text-right text-blue-400">{money(totals.ownerCapital)}</td>
                    <td className="px-4 py-3.5 text-right text-white">{money(totals.cashInHand)}</td>
                    <td className="px-4 py-3.5 text-right text-cyan-400">{money(totals.inventoryCost)}</td>
                    <td className="px-4 py-3.5 text-right text-orange-400">{money(totals.expense)}</td>
                    <td className="px-4 py-3.5 text-right text-lime-400">{money(totals.profit)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-300">{showingFrom}</span> to{" "}
              <span className="font-semibold text-slate-300">{showingTo}</span> of{" "}
              <span className="font-semibold text-slate-300">{rows.length}</span> records
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <PageBtn title="First" onClick={() => setPage(1)} disabled={page === 1}>
                <ChevronsLeft size={16} />
              </PageBtn>
              <PageBtn title="Previous" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={16} />
              </PageBtn>

              {getPageList(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-slate-600">
                    ...
                  </span>
                ) : (
                  <PageBtn key={p} active={p === page} onClick={() => setPage(p)}>
                    {p}
                  </PageBtn>
                )
              )}

              <PageBtn
                title="Next"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight size={16} />
              </PageBtn>
              <PageBtn title="Last" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                <ChevronsRight size={16} />
              </PageBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}