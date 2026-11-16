import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  LuCreditCard,
  LuCalendar,
  LuClock,
  LuCircleCheck,
  LuCopy,
  LuCheck,
  LuSmartphone,
  LuLandmark,
  LuArrowDown,
  LuArrowRight,
  LuRepeat,
} from "react-icons/lu";
import api from "../services/api";
import { useSubscription, formatPKR, fmtDate } from "./useSubscription";
import "./amounts.css";

// Payment details that the super admin sets on the Money Channels page
const CHANNELS_ENDPOINT = "/payment-channels";

const META = {
  jazzcash: { name: "JazzCash", icon: LuSmartphone, tone: "red" },
  easypaisa: { name: "Easypaisa", icon: LuSmartphone, tone: "green" },
  bank: { name: "Bank Transfer", icon: LuLandmark, tone: "blue" },
};

/* Only the details that are filled in (empty ones are hidden) */
const detailsOf = (c) => {
  const list =
    c.type === "bank"
      ? [
          { label: "Bank Name", value: c.bank_name },
          { label: "Account Title", value: c.account_title },
          { label: "Account Number", value: c.account_number },
          { label: "IBAN", value: c.iban },
        ]
      : [
          { label: "Account Title", value: c.account_title },
          { label: "Mobile Number", value: c.account_number },
        ];
  return list.filter((d) => String(d.value || "").trim() !== "");
};

/* ------------------------------------------------------------
   Copy button
   ------------------------------------------------------------ */
function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert("Couldn't copy. Please try again.");
    }
  };

  return (
    <button
      type="button"
      className={`amt-copy ${copied ? "amt-copy-done" : ""}`}
      onClick={handleCopy}
      title="Copy"
    >
      {copied ? <LuCheck size={16} /> : <LuCopy size={16} />}
    </button>
  );
}

/* ------------------------------------------------------------
   Payment method card
   ------------------------------------------------------------ */
