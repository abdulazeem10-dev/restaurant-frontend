const paymentCart = readCart();
const paymentError = document.querySelector("#payment-error");
const confirmOrderButton = document.querySelector("#confirm-order");
const paymentChoices = [...document.querySelectorAll("[data-payment-choice]")];
let checkout = null;
let paymentSubtotalPaise = 0;
let stampRewardsAvailable = 0;
let checkoutTaxSettings = null;
let couponPreview = null;
const ORDER_IDEMPOTENCY_KEY = "food-platform-order-idempotency-key";
let razorpayConfig = { enabled: false, keyId: null };

function getOrderIdempotencyKey() {
  let key = sessionStorage.getItem(ORDER_IDEMPOTENCY_KEY);
  if (!key) {
    if (crypto.randomUUID) {
      key = crypto.randomUUID();
    } else {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
      key = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    sessionStorage.setItem(ORDER_IDEMPOTENCY_KEY, key);
  }
  return key;
}

try {
  checkout = JSON.parse(sessionStorage.getItem("food-platform-checkout") || "null");
} catch {
  checkout = null;
}

function showPaymentError(message) {
  paymentError.textContent = message;
}

function updateStampRewardPreview() {
  const checkbox = document.querySelector("#redeem-stamp-reward");
  const discountRow = document.querySelector("#payment-reward-discount");
  if (!checkbox || !discountRow) return;
  const rewardDiscount = checkbox.checked && stampRewardsAvailable > 0 ? Math.floor(paymentSubtotalPaise * 0.2) : 0;
  const couponDiscount = !rewardDiscount ? Number(couponPreview?.discountPaise) || 0 : 0;
  discountRow.hidden = rewardDiscount < 1;
  document.querySelector("#payment-discount-amount").textContent = rewardDiscount ? `−${formatRupees(rewardDiscount)}` : "";
  const couponRow = document.querySelector("#payment-coupon-discount");
  couponRow.hidden = couponDiscount < 1;
  document.querySelector("#payment-coupon-label").textContent = couponPreview ? `Coupon ${couponPreview.code}` : "Coupon discount";
  document.querySelector("#payment-coupon-amount").textContent = couponDiscount ? `−${formatRupees(couponDiscount)}` : "";
  checkbox.disabled = stampRewardsAvailable < 1 || Boolean(couponPreview);
  const taxable = Math.max(0, paymentSubtotalPaise - rewardDiscount - couponDiscount);
  const settings = checkoutTaxSettings;
  const rate = settings?.taxEnabled ? Number(settings.taxRateBasisPoints) || 0 : 0;
  const tax = !rate ? 0 : settings.taxInclusive
    ? Math.floor(taxable * rate / (10_000 + rate))
    : Math.floor(taxable * rate / 10_000);
  const taxRow = document.querySelector("#payment-tax-row");
  taxRow.hidden = tax < 1;
  document.querySelector("#payment-tax-label").textContent = `${settings?.taxLabel || "GST"} (${(rate / 100).toFixed(2).replace(/\.00$/, "")}%${settings?.taxInclusive ? " included" : ""})`;
  document.querySelector("#payment-tax-amount").textContent = formatRupees(tax);
  document.querySelector("#payment-total").textContent = formatRupees(taxable + (settings?.taxInclusive ? 0 : tax));
}

async function loadCheckoutTaxSettings() {
  if (!paymentCart?.restaurantId) return;
  try {
    const response = await fetch(`${API_BASE}/restaurants/${encodeURIComponent(paymentCart.restaurantId)}`);
    const data = await response.json().catch(() => ({}));
    if (response.ok) checkoutTaxSettings = data.restaurant || null;
  } catch (error) { console.warn("[checkout] tax preview unavailable", error); }
  updateStampRewardPreview();
}

async function loadStampReward() {
  const panel = document.querySelector("#loyalty-reward-panel");
  const checkbox = document.querySelector("#redeem-stamp-reward");
  const status = document.querySelector("#loyalty-reward-status");
  if (!panel || !checkbox || !getToken()) return;
  panel.hidden = false;
  try {
    const response = await fetch(`${API_BASE}/customer/loyalty`, { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load stamp balance");
    const loyalty = data.loyalty || {};
    stampRewardsAvailable = Number(loyalty.availableRewards) || 0;
    const stampsAvailable = Number(loyalty.stampsAvailable) || 0;
    checkbox.disabled = stampRewardsAvailable < 1;
    status.textContent = stampRewardsAvailable > 0
      ? `${stampsAvailable} stamps available · ${stampRewardsAvailable} reward${stampRewardsAvailable === 1 ? "" : "s"} ready`
      : `${stampsAvailable}/20 stamps collected. Earn 1 stamp per delivered order.`;
  } catch (error) {
    checkbox.disabled = true;
    status.textContent = "Stamp balance is temporarily unavailable. You can still place your order.";
    console.warn("[customer loyalty] checkout reward balance unavailable", error);
  }
  updateStampRewardPreview();
}

async function loadMarketingPreference() {
  const checkbox = document.querySelector("#marketing-opt-in");
  const status = document.querySelector("#marketing-preference-status");
  if (!checkbox || !getToken()) return;
  try {
    const response = await fetch(`${API_BASE}/customer/marketing-preference`, { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load your preference");
    checkbox.checked = Boolean(data.marketingOptIn);
    status.textContent = checkbox.checked ? "You opted in to optional WhatsApp offers. Untick this box to opt out." : "You are opted out. Tick the box to choose to receive optional WhatsApp offers.";
  } catch { status.textContent = "Your marketing preference could not be loaded right now."; }
}

function selectedPaymentMethod() {
  return document.querySelector('input[name="paymentMethod"]:checked:not(:disabled)')?.value || "cash_on_delivery";
}

function updatePaymentChoice() {
  const method = selectedPaymentMethod();
  sessionStorage.setItem("food-platform-payment-method", method);
  paymentChoices.forEach(choice => {
    const input = choice.querySelector("input");
    choice.classList.toggle("payment-option-selected", Boolean(input?.checked && !input.disabled));
  });
  const online = method === "razorpay";
  document.querySelector("#payment-total-label").textContent = "Order total";
  document.querySelector("#payment-security-note").textContent = online
    ? "Secure online payment will open after you place the order. The restaurant receives the order only after payment is verified."
    : method === "upi_qr"
      ? "UPI QR selected as your preference. No QR code or payment is generated on this page."
      : "Cash on delivery selected. Pay the delivery partner when your order arrives.";
  confirmOrderButton.textContent = "Place order";
}

function renderPaymentSummary() {
  if (!paymentCart?.items?.length || !checkout?.deliveryDetails || !checkout?.deliveryAddress) {
    showPaymentError("Your checkout details have expired. Return to your cart and enter your delivery details again.");
    confirmOrderButton.disabled = true;
    return;
  }

  const itemsRoot = document.querySelector("#payment-items");
  itemsRoot.replaceChildren();
  let subtotal = 0;
  for (const item of paymentCart.items) {
    const lineTotal = item.pricePaise * item.quantity;
    subtotal += lineTotal;
    const line = document.createElement("div");
    line.className = "payment-item-line";
    const name = document.createElement("span");
    name.textContent = `${item.quantity} × ${item.name}`;
    const price = document.createElement("strong");
    price.textContent = formatRupees(lineTotal);
    line.append(name, price);
    itemsRoot.append(line);
  }

  document.querySelector("#payment-restaurant").textContent = paymentCart.restaurantName || "Your order";
  paymentSubtotalPaise = subtotal;
  document.querySelector("#payment-recipient").textContent = `${checkout.deliveryDetails.name} · ${checkout.deliveryDetails.phone}`;
  document.querySelector("#payment-address").textContent = checkout.deliveryAddress;
  const area = document.querySelector("#payment-delivery-area");
  area.hidden = !checkout.deliveryDetails.deliveryAreaName;
  area.textContent = checkout.deliveryDetails.deliveryAreaName ? `Restaurant service area: ${checkout.deliveryDetails.deliveryAreaName}` : "";
  updateStampRewardPreview();
}

async function createOrder(paymentMethod) {
  const response = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json", "Idempotency-Key": getOrderIdempotencyKey() }),
    body: JSON.stringify({
      restaurantId: paymentCart.restaurantId,
      deliveryAddress: checkout.deliveryAddress,
      deliveryDetails: Object.fromEntries(["recipientType", "name", "phone", "flatBuilding", "lane", "landmark", "pincode"].map(key => [key, checkout.deliveryDetails[key]])),
      paymentMethod,
      redeemReward: Boolean(document.querySelector("#redeem-stamp-reward")?.checked && stampRewardsAvailable > 0),
      couponCode: couponPreview?.code || "",
      items: paymentCart.items.map(({ menuItemId, quantity, note }) => ({ menuItemId, quantity, note: String(note || "").trim().slice(0, 300) }))
    })
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearLocalSession();
    location.replace(`login.html?next=${encodeURIComponent("payment.html")}`);
    throw new Error("Your sign-in expired. Sign in again to finish placing your order.");
  }
  if (!response.ok) throw new Error(data.error || "Could not place your order");
  const order = data.order;
  const finalDiscount = Number(order.rewardDiscountPaise) || 0;
  const discountRow = document.querySelector("#payment-reward-discount");
  discountRow.hidden = finalDiscount < 1;
  document.querySelector("#payment-discount-amount").textContent = finalDiscount ? `−${formatRupees(finalDiscount)}` : "";
  const finalCouponDiscount = Number(order.couponDiscountPaise) || 0;
  document.querySelector("#payment-coupon-discount").hidden = finalCouponDiscount < 1;
  document.querySelector("#payment-coupon-label").textContent = order.couponCode ? `Coupon ${order.couponCode}` : "Coupon discount";
  document.querySelector("#payment-coupon-amount").textContent = finalCouponDiscount ? `−${formatRupees(finalCouponDiscount)}` : "";
  const taxRow = document.querySelector("#payment-tax-row");
  taxRow.hidden = !order.taxPaise;
  if (order.taxPaise) {
    const rate = (Number(order.taxRateBasisPoints) || 0) / 100;
    document.querySelector("#payment-tax-label").textContent = `${order.taxLabel || "GST"} (${rate}%${order.taxInclusive ? " included" : ""})`;
    document.querySelector("#payment-tax-amount").textContent = formatRupees(order.taxPaise);
  }
  document.querySelector("#payment-total").textContent = formatRupees(order.totalPaise);
  return order;
}

async function placeOrder() {
  const order = await createOrder(selectedPaymentMethod());
  if (selectedPaymentMethod() === "razorpay") {
    await startOnlinePayment(order);
    return;
  }
  finishCheckout();
}

function finishCheckout() {
  localStorage.removeItem("food-platform-cart");
  sessionStorage.removeItem("food-platform-checkout");
  sessionStorage.removeItem(ORDER_IDEMPOTENCY_KEY);
  sessionStorage.removeItem("food-platform-payment-method");
  location.href = "orders.html?placed=1";
}

async function startOnlinePayment(order) {
  if (!razorpayConfig.enabled || !window.Razorpay) {
    await cancelOnlineOrder(order._id).catch(() => {});
    sessionStorage.removeItem(ORDER_IDEMPOTENCY_KEY);
    throw new Error("Online payment could not start. Your order was not placed; choose cash on delivery or try again later.");
  }
  const response = await fetch(`${API_BASE}/payments/orders/${encodeURIComponent(order._id)}/razorpay-order`, { method: "POST", headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    await cancelOnlineOrder(order._id).catch(() => {});
    sessionStorage.removeItem(ORDER_IDEMPOTENCY_KEY);
    throw new Error(data.error || "Could not start online payment");
  }
  await new Promise((resolve, reject) => {
    let completed = false;
    const checkout = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: "Al-Madina",
      description: "Food order payment",
      order_id: data.razorpayOrderId,
      prefill: { name: checkoutDetailsName(), contact: checkoutDetailsPhone() },
      theme: { color: "#e7bd00" },
      handler: async result => {
        try {
          const verified = await fetch(`${API_BASE}/payments/orders/${encodeURIComponent(order._id)}/verify`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(result)
          });
          const verification = await verified.json().catch(() => ({}));
          if (!verified.ok || !verification.paid) throw new Error(verification.error || "Payment is still being confirmed. Check My orders before retrying.");
          completed = true;
          finishCheckout();
          resolve();
        } catch (error) { reject(error); }
      },
      modal: { ondismiss: async () => {
        if (completed) return;
        await cancelOnlineOrder(order._id).catch(() => {});
        sessionStorage.removeItem(ORDER_IDEMPOTENCY_KEY);
        reject(new Error("Payment was cancelled. Your order was not placed; you can choose cash on delivery."));
      } }
    });
    checkout.on("payment.failed", event => reject(new Error(event?.error?.description || "Payment failed. You can retry or choose cash on delivery.")));
    checkout.open();
  });
}

function checkoutDetailsName() { return checkout?.deliveryDetails?.name || ""; }
function checkoutDetailsPhone() { return checkout?.deliveryDetails?.phone || ""; }
async function cancelOnlineOrder(orderId) {
  return fetch(`${API_BASE}/payments/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST", headers: authHeaders() });
}

async function loadPaymentConfiguration() {
  const option = document.querySelector("#online-payment-choice");
  const input = option?.querySelector("input");
  const badge = document.querySelector("#online-payment-status");
  const copy = option?.querySelector(".payment-option-copy small");
  try {
    const response = await fetch(`${API_BASE}/payments/config`);
    const data = await response.json().catch(() => ({}));
    razorpayConfig = { enabled: Boolean(response.ok && data.enabled && data.keyId), keyId: data.keyId || null };
  } catch { razorpayConfig = { enabled: false, keyId: null }; }
  if (!option || !input) return;
  if (razorpayConfig.enabled) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Razorpay checkout could not load"));
        document.head.append(script);
      });
      razorpayConfig.enabled = typeof window.Razorpay === "function";
    } catch { razorpayConfig.enabled = false; }
  }
  input.disabled = !razorpayConfig.enabled;
  option.classList.toggle("payment-option-unavailable", !razorpayConfig.enabled);
  option.setAttribute("aria-disabled", String(!razorpayConfig.enabled));
  if (badge) badge.textContent = razorpayConfig.enabled ? "Available" : "Unavailable";
  if (copy && !razorpayConfig.enabled) copy.textContent = "Online payment is not configured yet. Choose cash on delivery.";
}

confirmOrderButton.addEventListener("click", async () => {
  showPaymentError("");
  if (!getToken()) {
    location.href = `login.html?next=${encodeURIComponent("payment.html")}`;
    return;
  }
  if (!paymentCart?.items?.length || !checkout?.deliveryDetails || !checkout?.deliveryAddress) {
    renderPaymentSummary();
    return;
  }

  confirmOrderButton.disabled = true;
  try {
    await placeOrder();
  } catch (error) {
    showPaymentError(error.message);
  } finally {
    confirmOrderButton.disabled = false;
    updatePaymentChoice();
  }
});

const savedPaymentMethod = sessionStorage.getItem("food-platform-payment-method");
if (savedPaymentMethod && paymentChoices.some(choice => {
  const input = choice.querySelector("input");
  return input?.value === savedPaymentMethod && !input.disabled;
})) {
  document.querySelector(`input[name="paymentMethod"][value="${savedPaymentMethod}"]`).checked = true;
}
paymentChoices.forEach(choice => choice.querySelector("input").addEventListener("change", updatePaymentChoice));
renderPaymentSummary();
loadStampReward();
loadPaymentConfiguration();
loadCheckoutTaxSettings();
loadMarketingPreference();
document.querySelector("#redeem-stamp-reward")?.addEventListener("change", updateStampRewardPreview);
document.querySelector("#coupon-form")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.elements.code;
  const status = document.querySelector("#coupon-status");
  const code = input.value.trim().toUpperCase();
  if (!code) {
    couponPreview = null;
    status.textContent = "Coupon removed.";
    updateStampRewardPreview();
    return;
  }
  if (document.querySelector("#redeem-stamp-reward")?.checked) {
    document.querySelector("#redeem-stamp-reward").checked = false;
  }
  const button = form.querySelector("button[type='submit']"); button.disabled = true; status.textContent = "Checking coupon…";
  try {
    const response = await fetch(`${API_BASE}/restaurants/${encodeURIComponent(paymentCart.restaurantId)}/coupons/preview`, {
      method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ code, subtotalPaise: paymentSubtotalPaise })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Coupon could not be applied.");
    couponPreview = { code: data.coupon.code, discountPaise: Number(data.discountPaise) || 0 };
    status.textContent = `${couponPreview.code} applied · you save ${formatRupees(couponPreview.discountPaise)}. This will be checked again when you place the order.`;
    updateStampRewardPreview();
  } catch (error) { couponPreview = null; status.textContent = error.message; updateStampRewardPreview(); }
  finally { button.disabled = false; }
});
document.querySelector("#coupon-code")?.addEventListener("input", event => {
  if (couponPreview && event.currentTarget.value.trim().toUpperCase() !== couponPreview.code) {
    couponPreview = null;
    document.querySelector("#coupon-status").textContent = "Coupon removed. Apply the new code to use it.";
    updateStampRewardPreview();
  }
});
document.querySelector("#marketing-opt-in")?.addEventListener("change", async event => {
  const checkbox = event.currentTarget;
  const status = document.querySelector("#marketing-preference-status");
  checkbox.disabled = true; status.textContent = "Saving your choice…";
  try {
    const response = await fetch(`${API_BASE}/customer/marketing-preference`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ marketingOptIn: checkbox.checked }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not save your preference");
    status.textContent = data.marketingOptIn ? "You opted in to optional WhatsApp offers. Untick this box to opt out." : "You are opted out of optional WhatsApp offers.";
  } catch (error) { checkbox.checked = !checkbox.checked; status.textContent = error.message; }
  finally { checkbox.disabled = false; }
});
updatePaymentChoice();
