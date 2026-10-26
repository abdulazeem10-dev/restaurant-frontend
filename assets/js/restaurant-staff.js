const message = document.querySelector("#message");
if (!getToken()) location.href = "../customer/login.html";
document.querySelector("#logout").addEventListener("click", () => { sessionStorage.removeItem(TOKEN_KEY); location.href = "../customer/login.html"; });

async function staffApi(path, options = {}) {
  const response = await apiFetch(path, options);
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const roleNames = { secondary_admin: "Secondary admin", biller_modifier: "Biller / modifier", viewer: "Viewer" };
let menuFormInitialized = false;
async function load() {
  try {
    const { user } = await staffApi("/auth/me");
    if (user.role !== "restaurant_staff" || !roleNames[user.staffRole]) throw new Error("This page is for restaurant staff accounts.");
    const canEditMenu = ["secondary_admin", "biller_modifier"].includes(user.staffRole);
    document.querySelector("#staff-title").textContent = `${roleNames[user.staffRole]} workspace`;
    document.querySelector("#staff-summary").textContent = `Signed in as ${user.name}. Your access is limited to your ${roleNames[user.staffRole].toLowerCase()} role.`;
    document.querySelector("#menu-section").hidden = !canEditMenu;
    document.querySelector("#orders-help").textContent = user.staffRole === "viewer" ? "Read-only order overview." : "Update incoming orders and follow their progress.";
    if (canEditMenu) {
      if (!menuFormInitialized) document.querySelector("#menu-form").addEventListener("submit", async event => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        try {
          await staffApi("/restaurants/owner/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), category: form.get("category"), description: form.get("description"), pricePaise: Math.round(Number(form.get("price")) * 100), available: true }) });
          event.currentTarget.reset(); await loadMenu();
        } catch (error) { message.textContent = error.message; }
      });
      menuFormInitialized = true;
      await loadMenu();
    }
    await loadOrders(user.staffRole !== "viewer");
  } catch (error) { message.textContent = `${error.message} Please sign in with your staff account.`; }
}

async function loadMenu() {
  const { items } = await staffApi("/restaurants/owner/menu"); const root = document.querySelector("#menu-items"); root.replaceChildren();
  for (const item of items) {
    const card = document.createElement("article");
    card.innerHTML = `<h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.category)} · ${formatRupees(item.pricePaise)}</p><label><input type="checkbox" ${item.available ? "checked" : ""}> Available</label> <button class="secondary" type="button">Delete</button>`;
    card.querySelector("input").addEventListener("change", async event => { try { await staffApi(`/restaurants/owner/menu/${item._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: event.target.checked }) }); } catch (error) { message.textContent = error.message; } });
    card.querySelector("button").addEventListener("click", async () => { try { await staffApi(`/restaurants/owner/menu/${item._id}`, { method: "DELETE" }); await loadMenu(); } catch (error) { message.textContent = error.message; } });
    root.append(card);
  }
  if (!items.length) root.textContent = "No menu items yet.";
}

async function loadOrders(canUpdate) { await window.loadRestaurantOrderDesk(staffApi, canUpdate); }
load();
setInterval(() => { if (getToken()) load().catch(error => { message.textContent = error.message; }); }, 20000);

