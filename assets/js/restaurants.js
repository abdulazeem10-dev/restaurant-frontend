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
let restaurantsLoading = false;

const waitBeforeMenuRetry = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const menuRetryDelays = [2000, 4000, 7000, 10000, 15000, 20000];
async function fetchPublicMenuJson(url, label, attempts = 7, onRetry = () => {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      console.info(`[Al-Madina menu] ${label} → ${response.status} (attempt ${attempt}/${attempts})`);
      if (!response.ok) {
        const error = new Error(`${label} returned HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      const contentType = response.headers.get("content-type") || "";
      if (!/\bjson\b/i.test(contentType)) {
        const error = new Error(`${label} returned a non-JSON response`);
        error.status = response.status;
        error.code = "non_json_api_response";
        throw error;
      }
      try { return await response.json(); }
      catch {
        const error = new Error(`${label} returned invalid JSON`);
        error.status = response.status;
        error.code = "invalid_json_api_response";
        throw error;
      }
    } catch (error) {
      lastError = error;
      if (["non_json_api_response", "invalid_json_api_response"].includes(error.code)) throw error;
      const retryable = !Number.isInteger(error.status) || [500, 502, 503, 504, 522, 524].includes(error.status);
      if (!retryable || attempt === attempts) throw error;
    }
    const delay = menuRetryDelays[attempt - 1] ?? 20000;
    onRetry(attempt + 1, attempts, delay, lastError);
    await waitBeforeMenuRetry(delay);
  }
  throw lastError || new Error("Could not load Al-Madina menu data");
}

function getFoodFilteredMenuItems() {
  return window.foodwayFilterMenuItemsByFoodType?.(allMenuItems, selectedFoodFilter)
    || allMenuItems.filter(item => selectedFoodFilter === "all"
      || (window.foodwayNormalizeFoodType?.(item.foodType) || item.foodType) === selectedFoodFilter);
}
const dishSearchStopWords = new Set(["a", "an", "and", "can", "could", "dish", "dishes", "do", "find", "food", "for", "give", "have", "i", "like", "me", "menu", "of", "order", "please", "search", "show", "some", "the", "to", "want", "you"]);
function normalizeDishSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function dishSearchTokens(value) {
  return normalizeDishSearch(value).split(/\s+/).filter(token => token && !dishSearchStopWords.has(token));
}
function dishSearchDistance(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const distance = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      current[column] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }
    if (rowMinimum > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length];
}
function dishSearchTokenMatches(queryToken, dishToken) {
  if (queryToken === dishToken) return true;
  if (queryToken === "chicken" && ["chi", "ch", "chic"].includes(dishToken)) return true;
  if (queryToken.length >= 3 && dishToken.length >= 3
    && (queryToken.startsWith(dishToken) || dishToken.startsWith(queryToken))
    && Math.abs(queryToken.length - dishToken.length) <= 2) return true;
  if (Math.min(queryToken.length, dishToken.length) < 5) return false;
  const editLimit = Math.min(queryToken.length, dishToken.length) >= 8 ? 2 : 1;
  return dishSearchDistance(queryToken, dishToken, editLimit) <= editLimit;
}
function scoreDishSearch(item, queryTokens) {
  if (!queryTokens.length) return 0;
  const nameTokens = dishSearchTokens(item.name);
  const category = window.foodwayMenuCategoryFor?.(item) || item.category || "";
  const contextTokens = dishSearchTokens(`${category} ${item.description || ""}`);
  let nameHits = 0;
  let contextHits = 0;
  for (const queryToken of queryTokens) {
    if (nameTokens.some(token => dishSearchTokenMatches(queryToken, token))) nameHits += 1;
    else if (contextTokens.some(token => dishSearchTokenMatches(queryToken, token))) contextHits += 1;
  }
  const matchCount = nameHits + contextHits;
  const minimumMatches = queryTokens.length <= 2 ? queryTokens.length : Math.max(2, Math.ceil(queryTokens.length * 0.6));
  if (matchCount < minimumMatches) return null;
  const normalizedPhrase = queryTokens.join(" ");
  const normalizedName = normalizeDishSearch(item.name);
  const exactPhraseBonus = normalizedName.includes(normalizedPhrase) ? 8 : 0;
  return nameHits * 3 + contextHits + exactPhraseBonus + nameHits / queryTokens.length;
}
function getVisibleDishes() {
  const queryTokens = dishSearchTokens(searchInput.value);
  const maxPricePaise = selectedBudgetFilter === "all" ? Infinity : Number(selectedBudgetFilter) * 100;
  const foodFiltered = getFoodFilteredMenuItems();
  return foodFiltered.map((item, index) => ({ item, index, score: scoreDishSearch(item, queryTokens) }))
    .filter(({ item, score }) => {
    const category = window.foodwayMenuCategoryFor?.(item) || String(item.category || "").trim();
    const matchesCuisine = selectedCuisineFilter === "all" || category === selectedCuisineFilter;
    return (score !== null)
      && Number(item.pricePaise) <= maxPricePaise
      && matchesCuisine;
    })
    .sort((left, right) => (right.score - left.score) || left.index - right.index)
    .map(({ item }) => item);
}
function renderCategoryCarousel() {
  if (!cuisineTrack) return;
  const foodFiltered = getFoodFilteredMenuItems();
  const categories = [...new Set(foodFiltered.map(item => window.foodwayMenuCategoryFor?.(item) || String(item.category || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "en"));
  const configured = currentRestaurant?.categoryCarousel || [];
  const configByCategory = new Map(configured.map(item => [String(item.category || "").trim().toLocaleLowerCase(), item]));
  const categoryChoices = categories.map((category, index) => ({ category, index, config: configByCategory.get(category.toLocaleLowerCase()) }))
    .filter(item => item.config?.visible !== false)
    .filter(item => selectedFoodFilter === "all" || !["veg", "nonVeg"].includes(item.config?.foodType) || item.config.foodType === selectedFoodFilter)
    .sort((a, b) => {
      const orderA = Number.isInteger(a.config?.order) ? a.config.order : 1000 + a.index;
      const orderB = Number.isInteger(b.config?.order) ? b.config.order : 1000 + b.index;
      return orderA - orderB || a.category.localeCompare(b.category, "en");
    });
  const choices = [{ value: "all", label: "All dishes", image: "../assets/images/cuisines/all.webp" },
    ...categoryChoices.map(({ category, config }) => ({ value: category, label: config?.label || category, image: config?.imageUrl || cuisineImageFor({ category }) }))];
  if (!choices.some(choice => choice.value === selectedCuisineFilter)) selectedCuisineFilter = "all";
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
function renderFoodPassport(orders = [], loyalty = null) {
  const stamps = document.querySelector("#passport-stamps"), label = document.querySelector("#passport-progress-label");
  const hint = document.querySelector("#passport-progress-hint");
  if (!stamps || !label || !hint) return;
  const restaurantOrders = currentRestaurant
    ? orders.filter(order => String(order.restaurantId?._id || order.restaurantId) === String(currentRestaurant._id))
    : [];
  const delivered = restaurantOrders.filter(order => String(order.status || "").toLowerCase() === "delivered");
  delivered.sort((a, b) => new Date(b.deliveredAt || b.updatedAt || b.createdAt || 0) - new Date(a.deliveredAt || a.updatedAt || a.createdAt || 0));
  const hasInProgress = restaurantOrders.some(order => !["delivered", "cancelled", "rejected"].includes(String(order.status || "").toLowerCase()));
  const stampsEarned = Number(loyalty?.stampsEarned ?? delivered.length);
  const stampsAvailable = Number(loyalty?.stampsAvailable || 0);
  const stampsProgress = Number(loyalty?.stampsTowardNextReward || 0);
  const rewardsReady = Number(loyalty?.availableRewards || 0);
  label.textContent = getToken()
    ? `${stampsAvailable} available stamp${stampsAvailable === 1 ? "" : "s"} · ${stampsEarned} earned`
    : "Sign in to see your delivered orders";
  hint.textContent = !getToken()
    ? "Get 1 stamp for each delivered Al-Madina order. Redeem 20 stamps for 20% off one order. Sign in to see your balance."
    : hasInProgress
      ? `${loyalty?.rewardMessage || "Get 1 stamp for each delivered order. Redeem 20 stamps for 20% off one order."} Your stamp appears after delivery.`
      : delivered.length
        ? `${rewardsReady} reward${rewardsReady === 1 ? "" : "s"} ready to use · ${stampsProgress}/20 stamps toward the next reward.`
        : `Place an Al-Madina order to start collecting stamps. ${loyalty?.rewardMessage || "Get 1 stamp for each delivered order. Redeem 20 stamps for 20% off one order."}`;

  stamps.replaceChildren(...delivered.map(order => {
    const card = document.createElement("div"); card.className = "food-passport-stamp-card is-visited";
    const icon = document.createElement("span"); icon.className = "food-passport-stamp-icon"; icon.textContent = "✓";
    const copy = document.createElement("span"), name = document.createElement("strong"), detail = document.createElement("small");
    const shortId = String(order._id || "").slice(-6);
    const dateValue = order.deliveredAt || order.updatedAt || order.createdAt;
    const orderDate = dateValue ? new Date(dateValue) : null;
    name.textContent = "Al-Madina stamp earned";
    detail.textContent = [shortId ? `Order #${shortId}` : "Delivered order", orderDate && !Number.isNaN(orderDate.valueOf()) ? orderDate.toLocaleDateString("en-IN") : ""].filter(Boolean).join(" · ");
    copy.append(name, detail); card.append(icon, copy); return card;
  }));
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
  if (!getToken()) { renderFoodPassport(); return; }
  try {
    const response = await fetch(`${API_BASE}/orders/mine`, { headers: authHeaders() });
    console.info(`[customer orders] GET /orders/mine → ${response.status}`);
    if (!response.ok) throw new Error(`Could not load customer orders (${response.status})`);
    const orders = (await response.json()).orders || [];
    renderRecentOrders(orders);
    let loyalty = null;
    try {
      const loyaltyResponse = await fetch(`${API_BASE}/customer/loyalty`, { headers: authHeaders() });
      console.info(`[customer loyalty] GET /customer/loyalty → ${loyaltyResponse.status}`);
      if (loyaltyResponse.ok) loyalty = (await loyaltyResponse.json()).loyalty || null;
    } catch (error) { console.warn("[customer loyalty] could not load stamp summary", error); }
    renderFoodPassport(orders, loyalty);
  }
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
  if (restaurantsLoading) return;
  restaurantsLoading = true;
  if (featuredSection) featuredSection.hidden = false;
  if (errorMessage) errorMessage.textContent = "";
  const loadingMessage = Object.assign(document.createElement("p"), { className: "muted", textContent: "Loading the Al-Madina menu…" });
  featuredDishesTrack?.replaceChildren(loadingMessage);
  const showRetryProgress = (nextAttempt, attempts) => {
    if (loadingMessage.isConnected) loadingMessage.textContent = `The menu server is waking up. Reconnecting (${nextAttempt} of ${attempts})…`;
  };
  try {
    const data = await fetchPublicMenuJson(`${API_BASE}/restaurants`, "GET /restaurants", 7, showRetryProgress);
    const approved = data.restaurants || [];
    currentRestaurant = approved.find(restaurant => alMadinaRestaurantName.test(String(restaurant.name || "").trim())) || null;
    if (!currentRestaurant) {
      throw new Error("No approved Al-Madina restaurant was returned by the public restaurant API.");
    }
    renderFoodPassport();
    const menuData = await fetchPublicMenuJson(`${API_BASE}/restaurants/${encodeURIComponent(currentRestaurant._id)}/menu`, `GET /restaurants/${currentRestaurant._id}/menu`, 7, showRetryProgress);
    const normalizedItems = (menuData.items || []).map(item => ({
      ...item,
      foodType: window.foodwayNormalizeFoodType?.(item.foodType) || item.foodType || ""
    }));
    allMenuItems = window.foodwayDeduplicateMenuItems?.(normalizedItems) || normalizedItems;
    if (selectedCuisineFilter !== "all" && !allMenuItems.some(item => (window.foodwayMenuCategoryFor?.(item) || item.category) === selectedCuisineFilter)) selectedCuisineFilter = "all";
    renderCategoryCarousel();
    renderMenuPreview(); await loadRecentOrders();
  } catch (error) {
    console.error("[Al-Madina menu] load failed", error);
    const apiRouteProblem = ["non_json_api_response", "invalid_json_api_response"].includes(error.code);
    if (errorMessage) errorMessage.textContent = apiRouteProblem
      ? "The menu connection returned a webpage instead of menu data. Check the Vercel /api rewrite and deployment access settings."
      : "We couldn’t connect to the menu right now. Please try again.";
    if (viewFullMenu) viewFullMenu.hidden = true;
    const empty = Object.assign(document.createElement("p"), { className: "featured-dishes-empty", textContent: apiRouteProblem ? "The menu API returned a webpage instead of menu data." : "We’re having trouble loading the menu right now." });
    const retry = Object.assign(document.createElement("button"), { className: "menu-load-retry", type: "button", textContent: "Retry menu" });
    retry.addEventListener("click", loadRestaurants, { once: true });
    featuredDishesTrack?.replaceChildren(empty, retry);
  } finally {
    restaurantsLoading = false;
  }
}
searchForm?.addEventListener("submit", event => { event.preventDefault(); renderMenuPreview(); document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
searchInput?.addEventListener("input", renderMenuPreview);
quickFoodFilters.forEach(button => button.addEventListener("click", () => {
  selectedFoodFilter = button.dataset.quickFood;
  selectedCuisineFilter = "all";
  renderCategoryCarousel();
  renderMenuPreview();
}));
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
