const msg = document.querySelector("#message");
if (!getToken()) location.href = "../customer/login.html";
document.querySelector("#logout").addEventListener("click", () => { sessionStorage.removeItem(TOKEN_KEY); location.href = "../customer/login.html"; });
async function api(path, options = {}) {
  const response = await apiFetch(path, options);
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed"); return data;
}
async function loadMenu() {
  const { restaurant, items } = await api("/restaurants/owner/menu"); const root = document.querySelector("#menu-items"); root.replaceChildren();
  document.querySelector("#restaurant-title").textContent = restaurant.name;
  document.querySelector("#restaurant-state").textContent = `Status: ${restaurant.status} · ${restaurant.isOpen ? "Open for orders" : "Closed"}`;
  const toggle = document.querySelector("#open-toggle");
  if (restaurant.status === "approved") { toggle.hidden = false; toggle.textContent = restaurant.isOpen ? "Close restaurant" : "Open for orders"; toggle.onclick = async () => { try { await api("/restaurants/owner/open", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isOpen: !restaurant.isOpen }) }); await loadMenu(); } catch (error) { msg.textContent = error.message; } }; }
  else { toggle.hidden = true; }
  for (const item of items) {
    const card = document.createElement("article");
    card.innerHTML = `<h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.category)} · ${formatRupees(item.pricePaise)}</p><label><input type="checkbox" ${item.available ? "checked" : ""}> Available</label> <button type="button" class="secondary">Delete</button>`;
    card.querySelector("input").addEventListener("change", event => api(`/restaurants/owner/menu/${item._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: event.target.checked }) }).catch(error => { msg.textContent = error.message; }));
    card.querySelector("button").addEventListener("click", async () => { if (!confirm(`Delete ${item.name}?`)) return; try { await api(`/restaurants/owner/menu/${item._id}`, { method: "DELETE" }); await loadMenu(); } catch (error) { msg.textContent = error.message; } });
    root.append(card);
  }
  if (!items.length) root.textContent = "Add your first menu item above.";
}
async function loadStaff() {
  const root = document.querySelector("#staff-list");
  if (!root) return;
  try {
    const { staff, limit } = await api("/restaurants/owner/staff"); root.replaceChildren();
    for (const account of staff) {
      const card = document.createElement("article");
      card.innerHTML = `<h3>${escapeHtml(account.name)}</h3><p>${escapeHtml(account.email)}</p><p>${escapeHtml(({ secondary_admin: "Secondary admin", biller_modifier: "Biller / modifier", viewer: "Viewer" })[account.staffRole] || account.staffRole)}</p><button type="button" class="secondary">Remove access</button>`;
      card.querySelector("button").addEventListener("click", async () => { if (!confirm(`Remove ${account.name}'s staff access?`)) return; try { await api(`/restaurants/owner/staff/${account._id}`, { method: "DELETE" }); await loadStaff(); } catch (error) { msg.textContent = error.message; } });
      root.append(card);
    }
    if (!staff.length) root.textContent = `No staff accounts yet. You can create up to ${limit}.`;
    document.querySelector('#staff-form button[type="submit"]').disabled = staff.length >= limit;
  } catch (error) { msg.textContent = error.message; }
}
async function loadOrders() { await window.loadRestaurantOrderDesk(api, true); }
document.querySelector("#menu-form").addEventListener("submit", async event => {
  event.preventDefault(); msg.textContent = ""; const form = new FormData(event.currentTarget);
  try { await api("/restaurants/owner/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), category: form.get("category"), description: form.get("description"), pricePaise: Math.round(Number(form.get("price")) * 100), available: true }) }); event.currentTarget.reset(); await loadMenu(); }
  catch (error) { msg.textContent = error.message; }
});
document.querySelector("#staff-form")?.addEventListener("submit", async event => {
  event.preventDefault(); msg.textContent = ""; const form = new FormData(event.currentTarget);
  try {
    await api("/restaurants/owner/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password"), staffRole: form.get("staffRole") }) });
    event.currentTarget.reset(); msg.textContent = "Staff account created. Share its login details securely."; await loadStaff();
  } catch (error) { msg.textContent = error.message; }
});
async function verifyOwner() {
  const { user } = await api("/auth/me");
  if (user.role !== "restaurant") { location.href = user.role === "restaurant_staff" ? "staff-dashboard.html" : "../customer/login.html"; return; }
  await Promise.all([loadMenu(), loadOrders(), loadStaff()]);
}
verifyOwner().catch(error => { msg.textContent = `${error.message}. Sign in with an approved restaurant owner account.`; });
setInterval(() => { if (getToken()) loadOrders().catch(error => { msg.textContent = error.message; }); }, 20000);

