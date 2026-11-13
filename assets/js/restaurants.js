const brandName = "Al-Madina";
const alMadinaRestaurantName = /^al[\s-]?madina(?:\s+family\s+restaurant)?$/i;
const searchForm = document.querySelector("#restaurant-search");
const searchInput = document.querySelector("#search-input");
const quickFoodFilters = [...document.querySelectorAll("[data-quick-food]")];
const budgetFilters = [...document.querySelectorAll("[data-budget-filter]")];
const cuisineTrack = document.querySelector("#cuisine-track");
const featuredSection = document.querySelector("#restaurant-listing");
const featuredDishesTrack = document.querySelector("#featured-dishes-track");
const viewFullMenu = document.querySelector("#view-full-menu");
const errorMessage = document.querySelector("#error");
let currentRestaurant = null;
let allMenuItems = [];
let selectedFoodFilter = "all";
let selectedBudgetFilter = "all";
let selectedCuisineFilter = "all";

function getVisibleDishes() {
  const term = searchInput.value.trim().toLocaleLowerCase();
  const maxPricePaise = selectedBudgetFilter === "all" ? Infinity : Number(selectedBudgetFilter) * 100;
  const foodFiltered = window.foodwayFilterMenuItemsByFoodType?.(allMenuItems, selectedFoodFilter)
    || allMenuItems.filter(item => selectedFoodFilter === "all"
      || (window.foodwayNormalizeFoodType?.(item.foodType) || item.foodType) === selectedFoodFilter);
  return foodFiltered.filter(item => {
    const text = [item.name, item.description].filter(Boolean).join(" ").toLocaleLowerCase();
    const category = window.foodwayMenuCategoryFor?.(item) || String(item.category || "").trim();
    const matchesCuisine = selectedCuisineFilter === "all" || category === selectedCuisineFilter;
    return (!term || text.includes(term))
      && Number(item.pricePaise) <= maxPricePaise
      && matchesCuisine;
  });
}
function renderCategoryCarousel() {
  if (!cuisineTrack) return;
  const categories = [...new Set(allMenuItems.map(item => window.foodwayMenuCategoryFor?.(item) || String(item.category || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "en"));
  const choices = [{ value: "all", label: "All dishes", image: "../assets/images/cuisines/all.webp" },
    ...categories.map(category => ({ value: category, label: category, image: cuisineImageFor({ category }) }))];
  cuisineTrack.replaceChildren(...choices.map(choice => {
    const button = document.createElement("button");
    button.className = "cuisine-option";
    button.type = "button";
    button.dataset.cuisineFilter = choice.value;
    button.setAttribute("aria-pressed", String(choice.value === selectedCuisineFilter));
    const art = document.createElement("span");
    art.className = "cuisine-art";
    art.setAttribute("aria-hidden", "true");
    const image = document.createElement("img");
    image.src = choice.image;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove(), { once: true });
    art.append(image);
    const label = document.createElement("span");
    label.textContent = choice.label;
    button.append(art, label);
    return button;
  }));
}
function cuisineImageFor(item) {
  const category = String(item.category || "").toLocaleLowerCase();
  if (/noodle/.test(category)) return "../assets/images/cuisines/noodles.webp";
  if (/chinese|soup/.test(category)) return "../assets/images/cuisines/chinese.webp";
  if (/pizza/.test(category)) return "../assets/images/cuisines/pizza.webp";
  if (/dessert|sweet/.test(category)) return "../assets/images/cuisines/desserts.webp";
  if (/biryani/.test(category)) return "../assets/images/cuisines/biryani.webp";
  if (/burger|fast.?food/.test(category)) return "../assets/images/cuisines/burger.webp";
  if (/maharashtrian/.test(category)) return "../assets/images/cuisines/other.webp";
  if (/south|idli|dosa|vada/.test(category)) return "../assets/images/cuisines/south-indian.webp";
  if (/north|kachori|paratha|puri/.test(category)) return "../assets/images/cuisines/north-indian.webp";
  if (/maharashtrian|poha/.test(category)) return "../assets/images/cuisines/other.webp";
  if (/momo/.test(category)) return "../assets/images/cuisines/momo.webp";
  return "../assets/images/cuisines/all.webp";
}
function renderMenuPreview() {
  if (!featuredSection || !featuredDishesTrack) return;
  const dishes = getVisibleDishes();
  quickFoodFilters.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.quickFood === selectedFoodFilter)));
  budgetFilters.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.budgetFilter === selectedBudgetFilter)));
  cuisineTrack?.querySelectorAll("[data-cuisine-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.cuisineFilter === selectedCuisineFilter)));
  featuredSection.hidden = !currentRestaurant;
  if (viewFullMenu) { viewFullMenu.hidden = !currentRestaurant; if (currentRestaurant) viewFullMenu.href = `menu.html?id=${encodeURIComponent(currentRestaurant._id)}`; }
  featuredDishesTrack.replaceChildren();
  if (!currentRestaurant) return;
  if (!dishes.length) {
    const empty = document.createElement("p"); empty.className = "featured-dishes-empty";
    empty.textContent = allMenuItems.length ? "No dishes match these filters. Try another cuisine or clear your search." : "The Al-Madina menu is being updated. Please check back soon.";
    featuredDishesTrack.append(empty); return;
  }
  const displayDishes = window.foodwayGroupMenuItems?.(dishes) || dishes.map(item => ({ name: item.name, variants: [item] }));
  for (const dish of displayDishes) {
    const item = dish.variants[0];
    const card = document.createElement("a"); card.className = "featured-dish-card";
    card.href = `menu.html?id=${encodeURIComponent(currentRestaurant._id)}&dish=${encodeURIComponent(dish.name)}`;
    card.setAttribute("aria-label", `View ${dish.name} from ${brandName}`);
    const imageWrap = document.createElement("div"); imageWrap.className = "featured-dish-image-wrap";
    const dishImage = window.foodwayDishImage?.(item);
    const image = document.createElement("img"); image.src = dishImage?.src || cuisineImageFor(item); image.alt = item.name ? `Food photo for ${item.name}` : "Al-Madina dish";
    image.loading = "lazy"; image.decoding = "async"; image.addEventListener("error", () => { console.warn(`[dish images] Failed to load image for ${item.name} → asset unavailable`, image.src); image.remove(); }, { once: true }); imageWrap.append(image);
    const details = document.createElement("div"); details.className = "featured-dish-details";
    const name = document.createElement("h3"); name.textContent = dish.name;
    const price = document.createElement("strong");
    const dishPrices = dish.variants.map(variant => Number(variant.pricePaise)).sort((a, b) => a - b);
    price.textContent = dishPrices.length > 1 ? `${formatRupees(dishPrices[0])} – ${formatRupees(dishPrices[dishPrices.length - 1])}` : formatRupees(dishPrices[0]);
    const restaurant = document.createElement("span"); restaurant.textContent = brandName;
    const foodType = window.foodwayNormalizeFoodType?.(item.foodType) || item.foodType;
    const type = document.createElement("small"); type.className = foodType === "veg" ? "dish-food-type dish-food-type-veg" : "dish-food-type dish-food-type-nonveg";
    type.textContent = foodType === "veg" ? "Veg" : foodType === "nonVeg" ? "Non-Veg" : item.category || "Food";
    details.append(name, price);
    if (dish.variants.length > 1) {
      const portions = document.createElement("span");
      portions.textContent = dish.variants.map(variant => variant.name.match(/\((half|full)\)$/i)?.[1]).filter(Boolean).map(value => value[0].toUpperCase() + value.slice(1)).join(" / ") || "Portion options";
      details.append(portions);
    }
    details.append(restaurant, type); card.append(imageWrap, details); featuredDishesTrack.append(card);
  }
}
function renderFoodPassport(orders = []) {
  const stamps = document.querySelector("#passport-stamps"), label = document.querySelector("#passport-progress-label");
  const bar = document.querySelector("#passport-progress-bar"), hint = document.querySelector("#passport-progress-hint");
  if (!stamps || !label || !bar || !hint) return;
  const earned = Boolean(currentRestaurant && orders.some(order => order.status === "delivered" && String(order.restaurantId?._id || order.restaurantId) === String(currentRestaurant._id)));
  label.textContent = `${earned ? 1 : 0} of 1 Al-Madina orders`;
  bar.style.width = earned ? "100%" : "0%";
  hint.textContent = earned ? "You earned your Al-Madina visit stamp." : getToken() ? "Complete an Al-Madina order to collect your stamp." : "Sign in and complete an order to collect your first stamp.";
  const card = document.createElement("div"); card.className = `food-passport-stamp-card${earned ? " is-visited" : ""}`;
  const icon = document.createElement("span"); icon.className = "food-passport-stamp-icon"; icon.textContent = earned ? "✓" : "○";
  const copy = document.createElement("span"), name = document.createElement("strong"), detail = document.createElement("small");
  name.textContent = brandName; detail.textContent = "Veg and non-veg favourites"; copy.append(name, detail); card.append(icon, copy); stamps.replaceChildren(card);
}
function renderRecentOrders(orders = []) {
  const section = document.querySelector("#recent-orders-section"), track = document.querySelector("#recent-orders-track");
  if (!section || !track || !currentRestaurant) return;
  const recent = orders.filter(order => order.status === "delivered" && String(order.restaurantId?._id || order.restaurantId) === String(currentRestaurant._id)).slice(0, 3);
  if (!recent.length) { section.hidden = true; return; }
  section.hidden = false;
  track.replaceChildren(...recent.map(order => {
    const card = document.createElement("a"); card.className = "recent-order-card"; card.href = `menu.html?id=${encodeURIComponent(currentRestaurant._id)}`;
    const firstDish = (order.items || [])[0];
    const firstDishId = firstDish?.menuItemId?._id || firstDish?.menuItemId;
    const menuDish = allMenuItems.find(item => String(item._id) === String(firstDishId))
      || allMenuItems.find(item => item.name?.trim().toLocaleLowerCase() === firstDish?.name?.trim().toLocaleLowerCase());
    const orderedDish = menuDish || { name: firstDish?.name, category: firstDish?.category };
    const fallbackImage = window.foodwayDishImage?.(orderedDish)?.src || cuisineImageFor(orderedDish);
    const image = document.createElement("img"); image.className = "recent-order-image"; image.src = menuDish?.imageUrl || firstDish?.imageUrl || fallbackImage;
    image.alt = firstDish?.name ? `${firstDish.name} dish` : "Al-Madina dish"; image.loading = "lazy"; image.decoding = "async";
    image.addEventListener("error", () => { if (image.dataset.fallbackApplied) { console.warn(`[dish images] Failed to load recent-order photo → asset unavailable`, image.src); image.remove(); } else { console.warn(`[dish images] Order photo unavailable; using local fallback`, image.src); image.dataset.fallbackApplied = "true"; image.src = fallbackImage; } });
    const name = document.createElement("strong"); name.textContent = brandName;
    const items = document.createElement("span"); items.textContent = (order.items || []).slice(0, 2).map(item => `${item.quantity} × ${item.name}`).join(" · ") || "View the current menu";
    const action = document.createElement("span"); action.className = "recent-order-action"; action.textContent = "View menu →";
    card.append(image, name, items, action); return card;
  }));
}
async function loadRecentOrders() {
  if (!getToken()) return;
  try { const response = await fetch(`${API_BASE}/orders/mine`, { headers: authHeaders() }); console.info(`[customer orders] GET /orders/mine → ${response.status}`); if (response.ok) { const orders = (await response.json()).orders || []; renderRecentOrders(orders); renderFoodPassport(orders); } }
  catch (error) { console.error("[customer orders] could not load recent orders", error); }
}
async function setupHomeAccountNav() {
  if (!getToken()) return;
  try {
    const response = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() }); console.info(`[customer account] GET /auth/me → ${response.status}`);
    if (response.status === 401) { clearLocalSession(); return; }
    if (!response.ok) return;
    const { user } = await response.json();
    const destinations = { admin: ["../admin/dashboard.html", "Admin dashboard"], restaurant: ["../restaurant/dashboard.html", "Restaurant dashboard"], restaurant_staff: ["../restaurant/staff-dashboard.html", "Restaurant staff dashboard"], delivery: ["../delivery/dashboard.html", "Delivery dashboard"] };
    const destination = destinations[user?.role], dashboardLink = document.querySelector("#dashboard-link");
    if (destination && dashboardLink) { dashboardLink.href = destination[0]; dashboardLink.textContent = destination[1]; dashboardLink.hidden = false; }
    const loginLink = document.querySelector(".login-link"); if (loginLink) loginLink.hidden = true;
    const mobileAccountLink = document.querySelector("#mobile-account-link"); if (mobileAccountLink) mobileAccountLink.href = destination?.[0] || "orders.html";
    const logout = document.querySelector("#home-logout");
    if (logout) { logout.hidden = false; logout.addEventListener("click", () => { logoutSession().finally(() => { location.href = "index.html"; }); }, { once: true }); }
  } catch (error) { console.error("[customer account] could not load account", error); }
}
async function loadRestaurants() {
  if (featuredSection) featuredSection.hidden = false;
  if (errorMessage) errorMessage.textContent = "";
  featuredDishesTrack?.replaceChildren(Object.assign(document.createElement("p"), { className: "muted", textContent: "Loading the Al-Madina menu…" }));
  try {
    const response = await fetch(`${API_BASE}/restaurants`); console.info(`[Al-Madina menu] GET /restaurants → ${response.status}`);
    if (!response.ok) throw new Error("Unable to load Al-Madina");
    const data = await response.json(), approved = data.restaurants || [];
    currentRestaurant = approved.find(restaurant => alMadinaRestaurantName.test(String(restaurant.name || "").trim())) || null;
    if (!currentRestaurant) {
      throw new Error("No approved Al-Madina restaurant was returned by the public restaurant API.");
    }
    const menuResponse = await fetch(`${API_BASE}/restaurants/${encodeURIComponent(currentRestaurant._id)}/menu`);
    console.info(`[Al-Madina menu] GET /restaurants/${currentRestaurant._id}/menu → ${menuResponse.status}`);
    if (!menuResponse.ok) throw new Error("Could not load Al-Madina dishes");
    allMenuItems = ((await menuResponse.json()).items || []).map(item => ({
      ...item,
      foodType: window.foodwayNormalizeFoodType?.(item.foodType) || item.foodType || ""
    }));
    if (selectedCuisineFilter !== "all" && !allMenuItems.some(item => (window.foodwayMenuCategoryFor?.(item) || item.category) === selectedCuisineFilter)) selectedCuisineFilter = "all";
    renderCategoryCarousel();
    renderMenuPreview(); await loadRecentOrders();
  } catch (error) {
    console.error("[Al-Madina menu] load failed", error);
    if (errorMessage) errorMessage.textContent = "Please try again in a moment. If the problem continues, contact Al Madina directly.";
    if (viewFullMenu) viewFullMenu.hidden = true;
    featuredDishesTrack?.replaceChildren(Object.assign(document.createElement("p"), { className: "featured-dishes-empty", textContent: "We’re having trouble loading the menu right now." }));
  }
}
searchForm?.addEventListener("submit", event => { event.preventDefault(); renderMenuPreview(); document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
searchInput?.addEventListener("input", renderMenuPreview);
quickFoodFilters.forEach(button => button.addEventListener("click", () => { selectedFoodFilter = button.dataset.quickFood; renderMenuPreview(); }));
budgetFilters.forEach(button => button.addEventListener("click", () => { selectedBudgetFilter = button.dataset.budgetFilter; renderMenuPreview(); document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
cuisineTrack?.addEventListener("click", event => { const button = event.target.closest("[data-cuisine-filter]"); if (!button) return; selectedCuisineFilter = button.dataset.cuisineFilter; renderMenuPreview(); document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
document.querySelector("#cuisine-scroll-left")?.addEventListener("click", () => cuisineTrack.scrollBy({ left: -Math.max(280, cuisineTrack.clientWidth * .75), behavior: "smooth" }));
document.querySelector("#cuisine-scroll-right")?.addEventListener("click", () => cuisineTrack.scrollBy({ left: Math.max(280, cuisineTrack.clientWidth * .75), behavior: "smooth" }));
document.querySelector("#food-scroll-left")?.addEventListener("click", () => featuredDishesTrack.scrollBy({ left: -Math.max(260, featuredDishesTrack.clientWidth * .75), behavior: "smooth" }));
document.querySelector("#food-scroll-right")?.addEventListener("click", () => featuredDishesTrack.scrollBy({ left: Math.max(260, featuredDishesTrack.clientWidth * .75), behavior: "smooth" }));
renderFoodPassport();
loadRestaurants();
setupHomeAccountNav();

const promoSlides = [...document.querySelectorAll("[data-promo-slide]")];
const promoDots = [...document.querySelectorAll("[data-promo-dot]")];
let activePromoIndex = 0;
function showPromo(index) {
  if (!promoSlides.length) return;
  activePromoIndex = (index + promoSlides.length) % promoSlides.length;
  promoSlides.forEach((slide, slideIndex) => {
    const active = slideIndex === activePromoIndex;
    slide.hidden = !active;
    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", String(!active));
  });
  promoDots.forEach((dot, dotIndex) => dot.setAttribute("aria-current", String(dotIndex === activePromoIndex)));
}
document.querySelector("#promo-previous")?.addEventListener("click", () => showPromo(activePromoIndex - 1));
document.querySelector("#promo-next")?.addEventListener("click", () => showPromo(activePromoIndex + 1));
promoDots.forEach(dot => dot.addEventListener("click", () => showPromo(Number(dot.dataset.promoDot))));
let promoTouchStart = null;
document.querySelector("#promo-slides")?.addEventListener("pointerdown", event => { promoTouchStart = event.clientX; });
document.querySelector("#promo-slides")?.addEventListener("pointerup", event => {
  if (promoTouchStart === null) return;
  const distance = event.clientX - promoTouchStart;
  promoTouchStart = null;
  if (Math.abs(distance) > 45) showPromo(activePromoIndex + (distance < 0 ? 1 : -1));
});
document.querySelector("#promo-slides")?.addEventListener("pointercancel", () => { promoTouchStart = null; });
document.querySelector("#promo-slides")?.addEventListener("click", event => {
  const button = event.target.closest("[data-promo-category]");
  if (!button) return;
  const target = button.dataset.promoCategory;
  selectedCuisineFilter = target === "all" ? "all" : allMenuItems.map(item => window.foodwayMenuCategoryFor?.(item) || String(item.category || "").trim()).find(category => category.toLocaleLowerCase().includes(target)) || "all";
  renderMenuPreview();
  document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

const voiceSearchButton = document.querySelector("#voice-search-button");
const voiceSearchStatus = document.querySelector("#voice-search-status");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (voiceSearchButton && SpeechRecognition) {
  voiceSearchButton.hidden = false;
  const speechRecognition = new SpeechRecognition();
  speechRecognition.lang = "en-IN";
  speechRecognition.interimResults = false;
  speechRecognition.maxAlternatives = 1;
  speechRecognition.onstart = () => {
    voiceSearchButton.setAttribute("aria-pressed", "true");
    voiceSearchStatus.textContent = "Listening. Say a dish or category.";
  };
  speechRecognition.onresult = event => {
    const spokenQuery = event.results?.[0]?.[0]?.transcript?.trim();
    if (!spokenQuery) return;
    searchInput.value = spokenQuery;
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    voiceSearchStatus.textContent = `Searching for ${spokenQuery}.`;
    document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  speechRecognition.onerror = event => {
    voiceSearchStatus.textContent = event.error === "not-allowed" ? "Allow microphone access to search by voice." : "Voice search could not start. Type your search instead.";
  };
  speechRecognition.onend = () => voiceSearchButton.setAttribute("aria-pressed", "false");
  voiceSearchButton.addEventListener("click", () => {
    try { speechRecognition.start(); }
    catch { voiceSearchStatus.textContent = "Voice search is already listening."; }
  });
}
