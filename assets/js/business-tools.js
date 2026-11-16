const businessMessage = document.querySelector("#business-message");
if (!getToken()) location.replace("../customer/login.html");
document.querySelector("#logout").addEventListener("click", () => logoutSession().finally(() => location.replace("../customer/login.html")));

async function businessApi(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: authHeaders(options.headers || {}) });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (response.status === 401) { clearLocalSession(); location.replace("../customer/login.html"); throw new Error("Please sign in again."); }
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function safeText(tag, value, className = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value == null ? "" : String(value);
  return element;
}

function dateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatBusinessMoney(paise) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((Number(paise) || 0) / 100);
}

let recipeMenuItems = [];
let recipeDraft = [];
async function loadRecipeMenu() {
  const { items = [] } = await businessApi("/restaurants/owner/menu");
  recipeMenuItems = items;
  const select = document.querySelector("#recipe-menu-item");
  select.replaceChildren(new Option("Choose a dish", ""));
  for (const item of items) select.add(new Option(`${item.name} · ${item.category}`, item._id));
  select.disabled = !items.length;
  document.querySelector("#add-recipe-ingredient").disabled = !items.length;
  if (items.length) { select.value = items[0]._id; loadRecipeDraft(); }
  else document.querySelector("#recipe-status").textContent = "Add a dish to the menu before entering its ingredient cost.";
}

function renderRecipeDraft() {
  const root = document.querySelector("#recipe-ingredients");
  root.replaceChildren();
  recipeDraft.forEach((ingredient, index) => {
    const row = document.createElement("article"); row.className = "business-record-row recipe-ingredient-row";
    const makeInput = (labelText, field, type = "text", options = {}) => {
      const label = document.createElement("label"); label.textContent = labelText;
      const input = document.createElement("input"); input.type = type; input.dataset.field = field; input.dataset.index = index;
      if (options.min) input.min = options.min;
      if (options.step) input.step = options.step;
      if (options.maxLength) input.maxLength = options.maxLength;
      if (options.required) input.required = true;
      if (options.placeholder) input.placeholder = options.placeholder;
      input.value = field === "costRupees" ? ((Number(ingredient.costPaise) || 0) / 100).toFixed(2) : ingredient[field] ?? "";
      label.append(input); return label;
    };
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "secondary"; remove.textContent = "Remove";
    remove.addEventListener("click", () => { syncRecipeDraft(); recipeDraft.splice(index, 1); renderRecipeDraft(); });
    row.append(makeInput("Ingredient", "ingredientName", "text", { maxLength: 120, required: true }), makeInput("Quantity per portion", "quantity", "number", { min: "0.001", step: "any", required: true }), makeInput("Unit", "unit", "text", { maxLength: 24, placeholder: "g, ml, piece", required: true }), makeInput("Cost per portion (₹)", "costRupees", "number", { min: "0", step: "0.01", required: true }), remove);
    root.append(row);
  });
  if (!recipeDraft.length) root.append(safeText("p", "No ingredients yet. Add an ingredient or save an empty list to clear the recipe.", "muted"));
  updateRecipeCostTotal();
  document.querySelector("#save-recipe").disabled = !document.querySelector("#recipe-menu-item").value;
}

function syncRecipeDraft() {
  for (const input of document.querySelectorAll("#recipe-ingredients [data-field]")) {
    const row = recipeDraft[Number(input.dataset.index)];
    if (!row) continue;
    if (input.dataset.field === "costRupees") row.costPaise = Math.round((Number(input.value) || 0) * 100);
    else if (input.dataset.field === "quantity") row.quantity = Number(input.value) || 0;
    else row[input.dataset.field] = input.value;
  }
}

function updateRecipeCostTotal() {
  const totalPaise = recipeDraft.reduce((sum, ingredient) => sum + (Number(ingredient.costPaise) || 0), 0);
  document.querySelector("#recipe-cost-total").textContent = `Cost per portion: ${formatBusinessMoney(totalPaise)}`;
}

function loadRecipeDraft() {
  const item = recipeMenuItems.find(entry => String(entry._id) === document.querySelector("#recipe-menu-item").value);
  recipeDraft = (item?.recipe || []).map(ingredient => ({ ingredientName: ingredient.ingredientName, quantity: ingredient.quantity, unit: ingredient.unit, costPaise: ingredient.costPaise }));
  document.querySelector("#recipe-status").textContent = item?.recipe?.length ? `Loaded recipe for ${item.name}. Past orders retain their saved cost.` : "No ingredient costs saved for this dish yet.";
  renderRecipeDraft();
}

