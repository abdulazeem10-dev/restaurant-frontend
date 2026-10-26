const message = document.querySelector("#message");
if (!getToken()) location.href = "../customer/login.html";
document.querySelector("#logout").addEventListener("click", () => { sessionStorage.removeItem(TOKEN_KEY); location.href = "../customer/login.html"; });

async function deliveryApi(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: authHeaders(options.headers || {}) });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function loadDeliveries() {
  const { user } = await deliveryApi("/auth/me");
  if (user.role !== "delivery") throw new Error("This page is for delivery partner accounts.");
  document.querySelector("#welcome").textContent = `Welcome, ${user.name}`;
  const { orders } = await deliveryApi("/orders/delivery/mine"); const root = document.querySelector("#deliveries"); root.replaceChildren();
  for (const order of orders) {
    const card = document.createElement("article");
    const items = order.items.map(item => `${item.quantity} × ${item.name}`).join(", ");
    card.innerHTML = `<p class="eyebrow">ORDER ${escapeHtml(order._id.slice(-6))}</p><h3>${escapeHtml(order.restaurantId?.name || "Restaurant")}</h3><p><strong>Pickup address</strong><br>${escapeHtml(order.restaurantId?.address || "Not provided")}</p><p><strong>Customer</strong><br>${escapeHtml(order.customerId?.name || "Customer")} · ${escapeHtml(order.customerId?.email || "")}</p><p><strong>Deliver to</strong><br>${escapeHtml(order.deliveryAddress)}</p><p><strong>Order items</strong><br>${escapeHtml(items)}</p><p><strong>Payment</strong><br>${escapeHtml(order.paymentMode || "Cash on delivery")} · ${formatRupees(order.totalPaise)}</p><p><strong>Status:</strong> ${escapeHtml(order.status.replaceAll("_", " "))}</p>`;
    const next = { ready: ["picked_up", "Picked up from restaurant"], picked_up: ["out_for_delivery", "Start delivery"], out_for_delivery: ["delivered", "Mark delivery done"] }[order.status];
    if (next) {
      const button = document.createElement("button"); button.textContent = next[1];
      button.addEventListener("click", async () => { button.disabled = true; try { await deliveryApi(`/orders/delivery/${order._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next[0] }) }); await loadDeliveries(); } catch (error) { message.textContent = error.message; button.disabled = false; } });
      card.append(button);
    }
    root.append(card);
  }
  if (!orders.length) root.innerHTML = '<article class="empty-state"><span class="empty-icon">🛵</span><h3>No active deliveries</h3><p>New assigned orders will appear here.</p></article>';
}
loadDeliveries().catch(error => { message.textContent = `${error.message} Sign in with a delivery account.`; });
setInterval(() => { if (getToken()) loadDeliveries().catch(error => { message.textContent = error.message; }); }, 20000);
