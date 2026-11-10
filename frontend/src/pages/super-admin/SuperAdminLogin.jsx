import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../../config";

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  background: "#1f1f24",
  color: "#fff",
  border: "1px solid #3a3a42",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 15,
  colorScheme: "dark",
};

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.message ?? "Login fail ho gaya.");
        return;
      }

      localStorage.setItem("sa_token", json.token);
      localStorage.setItem("sa_user", JSON.stringify(json.user));
      navigate("/super-admin/dashboard");
    } catch {
      setError("Server se connect nahi ho saka.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0d" }}>
      {/* Browser autofill ka light-blue background hatane ke liye */}
      <style>{`
        .sa-input:-webkit-autofill,
        .sa-input:-webkit-autofill:hover,
        .sa-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff;
          -webkit-box-shadow: 0 0 0 1000px #1f1f24 inset;
          caret-color: #fff;
        }
        .sa-input::placeholder { color: #8a8a94; }
      `}</style>

      <form
        onSubmit={handleSubmit}
        style={{ width: 360, padding: 28, background: "#141417", borderRadius: 12, color: "#fff" }}
      >
        <h2 style={{ marginBottom: 16 }}>Super Admin Login</h2>
        {error && <p style={{ color: "#ff5c6c", marginBottom: 12 }}>{error}</p>}

        <input
          className="sa-input"
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        <input
          className="sa-input"
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 10, borderRadius: 8, background: "#e63950", color: "#fff", border: 0, cursor: "pointer" }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}