import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuFlaskConical,
  LuPlay,
  LuHourglass,
  LuCalendarX,
  LuSearch,
  LuPlus,
  LuTrash2,
  LuCheck,
  LuX,
} from "react-icons/lu";
import api from "../../services/api";
import Sidebar from "./sidebar";
import { getDaysLeft, getEndDate, formatDate, formatISODate, toISO } from "./trialData";
import "./dashboard.css";
import "./trial.css";

/* ------------------------------------------------------------------ */
/*  BACKEND SETTINGS                                                    */
/* ------------------------------------------------------------------ */
// api.js baseURL already has API_URL, so only the paths are needed here
const LIST_ENDPOINT = "/super-admin/trials"; // GET list
const EXTEND_ENDPOINT = (id) => `/super-admin/trials/${id}/extend`; // POST { days }
const CONVERT_ENDPOINT = (id) => `/super-admin/trials/${id}/convert`; // POST (trial -> regular client)
const REMOVE_ENDPOINT = (id) => `/super-admin/trials/${id}`; // DELETE
const TOKEN_KEYS = ["sa_token", "super_admin_token", "superAdminToken", "token"];

const QUICK_DAYS = [1, 3, 7, 14, 30];

const dayLabel = (n) => `${n} ${n === 1 ? "day" : "days"}`;

// In-memory cache: coming back to this page shows the last real data instantly
let trialsCache = null;

/* Demo data: only shown when the API is unreachable and nothing is cached */
const demoData = () => {
  const ago = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISO(d);
  };
  return [
    { id: 1, name: "Ali Traders", phone: "0300-1111111", start_date: ago(1), days: 3 },
    { id: 2, name: "Noor Mart", phone: "0302-3333333", start_date: ago(2), days: 3 },
    { id: 3, name: "City Pharmacy", phone: "0303-4444444", start_date: ago(10), days: 7 },
  ];
};

const getToken = () => {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return "";
};

// Super admin token goes in the header explicitly (api.js reads a different key)
const authConfig = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const isCanceled = (e) => e?.code === "ERR_CANCELED" || e?.name === "CanceledError";

// Picks the best error message out of an axios error
const errMsg = (e, fallback) =>
  e?.response?.data?.message ||
  (e?.response?.status ? `Server error ${e.response.status}` : e?.message) ||
  fallback;

/* Accepts any API response shape (array or { data: [] }) and converts it to a list of trials */
const normalize = (json) => {
  const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name ?? r.client_name ?? "-",
    phone: r.phone ?? "",
    start_date: String(r.start_date ?? r.started_at ?? r.created_at ?? "").slice(0, 10),
    days: Number(r.days ?? r.trial_days ?? 0),
  }));
};

