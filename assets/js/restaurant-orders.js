(() => {
  let apiCall, canManage = false, menuItems = [], basket = new Map(), ordersCache = [];
  const money = value => formatRupees(value);
  const esc = value => escapeHtml(value ?? "");
  const form = () => document.querySelector("#dine-in-form");
  const drawBasket = () => {
    const root = document.querySelector("#ticket-basket"); if (!root) return;
    const lines = [...basket.values()];
    root.innerHTML = lines.length ? `<strong>Ticket items</strong><ul>${lines.map(line => `<li>${line.quantity} × ${esc(line.name)} · ${money(line.unitPricePaise * line.quantity)}</li>`).join("")}</ul><strong>Subtotal ${money(lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0))}</strong>` : "Choose an item to start the ticket.";
  };
  const refreshMenu = async () => {
    const data = await apiCall("/restaurants/owner/menu");
    menuItems = data.items.filter(item => item.available);
    const select = document.querySelector("#ticket-menu-item"); if (!select) return;
    select.replaceChildren(...menuItems.map(item => { const option = document.createElement("option"); option.value = item._id; option.textContent = `${item.name} · ${money(item.pricePaise)}`; return option; }));
    if (!menuItems.length) { const option = document.createElement("option"); option.textContent = "Add available menu items first"; option.value = ""; select.append(option); }
  };
  const printBill = order => {
    const items = order.items.map(item => `<tr><td>${esc(item.name)} × ${item.quantity}</td><td>${money(item.unitPricePaise * item.quantity)}</td></tr>`).join("");
    const title = order.orderType === "dine_in" ? `Table ${esc(order.tableNumber)}` : `Delivery order ${esc(order._id.slice(-6))}`;
    const win = window.open("", "_blank", "width=440,height=650"); if (!win) { document.querySelector("#message").textContent = "Allow pop-ups to print the bill."; return; }
    win.document.write(`<!doctype html><html><head><title>Bill · ${title}</title><style>body{font:15px system-ui;padding:28px;color:#25231f}h1{font-size:22px;margin:0 0 5px}p{color:#685c52}table{width:100%;border-collapse:collapse;margin:22px 0}td{padding:9px 0;border-bottom:1px solid #eee}td:last-child{text-align:right}.total{display:flex;justify-content:space-between;border-top:2px solid #25231f;padding-top:12px;font-size:19px;font-weight:700}.muted{color:#746b64;font-size:13px}</style></head><body><h1>${esc(document.querySelector("#restaurant-title")?.textContent || "Restaurant")}</h1><p>${title}${order.customerName ? ` · ${esc(order.customerName)}` : ""}<br>${new Date(order.createdAt).toLocaleString()}</p><table>${items}</table><div class="total"><span>Total</span><span>${money(order.totalPaise)}</span></div><p class="muted">Payment: ${esc(order.paymentStatus)}${order.paymentMethod ? ` · ${esc(order.paymentMethod.toUpperCase())}` : ""}</p><script>window.onload=()=>window.print()<\/script></body></html>`); win.document.close();
  };
  const drawOrders = () => {
    const root = document.querySelector("#orders"); if (!root) return;
    const filter = document.querySelector("#order-filter")?.value || "all";
    const orders = ordersCache.filter(order => filter === "all" || order.orderType === filter); root.replaceChildren();
    const activeCount = ordersCache.filter(order => !["delivered", "cancelled", "ready"].includes(order.status)).length;
    const summary = document.querySelector("#order-summary"); if (summary) summary.textContent = `${activeCount} active · ${ordersCache.filter(order => order.paymentStatus === "pending").length} awaiting payment`;
    for (const order of orders) {
      const dineIn = order.orderType === "dine_in";
      const card = document.createElement("article"); card.className = "order-card";
      const heading = dineIn ? `Table ${esc(order.tableNumber)}` : `Delivery · ${esc(order._id.slice(-6))}`;
      const lines = order.items.map(item => `<li><span>${item.quantity} × ${esc(item.name)}</span><strong>${money(item.unitPricePaise * item.quantity)}</strong></li>`).join("");
      const status = esc(order.status.replaceAll("_", " "));
      card.innerHTML = `<div class="order-card-top"><div><span class="order-type-pill ${dineIn ? "table-pill" : "delivery-pill"}">${dineIn ? "DINE-IN" : "APP / WEBSITE"}</span><h3>${heading}</h3><p class="muted">${esc(dineIn ? (order.customerName || "Walk-in guest") : (order.customerId?.name || order.customerName || "Customer"))} · ${new Date(order.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p></div><span class="order-status">${status}</span></div><ul class="order-lines">${lines}</ul>${!dineIn && order.deliveryAddress ? `<p class="delivery-address">⌖ ${esc(order.deliveryAddress)}</p>` : ""}<div class="order-total"><span>Total</span><strong>${money(order.totalPaise)}</strong></div><div class="payment-row"><span class="payment-badge ${order.paymentStatus === "paid" ? "paid" : "unpaid"}">${order.paymentStatus === "paid" ? `Paid · ${(order.paymentMethod || "").toUpperCase()}` : "Payment due"}</span><button class="secondary print-bill" type="button">Print bill</button></div><div class="order-actions"></div>`;
      const actions = card.querySelector(".order-actions");
      if (canManage && dineIn && order.paymentStatus !== "paid" && !["cancelled", "ready"].includes(order.status)) {
        const addRow = document.createElement("div"); addRow.className = "add-order-item";
        const select = document.createElement("select"); select.setAttribute("aria-label", "Add another menu item");
        for (const item of menuItems) { const option = document.createElement("option"); option.value = item._id; option.textContent = `${item.name} · ${money(item.pricePaise)}`; select.append(option); }
        const add = document.createElement("button"); add.type = "button"; add.className = "secondary"; add.textContent = "+ Add item"; add.disabled = !menuItems.length;
        add.onclick = async () => { try { await apiCall(`/orders/restaurant/${order._id}/items`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({menuItemId:select.value,quantity:1})}); await load(); } catch(error) { document.querySelector("#message").textContent = error.message; } };
        addRow.append(select, add); actions.append(addRow);
      }
      if (canManage && order.paymentStatus !== "paid") {
        const payRow = document.createElement("div"); payRow.className = "add-order-item payment-actions";
        const method = document.createElement("select"); method.setAttribute("aria-label", "Payment method");
        for (const value of ["cash", "upi", "card"]) { const option = document.createElement("option"); option.value = value; option.textContent = value.toUpperCase(); method.append(option); }
        const paid = document.createElement("button"); paid.type = "button"; paid.textContent = "Mark paid";
        paid.onclick = async () => { try { await apiCall(`/orders/restaurant/${order._id}/payment`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paymentStatus:"paid",paymentMethod:method.value})}); await load(); } catch(error) { document.querySelector("#message").textContent = error.message; } };
        payRow.append(method, paid); actions.append(payRow);
      }
      const next = { placed: ["confirmed", "cancelled"], confirmed: ["preparing", "cancelled"], preparing: ["ready"] }[order.status] || [];
      if (canManage) for (const state of next) { const button = document.createElement("button"); button.type="button"; button.className = state === "cancelled" ? "secondary" : ""; button.textContent = state === "cancelled" ? "Cancel order" : `Mark ${state}`; button.onclick = async () => { try { await apiCall(`/orders/restaurant/${order._id}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:state})}); await load(); } catch(error) { document.querySelector("#message").textContent = error.message; } }; actions.append(button); }
      card.querySelector(".print-bill").onclick = () => printBill(order); root.append(card);
    }
    if (!orders.length) root.innerHTML = `<div class="empty-state"><strong>${filter === "dine_in" ? "No open table tickets yet" : filter === "delivery" ? "No delivery orders yet" : "No orders yet"}</strong><p>New app and website orders will appear here automatically.</p></div>`;
  };
  async function load() { const {orders} = await apiCall("/orders/restaurant"); ordersCache = orders; if (canManage) await refreshMenu(); drawOrders(); }
  window.loadRestaurantOrderDesk = async (api, editable) => {
    apiCall = api; canManage = editable;
    if (document.querySelector("#order-filter")?.dataset.bound !== "true") { document.querySelector("#order-filter")?.addEventListener("change", drawOrders); if (document.querySelector("#order-filter")) document.querySelector("#order-filter").dataset.bound = "true"; }
    const builder = document.querySelector("#dine-in-form");
    if (builder && editable) {
      await refreshMenu();
      document.querySelector("#add-ticket-item").onclick = () => {
        const item = menuItems.find(value => value._id === document.querySelector("#ticket-menu-item").value); const quantity = Number(document.querySelector("#ticket-quantity").value);
        if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return;
        const line = basket.get(item._id) || {...item, quantity:0}; if (line.quantity + quantity > 20) return;
        line.quantity += quantity; basket.set(item._id, line); drawBasket();
      };
      builder.onsubmit = async event => {
        event.preventDefault(); const tableNumber = new FormData(builder).get("tableNumber").trim(); const customerName = new FormData(builder).get("customerName").trim();
        if (!basket.size) { document.querySelector("#message").textContent = "Add at least one item to the ticket."; return; }
        try { await apiCall("/orders/restaurant/dine-in", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tableNumber,customerName,items:[...basket.values()].map(item=>({menuItemId:item._id,quantity:item.quantity}))})}); builder.reset(); document.querySelector("#ticket-quantity").value="1"; basket.clear(); drawBasket(); document.querySelector("#message").textContent=`Table ${tableNumber} ticket created.`; await load(); }
        catch(error) { document.querySelector("#message").textContent=error.message; }
      };
    } else if (builder) builder.hidden = true;
    await load();
  };
  window.refreshRestaurantOrderDesk = () => apiCall && load();
})();