document.querySelector("#recipe-menu-item").addEventListener("change", loadRecipeDraft);
document.querySelector("#add-recipe-ingredient").addEventListener("click", () => { syncRecipeDraft(); recipeDraft.push({ ingredientName: "", quantity: 1, unit: "g", costPaise: 0 }); renderRecipeDraft(); });
document.querySelector("#recipe-ingredients").addEventListener("input", event => { if (!event.target.matches("[data-field]")) return; syncRecipeDraft(); updateRecipeCostTotal(); });
document.querySelector("#save-recipe").addEventListener("click", async event => {
  const button = event.currentTarget; const status = document.querySelector("#recipe-status");
  syncRecipeDraft(); button.disabled = true; status.textContent = "Saving ingredient costs…";
  try {
    const recipe = recipeDraft.map(row => ({ ingredientName: String(row.ingredientName || "").trim(), quantity: Number(row.quantity), unit: String(row.unit || "").trim(), costPaise: Number(row.costPaise) }));
    if (recipe.some(row => !row.ingredientName || !Number.isFinite(row.quantity) || row.quantity <= 0 || !row.unit || !Number.isSafeInteger(row.costPaise) || row.costPaise < 0)) throw new Error("Fill in each ingredient, amount, unit, and non-negative cost.");
    if (recipe.length > 40) throw new Error("A dish can have up to 40 ingredients.");
    const id = document.querySelector("#recipe-menu-item").value;
    const result = await businessApi(`/restaurants/owner/menu/${encodeURIComponent(id)}/recipe`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipe }) });
    const menuItem = recipeMenuItems.find(item => String(item._id) === id); if (menuItem) menuItem.recipe = result.item.recipe;
    status.textContent = `Saved. Ingredient cost per portion: ${formatBusinessMoney(result.item.ingredientCostPaise)}. New orders will capture this cost.`;
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});

async function loadBusinessSettings() {
  const form = document.querySelector("#business-settings-form");
  const data = await businessApi("/restaurants/owner/business-settings");
  const settings = data.settings || {};
  form.elements.taxEnabled.checked = Boolean(settings.taxEnabled);
  form.elements.taxRatePercent.value = (Number(settings.taxRateBasisPoints) || 0) / 100;
  form.elements.taxInclusive.value = String(settings.taxInclusive !== false);
  form.elements.gstin.value = settings.gstin || "";
  form.elements.taxLabel.value = settings.taxLabel || "GST";
  form.elements.branchName.value = settings.branchName || "";
  form.elements.branchGroup.value = settings.branchGroup || "";
}

document.querySelector("#business-settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  const values = new FormData(form);
  const ratePercent = Number(values.get("taxRatePercent"));
  try {
    if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 28) throw new Error("Enter a tax rate from 0 to 28 percent.");
    const result = await businessApi("/restaurants/owner/business-settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxEnabled: form.elements.taxEnabled.checked,
        taxRateBasisPoints: Math.round(ratePercent * 100),
        taxInclusive: values.get("taxInclusive") === "true",
        gstin: values.get("gstin"), taxLabel: values.get("taxLabel"),
        branchName: values.get("branchName"), branchGroup: values.get("branchGroup")
      })
    });
    form.elements.taxRatePercent.value = (result.settings.taxRateBasisPoints || 0) / 100;
    document.querySelector("#business-settings-status").textContent = "Business settings saved. New orders will use this tax setup; existing orders keep their saved totals.";
  } catch (error) { document.querySelector("#business-settings-status").textContent = error.message; }
  finally { button.disabled = false; }
});

let supplierCache = [];
async function loadSuppliers() {
  const { items = [] } = await businessApi("/restaurants/owner/suppliers");
  supplierCache = items;
  const list = document.querySelector("#supplier-list");
  const select = document.querySelector("#expense-form [name='supplierId']");
  list.replaceChildren();
  select.replaceChildren(new Option("No supplier", ""));
  for (const item of items) {
    if (item.active) select.add(new Option(item.name, item._id));
    const row = document.createElement("article"); row.className = "business-record-row";
    const info = document.createElement("div");
    info.append(safeText("strong", item.name), safeText("p", [item.phone, item.email, item.gstin].filter(Boolean).join(" · ") || "No contact details"), safeText("small", item.active ? "Active" : "Archived"));
    row.append(info);
    if (item.active) {
      const archive = document.createElement("button"); archive.type = "button"; archive.className = "secondary"; archive.textContent = "Archive";
      archive.addEventListener("click", async () => { archive.disabled = true; try { await businessApi(`/restaurants/owner/suppliers/${encodeURIComponent(item._id)}`, { method: "DELETE" }); await loadSuppliers(); } catch (error) { businessMessage.textContent = error.message; archive.disabled = false; } });
      row.append(archive);
    }
    list.append(row);
  }
  if (!items.length) list.append(safeText("p", "No suppliers recorded yet.", "muted"));
}