export default function Trial() {
  const navigate = useNavigate();
  const token = localStorage.getItem("sa_token");

  const [trials, setTrials] = useState(() => trialsCache ?? []);
  const [loading, setLoading] = useState(() => !trialsCache);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState("");
  const [search, setSearch] = useState("");

  // Used to cancel an older request when a newer one starts
  const abortRef = useRef(null);

  // Toasts (bottom right)
  const [toasts, setToasts] = useState([]);

  // Extend dialog
  const [extendTarget, setExtendTarget] = useState(null);
  const [extendDays, setExtendDays] = useState("3");
  const [extendBusy, setExtendBusy] = useState(false);

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  // ID of the trial currently being converted
  const [convertingId, setConvertingId] = useState(null);

  const showToast = useCallback((type, text) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // No token: send the user to the login page
  useEffect(() => {
    if (!token) navigate("/super-admin/login", { replace: true });
  }, [token, navigate]);

  const handleLogout = async () => {
    try {
      await api.post("/super-admin/logout", null, authConfig());
    } catch {
      /* log out locally even if the server is unreachable */
    }
    trialsCache = null;
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_user");
    navigate("/super-admin/login", { replace: true });
  };

  /**
   * Cached data is shown right away and refreshed silently.
   * "Loading..." only appears on the very first visit (nothing cached yet),
   * and never after Extend / Remove / Make Client.
   */
  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (trialsCache !== null) setRefreshing(true);
    else setLoading(true);
    setApiError("");

    try {
      const res = await api.get(LIST_ENDPOINT, { ...authConfig(), signal: ctrl.signal });
      const list = normalize(res.data);
      trialsCache = list;
      setTrials(list);
    } catch (e) {
      if (isCanceled(e)) return; // a newer load took over
      setApiError(errMsg(e, "Could not load data"));
      // Keep real data if we have it; demo data only when nothing was ever loaded
      if (trialsCache === null) setTrials(demoData());
    } finally {
      if (abortRef.current === ctrl) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort(); // cancel the request when leaving the page
    };
  }, [load]);

  /* ---------------- Extend ---------------- */
  const openExtend = (t) => {
    setExtendTarget(t);
    setExtendDays("3");
  };

  const confirmExtend = async () => {
    if (!extendTarget) return;
    const n = Number(extendDays);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      showToast("error", "Enter a number of days between 1 and 365");
      return;
    }
    setExtendBusy(true);
    try {
      await api.post(EXTEND_ENDPOINT(extendTarget.id), { days: n }, authConfig());
      showToast("success", `${extendTarget.name}'s trial was extended by ${dayLabel(n)}`);
      setExtendTarget(null);
      await load(); // silent refresh, the table stays visible
    } catch (e) {
      showToast("error", errMsg(e, "Could not extend the trial"));
    } finally {
      setExtendBusy(false);
    }
  };

  /* ---------------- Remove ---------------- */
  const confirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveBusy(true);
    try {
      await api.delete(REMOVE_ENDPOINT(target.id), authConfig());
      showToast("success", `${target.name} was removed from the trial list`);

      // Drop the row right away, then confirm with the server in the background
      setTrials((prev) => {
        const next = prev.filter((t) => t.id !== target.id);
        trialsCache = next;
        return next;
      });
      setRemoveTarget(null);
      load();
    } catch (e) {
      showToast("error", errMsg(e, "Could not remove the trial"));
    } finally {
      setRemoveBusy(false);
    }
  };

  /* ---------------- Convert: trial -> regular monthly client ---------------- */
  const makeClient = async (t) => {
    if (convertingId !== null) return;
    setConvertingId(t.id);
    try {
      await api.post(CONVERT_ENDPOINT(t.id), null, authConfig());
      showToast("success", `${t.name} is now a regular monthly client`);
      await load();
    } catch (e) {
      showToast("error", errMsg(e, "Could not convert to a client"));
    } finally {
      setConvertingId(null);
    }
  };

  /* ---------------- Derived data ---------------- */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trials
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.phone.toLowerCase().includes(q))
      .map((t) => ({ t, left: getDaysLeft(t) }))
      .sort((a, b) => a.left - b.left);
  }, [trials, search]);

  const { running, expiring, expired } = useMemo(() => {
    let run = 0;
    let exp = 0;
    let end = 0;
    trials.forEach((t) => {
      const l = getDaysLeft(t);
      if (l < 0) end += 1;
      else if (l <= 1) exp += 1;
      else run += 1;
    });
    return { running: run, expiring: exp, expired: end };
  }, [trials]);

  if (!token) return null;

  return (
    <div className="sas-layout">
      <Sidebar onLogout={handleLogout} />

      <main className="sas-content">
        <div className="trial-page">
          {/* Header */}
          <div className="trial-header">
            <h1 className="trial-title">Trial Users</h1>
            <p className="trial-subtitle">
              Companies currently trying the software. Each user has their own number of trial days.
            </p>
          </div>

          {apiError && (
            <div className="trial-alert">
              {apiError}. {trialsCache ? "Showing the last loaded data." : "Showing demo data."}
              <button className="trial-alert-btn" onClick={load}>Retry</button>
            </div>
          )}

          {/* KPI cards */}
          <div className="trial-cards">
            <div className="trial-card">
              <div className="trial-icon trial-icon-amber"><LuFlaskConical size={24} /></div>
              <div className="trial-card-body">
                <span className="trial-card-label">Total Trials</span>
                <span className="trial-card-value">{trials.length}</span>
                <span className="trial-card-note">Trials given so far</span>
              </div>
            </div>

            <div className="trial-card">
              <div className="trial-icon trial-icon-green"><LuPlay size={24} /></div>
              <div className="trial-card-body">
                <span className="trial-card-label">Running</span>
                <span className="trial-card-value trial-green">{running}</span>
                <span className="trial-card-note">Currently active</span>
              </div>
            </div>

            <div className="trial-card">
              <div className="trial-icon trial-icon-orange"><LuHourglass size={24} /></div>
              <div className="trial-card-body">
                <span className="trial-card-label">Expiring (1 day)</span>
                <span className="trial-card-value trial-orange">{expiring}</span>
                <span className="trial-card-note">Ending soon</span>
              </div>
            </div>

            <div className="trial-card">
              <div className="trial-icon trial-icon-red"><LuCalendarX size={24} /></div>
              <div className="trial-card-body">
                <span className="trial-card-label">Expired</span>
                <span className="trial-card-value trial-red">{expired}</span>
                <span className="trial-card-note">Trial has ended</span>
              </div>
            </div>
          </div>

          {/* List panel */}
          <div className="trial-panel">
            <div className="trial-panel-head">
              <div>
                <h2 className="trial-panel-title">Trial List ({rows.length})</h2>
                <p className="trial-panel-sub">{refreshing ? "Refreshing..." : "Ending soonest first"}</p>
              </div>
              <div className="trial-search-wrap">
                <LuSearch size={16} />
                <input
                  className="trial-search"
                  placeholder="Search name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="trial-table-wrap">
              <table className="trial-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Start</th>
                    <th>Days Given</th>
                    <th>End Date</th>
                    <th>Days Left</th>
                    <th>Status</th>
                    <th>Client</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && trials.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="trial-empty">Loading...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="trial-empty">No trial users found</td>
                    </tr>
                  ) : (
                    rows.map(({ t, left }, i) => {
                      const status = left < 0 ? "expired" : left <= 1 ? "expiring" : "running";
                      return (
                        <tr key={t.id}>
                          <td>{i + 1}</td>
                          <td>
                            <div className="trial-user">{t.name}</div>
                            <div className="trial-phone">{t.phone || "-"}</div>
                          </td>
                          <td>{formatISODate(t.start_date)}</td>
                          <td>{dayLabel(t.days)}</td>
                          <td>{formatDate(getEndDate(t))}</td>
                          <td className="trial-left">
                            {left < 0 ? "-" : left === 0 ? "Last day today" : dayLabel(left)}
                          </td>
                          <td>
                            <span className={`trial-badge trial-badge-${status}`}>
                              {status === "expired" ? "Expired" : status === "expiring" ? "Expiring" : "Running"}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`trial-switch ${convertingId === t.id ? "trial-switch-on" : ""}`}
                              role="switch"
                              aria-checked={convertingId === t.id}
                              title="Make Client (convert to a regular monthly user)"
                              disabled={convertingId !== null}
                              onClick={() => makeClient(t)}
                            >
                              <span className="trial-switch-knob" />
                            </button>
                            <span className="trial-switch-label">Make Client</span>
                          </td>
                          <td>
                            <div className="trial-actions">
                              <button className="trial-btn-sm" onClick={() => openExtend(t)}>
                                <LuPlus size={14} />
                                Extend
                              </button>
                              <button className="trial-btn-sm trial-btn-danger" onClick={() => setRemoveTarget(t)}>
                                <LuTrash2 size={14} />
                                Remove
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
          </div>
        </div>
      </main>

      {/* ---------------- Extend dialog ---------------- */}
      {extendTarget && (
        <div className="trial-modal-bg" onClick={() => !extendBusy && setExtendTarget(null)}>
          <div className="trial-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="trial-modal-title">Extend Trial</h3>
            <p className="trial-modal-text">
              How many days do you want to add to <b>{extendTarget.name}</b>'s trial?
            </p>
            <input
              className="trial-input"
              type="number"
              min={1}
              max={365}
              autoFocus
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmExtend()}
            />
            <div className="trial-quick" style={{ marginTop: 12 }}>
              {QUICK_DAYS.map((d) => (
                <button
                  key={d}
                  className={`trial-chip ${Number(extendDays) === d ? "trial-chip-active" : ""}`}
                  onClick={() => setExtendDays(String(d))}
                >
                  {dayLabel(d)}
                </button>
              ))}
            </div>
            <div className="trial-modal-actions">
              <button
                className="trial-modal-btn trial-modal-btn-ghost"
                onClick={() => setExtendTarget(null)}
                disabled={extendBusy}
              >
                Cancel
              </button>
              <button
                className="trial-modal-btn trial-modal-btn-primary"
                onClick={confirmExtend}
                disabled={extendBusy}
              >
                {extendBusy ? "Extending..." : "Extend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Remove dialog ---------------- */}
      {removeTarget && (
        <div className="trial-modal-bg" onClick={() => !removeBusy && setRemoveTarget(null)}>
          <div className="trial-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="trial-modal-title">Remove Trial?</h3>
            <p className="trial-modal-text">
              Remove <b>{removeTarget.name}</b> from the trial list? Their access will be blocked.
            </p>
            <div className="trial-modal-actions">
              <button
                className="trial-modal-btn trial-modal-btn-ghost"
                onClick={() => setRemoveTarget(null)}
                disabled={removeBusy}
              >
                Cancel
              </button>
              <button
                className="trial-modal-btn trial-modal-btn-danger"
                onClick={confirmRemove}
                disabled={removeBusy}
              >
                {removeBusy ? "Removing..." : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Toasts (bottom right) ---------------- */}
      <div className="trial-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`trial-toast trial-toast-${t.type}`}>
            {t.type === "success" ? <LuCheck size={16} /> : <LuX size={16} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}