function MethodCard({ channel }) {
  const meta = META[channel.type];
  if (!meta) return null;
  const Icon = meta.icon;
  const details = detailsOf(channel);

  // If no QR image was uploaded, generate a QR code from the details instead
  const fallbackQr = `${meta.name}\n` + details.map((d) => `${d.label}: ${d.value}`).join("\n");

  return (
    <div className="amt-method">
      <div className={`amt-method-head amt-tone-${meta.tone}`}>
        <div className="amt-method-icon">
          <Icon size={20} />
        </div>
        <h3 className="amt-method-name">{meta.name}</h3>
      </div>

      <div className="amt-method-body">
        <div className="amt-qr-wrap">
          {/* Uploaded image: box ko poora cover karti hai (white padding nahi).
              Generated QR: white background + padding (scan ke liye zaroori) */}
          <div className={`amt-qr ${channel.qr_url ? "amt-qr-photo" : ""}`}>
            {channel.qr_url ? (
              <img
                src={channel.qr_url}
                alt={`${meta.name} QR`}
                className="amt-qr-img"
                decoding="async"
              />
            ) : (
              <QRCodeSVG value={fallbackQr} size={148} level="M" bgColor="#ffffff" fgColor="#000000" />
            )}
          </div>
          <p className="amt-qr-note">Scan to pay</p>
        </div>

        <div className="amt-details">
          {details.map((d) => (
            <div key={d.label} className="amt-detail">
              <div className="amt-detail-text">
                <span className="amt-detail-label">{d.label}</span>
                <span className="amt-detail-value">{d.value}</span>
              </div>
              <CopyButton value={d.value} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Main page
   ------------------------------------------------------------ */
export default function Amounts({ setActiveMenu }) {
  const methodsRef = useRef(null);
  const {
    loading,
    error,
    reload,
    monthlyFee,
    paidAmount,
    remaining,
    billingStart,
    dueDate,
    isPaid,
    isTrial,
    trialDaysLeft,
  } = useSubscription();

  // Payment channels (JazzCash / Easypaisa / Bank) from the backend
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(CHANNELS_ENDPOINT);
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        if (!cancelled) {
          setChannels(
            rows.map((r) => ({
              type: r.type,
              account_title: r.account_title ?? "",
              account_number: r.account_number ?? "",
              bank_name: r.bank_name ?? "",
              iban: r.iban ?? "",
              qr_url: r.qr_url ?? null,
            }))
          );
        }
      } catch {
        if (!cancelled) setChannels([]);
      } finally {
        if (!cancelled) setChannelsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePayNow = () => {
    methodsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleMadePayment = () => {
    if (setActiveMenu) setActiveMenu("amount-proof");
  };

  const infoCards = [
    { label: "Billing Period", value: billingStart ? fmtDate(billingStart) : "-", icon: LuCalendar, tone: "blue" },
    { label: "Pay Due Date", value: dueDate ? fmtDate(dueDate) : "-", icon: LuClock, tone: "red" },
    { label: "Billing Cycle", value: "Monthly", icon: LuRepeat, tone: "purple" },
  ];

  // Thora paid ho to "Partially Paid" dikhega
  const statusText = isPaid ? "Active" : paidAmount > 0 ? "Partially Paid" : isTrial ? "Trial" : "Pending";

  return (
    <div className="amt-page">
      {/* Header */}
      <div className="amt-header">
        <div className="amt-header-icon">
          <LuCreditCard size={24} />
        </div>
        <div>
          <h1 className="amt-title">Amounts</h1>
          <p className="amt-subtitle">Pay your monthly subscription fee here</p>
        </div>
      </div>

      {error && (
        <div className="amt-notice amt-notice-error">
          {error}
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="amt-notice">Loading...</div>
      ) : error ? null : (
        <>
          {/* Free trial notice (payment is still possible during a trial) */}
          {isTrial && !isPaid && (
            <div className="amt-notice">
              You're on a free trial
              {trialDaysLeft !== null ? ` (${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left)` : ""}. Make
              a payment below to start your subscription.
            </div>
          )}

          {/* Hero */}
          <div className="amt-hero">
            <div>
              {/* Paid ho chuka ho to remaining amount bada dikhega */}
              <span className="amt-hero-label">{paidAmount > 0 ? "Remaining Amount" : "Monthly Fee"}</span>
              <div className="amt-hero-amount">{formatPKR(paidAmount > 0 ? remaining : monthlyFee)}</div>
              {paidAmount > 0 && (
                <div className="amt-status">
                  Monthly Fee: {formatPKR(monthlyFee)} · Paid: {formatPKR(paidAmount)}
                </div>
              )}
              <div className="amt-status">
                <LuCircleCheck size={16} />
                Payment Status:
                <strong className={isPaid ? "amt-status-paid" : "amt-status-pending"}>{statusText}</strong>
              </div>
            </div>

            <button className="amt-pay-btn" onClick={handlePayNow} disabled={isPaid}>
              <LuCreditCard size={20} />
              Pay Now
              <LuArrowDown size={16} />
            </button>
          </div>

          {/* Info cards */}
          <div className="amt-info-grid">
            {infoCards.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="amt-info-card">
                <div className={`amt-info-icon amt-info-${tone}`}>
                  <Icon size={22} />
                </div>
                <div className="amt-info-body">
                  <span className="amt-info-label">{label}</span>
                  <span className="amt-info-value">{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Payment methods */}
          <div ref={methodsRef} className="amt-methods-section">
            <h2 className="amt-section-title">Payment Methods</h2>
            <p className="amt-section-sub">Send {formatPKR(remaining)} using any one of these methods.</p>

            {channelsLoading ? (
              <div className="amt-notice">Loading...</div>
            ) : channels.length === 0 ? (
              <div className="amt-notice">Payment details haven't been added yet. Please contact the admin.</div>
            ) : (
              <div className="amt-methods-grid">
                {channels.map((c) => (
                  <MethodCard key={c.type} channel={c} />
                ))}
              </div>
            )}

            {/* I've made the payment */}
            <div className="amt-made-wrap">
              <p className="amt-made-text">Already paid? Upload your payment screenshot.</p>
              <button type="button" className="amt-made-btn" onClick={handleMadePayment} disabled={isPaid}>
                <LuCircleCheck size={18} />
                I've Made the Payment
                <LuArrowRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}