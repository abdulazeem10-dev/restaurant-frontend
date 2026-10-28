const brandName = "Al-Madina";
const searchForm = document.querySelector("#restaurant-search");
const searchInput = document.querySelector("#search-input");
const quickFoodFilters = [...document.querySelectorAll("[data-quick-food]")];
const budgetFilters = [...document.querySelectorAll("[data-budget-filter]")];
const cuisineFilters = [...document.querySelectorAll("[data-cuisine-filter]")];
const cuisineTrack = document.querySelector("#cuisine-track");
const featuredSection = document.querySelector("#restaurant-listing");
const featuredDishesTrack = document.querySelector("#featured-dishes-track");
const viewFullMenu = document.querySelector("#view-full-menu");
const errorMessage = document.querySelector("#error");
const cuisineLabels = Object.freeze({
  "north-indian": "North Indian", "south-indian": "South Indian", maharashtrian: "Maharashtrian",
  chinese: "Chinese", pizza: "Pizza", desserts: "Desserts", burger: "Burger", biryani: "Biryani",
  noodles: "Noodles", rolls: "Rolls", shawarma: "Shawarma", vada: "Vada", dosa: "Dosa", momo: "Momos", salads: "Salads"
});
const cuisinePatterns = Object.freeze({
  "north-indian": /\b(north.?indian|paratha|puri|chole|paneer|naan|kulcha|kebab|tikka|korma)\b/i,
  "south-indian": /\b(south.?indian|dosa|idli|sambar|sambhar|uttapam|upma|medu.?vada|rasam)\b/i,
  maharashtrian: /\b(maharashtrian|vada.?pav|puran.?poli|misal|poha|sabudana|thalipeeth)\b/i,
  chinese: /\b(chinese|manchurian|schezwan|chow.?mein|fried.?rice|spring.?roll|hakka|chilli.?chicken)\b/i,
  pizza: /\b(pizza|calzone|garlic.?bread)\b/i,
  desserts: /\b(dessert|sweet|ice.?cream|gulab.?jamun|ras.?malai|cake|brownie|kulfi|halwa|kheer)\b/i,
  burger: /\b(burger|fries|fast.?food)\b/i,
  biryani: /\bbiryani\b/i,
  noodles: /\b(noodles?|chow.?mein|hakka|ramen)\b/i,
  rolls: /\b(rolls?|wraps?|frankie|sandwich)\b/i,
  shawarma: /\bshawarma\b/i,
  vada: /\b(vada|pakora|bhaji)\b/i,
  dosa: /\b(dosa|uttapam)\b/i,
  momo: /\bmomos?\b/i,
  salads: /\b(salad|raita)\b/i
});
const categoryCuisine = Object.freeze({
  "north-indian": "north-indian", northindian: "north-indian",
  "south-indian": "south-indian", southindian: "south-indian",
  maharashtrian: "maharashtrian", chinese: "chinese", "indo-chinese": "chinese",
  pizza: "pizza", pizzas: "pizza", dessert: "desserts", desserts: "desserts", sweets: "desserts",
  burger: "burger", burgers: "burger", "fast-food": "burger",
  biryani: "biryani", biriyani: "biryani", noodle: "noodles", noodles: "noodles",
  roll: "rolls", rolls: "rolls", shawarma: "shawarma", vada: "vada", "vada-pav": "vada",
  dosa: "dosa", dosas: "dosa", momo: "momo", momos: "momo", salad: "salads", salads: "salads"
});
let currentRestaurant = null;
let allMenuItems = [];
let selectedFoodFilter = "all";
let selectedBudgetFilter = "all";
let selectedCuisineFilter = "all";

