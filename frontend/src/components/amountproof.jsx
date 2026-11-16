import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuReceipt,
  LuImage,
  LuShieldAlert,
  LuCircleCheck,
  LuX,
  LuArrowRight,
  LuClock,
  LuMail,
  LuShieldCheck,
} from "react-icons/lu";
import api from "../services/api";
import { useSubscription, formatPKR, fmtDate, TOKEN_KEY } from "./useSubscription";
import "./amountproof.css";

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

// config import ki zaroorat nahi: api.js ka baseURL wahi API_URL hai
const API_URL = api.defaults.baseURL;

export default function AmountProof() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // remaining (baaki bacha hua amount) liya
  const { loading, error: loadError, reload, remaining, billingStart, isPaid } = useSubscription();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const billingLabel = billingStart ? fmtDate(billingStart) : "-";

  /* ---------- validate file + preview ---------- */
  const pickFile = (f) => {
    if (!f) return;

    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Please upload a JPG or PNG file only");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be smaller than ${MAX_SIZE_MB}MB`);
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleChange = (e) => {
    pickFile(e.target.files?.[0]);
    e.target.value = ""; // allows selecting the same file again
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const removeFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setError("");
  };

  /* ---------- submit ---------- */
  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a payment screenshot first");
      return;
    }
    if (!billingStart) {
      setError("Subscription details are not loaded yet");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file); // backend "image" field expect karta hai
      formData.append("amount", String(remaining)); // sirf bacha hua amount jayega

      const token = localStorage.getItem(TOKEN_KEY);

      const res = await fetch(`${API_URL}/subscription/proofs`, {
        method: "POST",
        headers: {
          Accept: "application/json", // makes Laravel return JSON errors
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Do NOT set Content-Type here; the browser sets it automatically for FormData
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
        throw new Error(firstError || data?.message || "Upload failed. Please try again.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     LOADING / NOT-READY SCREENS
     ============================================================ */
  if (loading) {
    return (
      <div className="apf-page">
        <div className="apf-card">
          <p className="apf-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (loadError || isPaid) {
    return (
      <div className="apf-page">
        <div className="apf-card">
          <h1 className="apf-title">Upload Payment Proof</h1>
          <p className="apf-subtitle">
            {loadError ? loadError : "This billing period is already paid."}
          </p>
          {loadError && (
            <button className="apf-btn" onClick={reload}>
              Retry
            </button>
          )}
          <p className="apf-skip" onClick={() => navigate("/admin/amounts")}>
            Go back
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     SUCCESS SCREEN
     ============================================================ */
  if (submitted) {
    return (
      <div className="apf-page">
        <div className="apf-card apf-success">
          <div className="apf-success-icon">
            <LuCircleCheck size={36} />
          </div>
          <h1 className="apf-title">Payment Proof Received!</h1>

          <div className="apf-pill">
            <span>Amount:</span>
            <strong>{formatPKR(remaining)}</strong>
          </div>

          <p className="apf-success-text">
            Your payment screenshot has been submitted successfully.
          </p>

          <div className="apf-notice">
            <LuClock size={18} />
            <span>
              Your payment verification is pending. The status will be updated once the
              admin verifies it.
            </span>
          </div>

          <div className="apf-next">
            <h3 className="apf-next-title">WHAT'S NEXT?</h3>
            <ul>
              <li>
                <LuShieldCheck size={16} /> The admin will verify your payment
              </li>
              <li>
                <LuMail size={16} /> You will receive a confirmation once it is verified
              </li>
            </ul>
          </div>

          <button className="apf-btn" onClick={() => navigate("/admin/amounts")}>
            Back to Amounts <LuArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     UPLOAD SCREEN
     ============================================================ */
  return (
    <div className="apf-page">
      <div className="apf-card">
        <div className="apf-head">
          <div className="apf-head-icon">
            <LuReceipt size={26} />
          </div>
          <h1 className="apf-title">Upload Payment Proof</h1>
          <p className="apf-subtitle">Please upload a screenshot of your payment confirmation</p>
        </div>

        <div className="apf-ref">
          <span className="apf-ref-label">Amount to Pay</span>
          <strong className="apf-ref-value">{formatPKR(remaining)}</strong>
          <span className="apf-ref-note">Billing Period: {billingLabel}</span>
        </div>

        <div className="apf-instructions">
          <h3>
            <LuShieldAlert size={14} /> Important Instructions
          </h3>
          <ul>
            <li>Upload a clear screenshot of the payment confirmation</li>
            <li>The screenshot should show the transaction ID and amount</li>
            <li>File format: JPG, PNG — max {MAX_SIZE_MB}MB</li>
            <li>Make sure the amount matches {formatPKR(remaining)}</li>
          </ul>
        </div>

        <label className="apf-label">PAYMENT SCREENSHOT *</label>

        {!file ? (
          <div
            className={`apf-drop ${dragging ? "apf-drop-active" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <LuImage size={28} />
            <p className="apf-drop-main">Click or drag to upload screenshot</p>
            <p className="apf-drop-sub">PNG, JPG up to {MAX_SIZE_MB}MB</p>
          </div>
        ) : (
          <div className="apf-preview">
            <img src={preview} alt="Payment screenshot" />
            <button type="button" className="apf-remove" onClick={removeFile} title="Remove">
              <LuX size={16} />
            </button>
            <p className="apf-file-name">{file.name}</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png, image/jpeg"
          hidden
          onChange={handleChange}
        />

        {error && <p className="apf-error">{error}</p>}

        <button className="apf-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Proof"}
          {!submitting && <LuArrowRight size={16} />}
        </button>

        <p className="apf-skip" onClick={() => navigate("/admin/amounts")}>
          Skip for now? Go back
        </p>
      </div>
    </div>
  );
}