document.querySelector("#supplier-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type='submit']"); button.disabled = true;
  const values = Object.fromEntries(new FormData(form));
  try { await businessApi("/restaurants/owner/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); form.reset(); await loadSuppliers(); }
  catch (error) { businessMessage.textContent = error.message; }
  finally { button.disabled = false; }
});

async function loadExpenses() {
  const { items = [], summary = {} } = await businessApi("/restaurants/owner/expenses");
  const root = document.querySelector("#expense-list"); root.replaceChildren();
  document.querySelector("#expense-summary").textContent = `${summary.count || 0} recorded expenses · ${formatBusinessMoney(summary.totalPaise || 0)} total`;
  for (const item of items) {
    const row = document.createElement("article"); row.className = "business-record-row";
    const info = document.createElement("div");
    info.append(safeText("strong", item.description), safeText("p", `${item.category} · ${new Date(item.spentAt).toLocaleDateString("en-IN")}${item.supplierId?.name ? ` · ${item.supplierId.name}` : ""}`), safeText("small", [item.reference, item.notes].filter(Boolean).join(" · ")));
    row.append(info, safeText("strong", formatBusinessMoney(item.amountPaise)));
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "secondary"; remove.textContent = "Delete";
    remove.addEventListener("click", async () => { if (!confirm("Delete this expense record?")) return; remove.disabled = true; try { await businessApi(`/restaurants/owner/expenses/${encodeURIComponent(item._id)}`, { method: "DELETE" }); await loadExpenses(); } catch (error) { businessMessage.textContent = error.message; remove.disabled = false; } });
    row.append(remove); root.append(row);
  }
  if (!items.length) root.append(safeText("p", "No expenses recorded yet.", "muted"));
}

async function loadCoupons() {
  const { items = [] } = await businessApi("/restaurants/owner/coupons");
  const root = document.querySelector("#coupon-list"); root.replaceChildren();
  for (const coupon of items) {
    const row = document.createElement("article"); row.className = "business-record-row";
    const discount = coupon.discountType === "percent" ? `${(coupon.discountValue / 100).toFixed(2).replace(/\.00$/, "")}% off` : `${formatBusinessMoney(coupon.discountValue)} off`;
    const dates = [coupon.startsAt ? `Starts ${new Date(coupon.startsAt).toLocaleDateString("en-IN")}` : "Starts now", coupon.endsAt ? `Ends ${new Date(coupon.endsAt).toLocaleDateString("en-IN")}` : "No end date"].join(" · ");
    const info = document.createElement("div");
    info.append(safeText("strong", `${coupon.code} · ${discount}`), safeText("p", `Used ${coupon.usedCount || 0}${coupon.maxUses ? ` of ${coupon.maxUses}` : " · unlimited uses"} · minimum ${formatBusinessMoney(coupon.minSubtotalPaise || 0)}`), safeText("small", `${coupon.active ? "Active" : "Paused"} · ${dates}`));
    row.append(info);
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "secondary"; toggle.textContent = coupon.active ? "Pause" : "Activate";
    toggle.addEventListener("click", async () => { toggle.disabled = true; try { await businessApi(`/restaurants/owner/coupons/${encodeURIComponent(coupon._id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !coupon.active }) }); await loadCoupons(); } catch (error) { businessMessage.textContent = error.message; toggle.disabled = false; } });
    row.append(toggle); root.append(row);
  }
  if (!items.length) root.append(safeText("p", "No coupons created yet.", "muted"));
}

let optedInCustomers = [];
function renderOptedInCustomers() {
  const root = document.querySelector("#marketing-customer-list");
  const message = document.querySelector("#whatsapp-campaign-message")?.value.trim() || "Hello from Al-Madina!";
  root.replaceChildren();
  if (!optedInCustomers.length) { root.append(safeText("p", "No opted-in customers with an account phone number yet.", "muted")); return; }
  for (const customer of optedInCustomers) {
    const row = document.createElement("article"); row.className = "business-record-row";
    const info = document.createElement("div");
    info.append(safeText("strong", customer.name), safeText("p", `${customer.orderCount} orders · ${formatBusinessMoney(customer.paidSalesPaise)} paid sales`), safeText("small", customer.lastOrderAt ? `Last order ${new Date(customer.lastOrderAt).toLocaleDateString("en-IN")}` : "No orders yet"));
    row.append(info);
    const digits = String(customer.phone || "").replace(/\D/g, "").slice(-10);
    if (/^\d{10}$/.test(digits)) {
      const link = document.createElement("a"); link.className = "secondary"; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.href = `https://wa.me/91${digits}?text=${encodeURIComponent(message.replaceAll("{name}", customer.name || "there"))}`;
      link.textContent = "Open WhatsApp"; row.append(link);
    }
    root.append(row);
  }
}

async function loadOptedInCustomers() {
  const data = await businessApi("/restaurants/owner/marketing/customers");
  optedInCustomers = data.customers || [];
  renderOptedInCustomers();
}
document.querySelector("#whatsapp-campaign-message")?.addEventListener("input", renderOptedInCustomers);

document.querySelector("#coupon-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type='submit']"); button.disabled = true;
  const values = new FormData(form); const discountType = values.get("discountType");
  const displayValue = Number(values.get("discountDisplay"));
  const maxDiscount = Number(values.get("maxDiscountRupees")) || 0;
  const minimum = Number(values.get("minSubtotalRupees")) || 0;
  try {
    if (!Number.isFinite(displayValue) || displayValue <= 0) throw new Error("Enter a valid coupon discount.");
    const discountValue = discountType === "percent" ? Math.round(displayValue * 100) : Math.round(displayValue * 100);
    if (discountType === "percent" && displayValue > 100) throw new Error("Percentage discount cannot exceed 100%.");
    const startsLocal = values.get("startsAt"); const endsLocal = values.get("endsAt");
    const payload = {
      code: values.get("code"), discountType, discountValue,
      maxDiscountPaise: Math.round(maxDiscount * 100), minSubtotalPaise: Math.round(minimum * 100),
      maxUses: Number(values.get("maxUses")) || 0,
      startsAt: startsLocal ? new Date(startsLocal).toISOString() : null,
      endsAt: endsLocal ? new Date(endsLocal).toISOString() : null,
      active: true
    };
    await businessApi("/restaurants/owner/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    form.reset(); form.elements.maxDiscountRupees.value = "0"; form.elements.minSubtotalRupees.value = "0"; form.elements.maxUses.value = "0";
    await loadCoupons();
  } catch (error) { businessMessage.textContent = error.message; }
  finally { button.disabled = false; }
});

document.querySelector("#expense-form").elements.spentAt.value = dateValue();
document.querySelector("#expense-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type='submit']"); button.disabled = true;
  const values = Object.fromEntries(new FormData(form));
  const amount = Number(values.amountRupees);
  try {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) throw new Error("Enter a valid expense amount.");
    const payload = { ...values, amountPaise: Math.round(amount * 100), supplierId: values.supplierId || null };
    delete payload.amountRupees;
    await businessApi("/restaurants/owner/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    form.reset(); form.elements.spentAt.value = dateValue(); await loadExpenses();
  } catch (error) { businessMessage.textContent = error.message; }
  finally { button.disabled = false; }
});