function getVisibleDishes() {
  const term = searchInput.value.trim().toLocaleLowerCase();
  const maxPricePaise = selectedBudgetFilter === "all" ? Infinity : Number(selectedBudgetFilter) * 100;
  return allMenuItems.filter(item => {
    const text = [item.name, item.description].filter(Boolean).join(" ").toLocaleLowerCase();
    const pattern = cuisinePatterns[selectedCuisineFilter];
    const category = String(item.category || "").trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const categoryFilter = categoryCuisine[category];
    const matchesCuisine = !pattern || (categoryFilter ? categoryFilter === selectedCuisineFilter : pattern.test(text));
    return (!term || text.includes(term))
      && (selectedFoodFilter === "all" || item.foodType === selectedFoodFilter)
      && Number(item.pricePaise) <= maxPricePaise
      && matchesCuisine;
  });
}
function cuisineImageFor(item) {
  const category = String(item.category || "").toLocaleLowerCase();
  if (/chinese|noodle/.test(category)) return "../assets/images/cuisines/chinese.webp";
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
  cuisineFilters.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.cuisineFilter === selectedCuisineFilter)));
  featuredSection.hidden = !currentRestaurant;
  if (viewFullMenu) { viewFullMenu.hidden = !currentRestaurant; if (currentRestaurant) viewFullMenu.href = `menu.html?id=${encodeURIComponent(currentRestaurant._id)}`; }
  featuredDishesTrack.replaceChildren();
  if (!currentRestaurant) return;
  if (!dishes.length) {
    const empty = document.createElement("p"); empty.className = "featured-dishes-empty";
    empty.textContent = allMenuItems.length ? "No dishes match these filters. Try another cuisine or clear your search." : "The Al-Madina menu is being updated. Please check back soon.";
    featuredDishesTrack.append(empty); return;
  }
  for (const item of dishes) {
    const card = document.createElement("a"); card.className = "featured-dish-card";
    card.href = `menu.html?id=${encodeURIComponent(currentRestaurant._id)}`;
    card.setAttribute("aria-label", `View ${item.name} from ${brandName}, ${formatRupees(item.pricePaise)}`);
    const imageWrap = document.createElement("div"); imageWrap.className = "featured-dish-image-wrap";
    const image = document.createElement("img"); image.src = item.imageUrl || cuisineImageFor(item); image.alt = item.imageUrl ? item.name : "";
    image.loading = "lazy"; image.decoding = "async"; image.addEventListener("error", () => image.remove(), { once: true }); imageWrap.append(image);
    const details = document.createElement("div"); details.className = "featured-dish-details";
    const name = document.createElement("h3"); name.textContent = item.name;
    const price = document.createElement("strong"); price.textContent = formatRupees(item.pricePaise);
    const restaurant = document.createElement("span"); restaurant.textContent = brandName;
    const type = document.createElement("small"); type.className = item.foodType === "veg" ? "dish-food-type dish-food-type-veg" : "dish-food-type dish-food-type-nonveg";
    type.textContent = item.foodType === "veg" ? "Veg" : item.foodType === "nonVeg" ? "Non-Veg" : item.category || "Food";
    details.append(name, price, restaurant, type); card.append(imageWrap, details); featuredDishesTrack.append(card);
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
    const fallbackImage = cuisineImageFor(menuDish || { category: firstDish?.category || firstDish?.name });
    const image = document.createElement("img"); image.className = "recent-order-image"; image.src = menuDish?.imageUrl || firstDish?.imageUrl || fallbackImage;
    image.alt = firstDish?.name ? `${firstDish.name} dish` : "Al-Madina dish"; image.loading = "lazy"; image.decoding = "async";
    image.addEventListener("error", () => { if (image.dataset.fallbackApplied) image.remove(); else { image.dataset.fallbackApplied = "true"; image.src = fallbackImage; } });
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
    if (response.status === 401) { sessionStorage.removeItem(TOKEN_KEY); return; }
    if (!response.ok) return;
    const { user } = await response.json();
    const destinations = { admin: ["../admin/dashboard.html", "Admin dashboard"], restaurant: ["../restaurant/dashboard.html", "Restaurant dashboard"], restaurant_staff: ["../restaurant/staff-dashboard.html", "Restaurant staff dashboard"], delivery: ["../delivery/dashboard.html", "Delivery dashboard"] };
    const destination = destinations[user?.role], dashboardLink = document.querySelector("#dashboard-link");
    if (destination && dashboardLink) { dashboardLink.href = destination[0]; dashboardLink.textContent = destination[1]; dashboardLink.hidden = false; }
    const loginLink = document.querySelector(".login-link"); if (loginLink) loginLink.hidden = true;
    const mobileAccountLink = document.querySelector("#mobile-account-link"); if (mobileAccountLink) mobileAccountLink.href = destination?.[0] || "orders.html";
    const logout = document.querySelector("#home-logout");
    if (logout) { logout.hidden = false; logout.addEventListener("click", () => { sessionStorage.removeItem(TOKEN_KEY); location.href = "index.html"; }, { once: true }); }
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
    currentRestaurant = approved.find(restaurant => /^al-madina$/i.test(String(restaurant.name || "").trim())) || null;
    if (!currentRestaurant) {
      throw new Error("No approved Al-Madina account was found. In Platform Admin → Restaurants, set the existing restaurant name to “Al-Madina” and make sure its status is Approved. This customer site shows Al-Madina only.");
    }
    const menuResponse = await fetch(`${API_BASE}/restaurants/${encodeURIComponent(currentRestaurant._id)}/menu`);
    console.info(`[Al-Madina menu] GET /restaurants/${currentRestaurant._id}/menu → ${menuResponse.status}`);
    if (!menuResponse.ok) throw new Error("Could not load Al-Madina dishes");
    allMenuItems = (await menuResponse.json()).items || [];
    renderMenuPreview(); await loadRecentOrders();
  } catch (error) {
    console.error("[Al-Madina menu] load failed", error);
    if (errorMessage) errorMessage.textContent = error.message || "The Al-Madina menu could not be loaded.";
    if (viewFullMenu) viewFullMenu.hidden = true;
    featuredDishesTrack?.replaceChildren(Object.assign(document.createElement("p"), { className: "featured-dishes-empty", textContent: "The Al-Madina menu is not available yet." }));
  }
}
searchForm?.addEventListener("submit", event => { event.preventDefault(); renderMenuPreview(); document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
searchInput?.addEventListener("input", renderMenuPreview);
quickFoodFilters.forEach(button => button.addEventListener("click", () => { selectedFoodFilter = button.dataset.quickFood; renderMenuPreview(); }));
budgetFilters.forEach(button => button.addEventListener("click", () => { selectedBudgetFilter = button.dataset.budgetFilter; renderMenuPreview(); document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
cuisineFilters.forEach(button => button.addEventListener("click", () => { selectedCuisineFilter = button.dataset.cuisineFilter; renderMenuPreview(); document.querySelector("#restaurant-listing")?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
document.querySelector("#cuisine-scroll-left")?.addEventListener("click", () => cuisineTrack.scrollBy({ left: -Math.max(280, cuisineTrack.clientWidth * .75), behavior: "smooth" }));
document.querySelector("#cuisine-scroll-right")?.addEventListener("click", () => cuisineTrack.scrollBy({ left: Math.max(280, cuisineTrack.clientWidth * .75), behavior: "smooth" }));
document.querySelector("#food-scroll-left")?.addEventListener("click", () => featuredDishesTrack.scrollBy({ left: -Math.max(260, featuredDishesTrack.clientWidth * .75), behavior: "smooth" }));
document.querySelector("#food-scroll-right")?.addEventListener("click", () => featuredDishesTrack.scrollBy({ left: Math.max(260, featuredDishesTrack.clientWidth * .75), behavior: "smooth" }));
renderFoodPassport();
loadRestaurants();
setupHomeAccountNav();
