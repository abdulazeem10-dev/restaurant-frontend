// const API_BASE = "http://localhost:5000/api";
const API_BASE = "https://restaurant-backend-gray.vercel.app/api";
const RAW_FETCH = window.fetch.bind(window);
window.fetch = async function(input, init = {}) {
  const requestUrl = input instanceof Request ? input.url : String(input);
  const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  let apiRequest = false;
  let safePath = requestUrl;
  try {
    const parsed = new URL(requestUrl, location.href);
    const apiRoot = new URL(API_BASE, location.href);
    apiRequest = parsed.origin === apiRoot.origin && (parsed.pathname === apiRoot.pathname || parsed.pathname.startsWith(`${apiRoot.pathname}/`));
    safePath = parsed.pathname;
  } catch {}
  try {
    const response = await RAW_FETCH(input, init);
    if (apiRequest) console.info(`[API] ${method} ${safePath} → ${response.status}`);
    return response;
  } catch (error) {
    if (apiRequest) console.error(`[API] ${method} ${safePath} → network error`, error);
    throw error;
  }
};
async function apiFetch(path, options = {}) {
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return window.fetch(url, options);
}
const TOKEN_KEY = "food-platform-token";
function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
function authHeaders(extra = {}) { return { ...extra, ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }; }
function setStatusMessage(element, message, state = "info") {
  if (!element) return;
  element.dataset.state = state;
  element.setAttribute("role", state === "error" ? "alert" : "status");
  element.textContent = message;
}
function formatRupees(paise) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100); }
function readCart() { try { return JSON.parse(localStorage.getItem("food-platform-cart") || "null"); } catch { return null; } }
function writeCart(cart) { localStorage.setItem("food-platform-cart", JSON.stringify(cart)); updateCartCount(); }
function updateCartCount() { const count = (readCart()?.items || []).reduce((sum, item) => sum + item.quantity, 0); document.querySelectorAll("[data-cart-count]").forEach(el => { el.textContent = count; }); }
function escapeHtml(value) {
  const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, character => replacements[character]);
}
function createLiveTrackingMap(element, deliveryLocation, customerLocation) {
  if (!window.L) {
    element.textContent = "Map library could not load. Use the location links below instead.";
    return null;
  }
  const points = [];
  const map = L.map(element, { scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
  }).addTo(map);
  const markers = [];
  const addPoint = (location, label, iconClass) => {
    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;
    const point = [location.latitude, location.longitude];
    points.push(point);
    const icon = L.divIcon({ className: "live-map-marker-wrap", html: `<span class="live-map-marker ${iconClass}" aria-label="${label}"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
    markers.push(L.marker(point, { icon, title: label }).addTo(map).bindTooltip(label));
  };
  addPoint(deliveryLocation, "Delivery person", "is-rider");
  addPoint(customerLocation, "Customer", "is-customer");
  if (points.length === 2) {
    L.polyline(points, { color: "#e94b61", weight: 4, opacity: 0.8, dashArray: "8 8" }).addTo(map);
    map.fitBounds(points, { padding: [28, 28], maxZoom: 15 });
  } else if (points.length === 1) map.setView(points[0], 15);
  else map.setView([19.076, 72.8777], 11);
  // Order cards are assembled off-DOM before being appended. Re-measure after
  // the browser lays out the card so Leaflet requests tiles for the full map.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!element.isConnected) return;
    map.invalidateSize({ pan: false });
    if (points.length === 2) map.fitBounds(points, { padding: [28, 28], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 15);
  }));
  return map;
}
updateCartCount();