function setBranchDates() {
  const form = document.querySelector("#branch-report-form");
  const today = dateValue(); const week = dateValue(new Date(Date.now() - 6 * 86_400_000));
  if (!form.elements.from.value) form.elements.from.value = week;
  if (!form.elements.to.value) form.elements.to.value = today;
}

document.querySelector("#branch-report-form").addEventListener("submit", async event => {
  event.preventDefault(); setBranchDates();
  const form = event.currentTarget; const status = document.querySelector("#branch-report-status"); const root = document.querySelector("#branch-report-results");
  status.textContent = "Loading branch report…"; root.replaceChildren();
  try {
    const group = document.querySelector("#business-settings-form").elements.branchGroup.value.trim();
    if (!group) throw new Error("Save a branch group name in Business settings first.");
    const params = new URLSearchParams({ from: form.elements.from.value, to: form.elements.to.value, group });
    const data = await businessApi(`/restaurants/owner/branch-report?${params}`);
    const table = document.createElement("table"); table.className = "report-table";
    table.innerHTML = "<thead><tr><th>Branch</th><th>Orders</th><th>Paid sales</th><th>Recorded expenses</th></tr></thead>";
    const tbody = document.createElement("tbody");
    for (const branch of data.branches) {
      const row = document.createElement("tr");
      for (const value of [branch.name, branch.orders, formatBusinessMoney(branch.paidSalesPaise), formatBusinessMoney(branch.recordedExpensesPaise)]) row.append(safeText("td", value));
      tbody.append(row);
    }
    table.append(tbody); root.append(table);
    status.textContent = `${data.branches.length} branch record(s) · paid sales ${formatBusinessMoney(data.summary.paidSalesPaise)}. This is not a profit report.`;
  } catch (error) { status.textContent = error.message; }
});

Promise.all([loadBusinessSettings(), loadRecipeMenu(), loadSuppliers(), loadExpenses(), loadCoupons(), loadOptedInCustomers()]).catch(error => { businessMessage.textContent = error.message; });
setBranchDates();
