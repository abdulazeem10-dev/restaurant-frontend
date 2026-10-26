const API_BASE =
  window.FOODWAY_API_BASE ||
  (
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:5100/api"
      : "https://restaurant-backend-gray.vercel.app/api"
  );

const TOKEN_KEY = "food-platform-token";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    ...(getToken()
      ? { Authorization: `Bearer ${getToken()}` }
      : {}),
  };
}

async function apiFetch(path, options = {}) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const method = (options.method || "GET").toUpperCase();

  try {
    const response = await fetch(url, {
      ...options,
      headers: authHeaders(options.headers || {}),
    });

    console.info(`[API] ${method} ${url} → ${response.status}`);
    return response;
  } catch (error) {
    console.error(`[API] ${method} ${url} → network error`, error);
    throw error;
  }
}

function formatRupees(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}

function readCart() {
  try {
    return JSON.parse(localStorage.getItem("food-platform-cart") || "null");
  } catch {
    return null;
  }
}

function writeCart(cart) {
  localStorage.setItem("food-platform-cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const el = document.querySelector("[data-cart-count]");
  if (el) {
    el.textContent = (readCart()?.items || []).reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }
}

function escapeHtml(value) {
  const el = document.createElement("span");
  el.textContent = value ?? "";
  return el.innerHTML;
}

updateCartCount();