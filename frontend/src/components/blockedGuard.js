// src/components/blockedGuard.js
// Agar company block ho gayi ho to token saaf karke /payment-required par bhej deta hai.
// true return kare to caller ko aage kuch nahi karna (return kar do).

export async function blockedGuard(res) {
  // Sirf 402/403 par check karo, baaki responses ko haath mat lagao
  if (res.status !== 402 && res.status !== 403) return false;

  let data = null;
  try {
    // clone() taake caller baad mein res.json() bhi padh sake
    data = await res.clone().json();
  } catch (e) {
    data = null;
  }

  const isBlocked =
    res.status === 402 ||
    data?.blocked === true ||
    data?.is_blocked === true ||
    data?.code === "COMPANY_BLOCKED" ||
    data?.code === "blocked";

  if (!isBlocked) return false;

  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("isLoggedIn");

  window.location.href = "/payment-required";
  return true;
}