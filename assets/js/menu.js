const restaurantId = new URLSearchParams(location.search).get("id");
const RESTAURANT_BRAND = "Al-Madina";
const menuRoot = document.querySelector("#menu-items");
const categoryRoot = document.querySelector("#category-nav");
const menuFoodButtons = [...document.querySelectorAll("[data-menu-food]")];
const menuCategorySelect = document.querySelector("#menu-category-filter");
let currentRestaurant = null;
let allMenuItems = [];
let selectedMenuFood = "all";
const menuCategoryPatterns = Object.freeze({
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
const menuCategoryAliases = Object.freeze({
  northindian: "north-indian", southindian: "south-indian", "indo-chinese": "chinese",
  pizzas: "pizza", dessert: "desserts", sweets: "desserts", burgers: "burger", "fast-food": "burger",
  biriyani: "biryani", noodle: "noodles", roll: "rolls", "vada-pav": "vada", dosas: "dosa",
  momos: "momo", salad: "salads", miscellaneous: "other", misc: "other"
});

function formatTodayHours(openingHours) {
  if (!openingHours) return "Today's hours aren't listed.";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }).format(new Date()).toLowerCase();
  const hours = openingHours[day];
  if (!hours || hours.closed) return "Closed today.";
  const formatTime = value => {
    const [hour, minute] = value.split(":").map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  };
  return `Today's hours: ${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)} IST`;
}

function renderFilteredMenu() {
  if (!currentRestaurant) return;
  const categoryFilter = menuCategorySelect?.value || "all";
  menuFoodButtons.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.menuFood === selectedMenuFood));
  });
  const filtered = allMenuItems.filter(item => {
    const foodMatches = selectedMenuFood === "all" || item.foodType === selectedMenuFood;
    if (!foodMatches || categoryFilter === "all") return foodMatches;
    const text = [item.name, item.category, item.description].filter(Boolean).join(" ").toLocaleLowerCase();
    const category = String(item.category || "").trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const mappedCategory = menuCategoryAliases[category] || category;
    const categoryKnown = Boolean(menuCategoryPatterns[mappedCategory]);
    if (categoryFilter === "other") {
      return mappedCategory === "other" || (!categoryKnown && !Object.values(menuCategoryPatterns).some(pattern => pattern.test(text)));
    }
    if (mappedCategory === categoryFilter) return true;
    if (categoryKnown) {
      if (categoryFilter === "dosa" && mappedCategory === "south-indian") return menuCategoryPatterns.dosa.test(text);
      if (categoryFilter === "vada" && ["south-indian", "maharashtrian"].includes(mappedCategory)) return menuCategoryPatterns.vada.test(text);
      return false;
    }
    return Boolean(menuCategoryPatterns[categoryFilter]?.test(text));
  });
  renderMenu(filtered, currentRestaurant, selectedMenuFood, categoryFilter);
}

function updateStoreCart() {
  const cart = readCart();
  const summary = document.querySelector("#cart-summary");
  if (!cart?.items?.length) { summary.textContent = "Your cart is empty"; return; }
  const quantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  summary.textContent = `${quantity} ${quantity === 1 ? "item" : "items"} · ${formatRupees(total)}`;
}

function renderReviews(data) {
  const summary = document.querySelector("#review-summary");
  const root = document.querySelector("#restaurant-reviews");
  const count = Number(data.ratingCount) || 0;
  summary.textContent = count ? `★ ${Number(data.ratingAverage).toFixed(1)} · ${count} ${count === 1 ? "review" : "reviews"}` : "No reviews yet";
  root.replaceChildren();
  if (!data.reviews?.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Reviews from customers will appear here.";
    root.append(empty);
    return;
  }
  for (const review of data.reviews) {
    const card = document.createElement("article");
    card.className = "review-card";
    const top = document.createElement("div");
    top.className = "review-card-top";
    const name = document.createElement("strong");
    name.textContent = review.customerName;
    const rating = document.createElement("span");
    rating.className = "review-stars";
    rating.setAttribute("aria-label", `${review.rating} out of 5 stars`);
    rating.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`;
    top.append(name, rating);
    card.append(top);
    if (review.comment) {
      const comment = document.createElement("p");
      comment.textContent = review.comment;
      card.append(comment);
    }
    const date = document.createElement("small");
    date.className = "muted";
    date.textContent = new Date(review.createdAt).toLocaleDateString("en-IN");
    card.append(date);
    root.append(card);
  }
}

async function loadReviews() {
  const summary = document.querySelector("#review-summary");
  try {
    const response = await fetch(`${API_BASE}/reviews/restaurant/${encodeURIComponent(restaurantId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load reviews");
    renderReviews(data);
  } catch {
    summary.textContent = "Reviews are temporarily unavailable.";
    document.querySelector("#restaurant-reviews").replaceChildren();
  }
}

function addMenuItem(item, button) {
  let cart = readCart();
  if (cart && cart.restaurantId !== restaurantId) {
    if (!confirm("Your cart has dishes from a different menu. Clear it and start this order?")) return;
    cart = null;
  }
  cart ||= { restaurantId, restaurantName: currentRestaurant.name, items: [] };
  const line = cart.items.find(value => value.menuItemId === item._id);
  if (line?.quantity >= 20) {
    setStatusMessage(document.querySelector("#cart-feedback"), `You’ve reached the 20-item limit for ${item.name}.`, "info");
    return;
  }
  if (line) line.quantity += 1;
  else cart.items.push({ menuItemId: item._id, name: item.name, pricePaise: item.pricePaise, quantity: 1 });
  writeCart(cart);
  updateStoreCart();
  setStatusMessage(document.querySelector("#cart-feedback"), `${item.name} added to your order.`, "success");
  if (button) {
    clearTimeout(button.feedbackTimer);
    button.classList.add("is-added");
    button.textContent = "Added ✓";
    button.setAttribute("aria-label", `${item.name} added to your order`);
    button.feedbackTimer = setTimeout(() => {
      button.classList.remove("is-added");
      button.textContent = "+ Add";
      button.setAttribute("aria-label", `Add ${item.name}`);
    }, 1400);
  }
}

function renderMenu(items, restaurant, filter = "all", categoryFilter = "all") {
  const groups = new Map();
  for (const item of items) {
    const category = item.category || "Menu";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  categoryRoot.replaceChildren();
  menuRoot.replaceChildren();
  for (const [index, [category, entries]] of [...groups.entries()].entries()) {
    const sectionId = `category-${index}`;
    const categoryLink = document.createElement("a");
    categoryLink.href = `#${sectionId}`;
    categoryLink.textContent = category;
    categoryRoot.append(categoryLink);

    const section = document.createElement("section");
    section.className = "menu-category";
    section.id = sectionId;
    const heading = document.createElement("h3");
    heading.textContent = category;
    const count = document.createElement("span");
    count.className = "muted";
    count.textContent = `${entries.length} items`;
    const categoryHeading = document.createElement("div");
    categoryHeading.className = "category-heading";
    categoryHeading.append(heading, count);
    section.append(categoryHeading);

    for (const item of entries) {
      const row = document.createElement("article");
      row.className = "menu-item-card";
      const info = document.createElement("div");
      info.className = "menu-item-info";
      if (item.imageUrl) {
        const image = document.createElement("img");
        image.src = item.imageUrl;
        image.alt = item.name;
        image.loading = "lazy";
        image.className = "dish-image";
        image.addEventListener("error", () => image.remove(), { once: true });
        row.append(image);
      }
      const title = document.createElement("h4");
      title.textContent = item.name;
      const typeBadge = document.createElement("span");
      typeBadge.className = `dish-type-badge ${item.foodType === "veg" ? "dish-type-veg" : "dish-type-nonveg"}`;
      typeBadge.textContent = item.foodType === "veg" ? "Veg" : "Non-Veg";
      const price = document.createElement("strong");
      price.textContent = formatRupees(item.pricePaise);
      const description = document.createElement("p");
      description.className = "muted";
      description.textContent = item.description || "Prepared fresh at Al-Madina.";
      info.append(title);
      if (item.foodType === "veg" || item.foodType === "nonVeg") info.append(typeBadge);
      info.append(price, description);
      const action = document.createElement("button");
      action.type = "button";
      action.className = "add-item-button";
      action.textContent = restaurant.isOpen ? "+ Add" : "Closed";
      action.disabled = !restaurant.isOpen;
      action.setAttribute("aria-label", `${restaurant.isOpen ? "Add" : "Unavailable"} ${item.name}`);
      action.addEventListener("click", () => addMenuItem(item, action));
      row.append(info, action);
      section.append(row);
    }
    menuRoot.append(section);
  }
  if (!items.length) {
    const hasFilter = filter !== "all" || categoryFilter !== "all";
    const emptyTitle = hasFilter ? "No dishes match these filters" : "Menu coming soon";
    const emptyMessage = hasFilter ? "Try another food filter or check back later." : "Al-Madina has no available dishes listed yet.";
    menuRoot.innerHTML = `<div class="empty-state"><h3>${emptyTitle}</h3><p>${emptyMessage}</p></div>`;
  }
}

async function loadStorefront() {
  const error = document.querySelector("#error");
  const storefrontHero = document.querySelector(".storefront-hero");
  if (!restaurantId) {
    error.textContent = "Open the Al-Madina menu from the home page.";
    document.querySelector("#restaurant-name").textContent = "Al-Madina";
    storefrontHero.setAttribute("aria-busy", "false");
    return;
  }
  try {
    const [restaurantResponse, menuResponse] = await Promise.all([
      fetch(`${API_BASE}/restaurants/${encodeURIComponent(restaurantId)}`),
      fetch(`${API_BASE}/restaurants/${encodeURIComponent(restaurantId)}/menu`)
    ]);
    if (!restaurantResponse.ok || !menuResponse.ok) throw new Error("Al-Madina is not available right now.");
    const { restaurant: restaurantData } = await restaurantResponse.json();
    const restaurant = { ...restaurantData, name: RESTAURANT_BRAND };
    const { items } = await menuResponse.json();
    currentRestaurant = restaurant;
    document.title = `${restaurant.name} menu | Al-Madina`;
    document.querySelector("#restaurant-name").textContent = restaurant.name;
    document.querySelector("#crumb-name").textContent = restaurant.name;
    document.querySelector("#restaurant-description").textContent = "Freshly prepared veg and non-veg favourites from Al-Madina.";
    document.querySelector("#restaurant-address").textContent = "Ulwe, Navi Mumbai";
    const status = document.querySelector("#restaurant-status");
    status.textContent = restaurant.isOpen ? "Open for orders" : "Currently closed";
    status.classList.toggle("closed-badge", !restaurant.isOpen);
    document.querySelector("#restaurant-hours").textContent = formatTodayHours(restaurant.openingHours);
    document.querySelector("#restaurant-delivery-area").hidden = true;
    storefrontHero.setAttribute("aria-busy", "false");
    allMenuItems = items;
    renderFilteredMenu();
    updateStoreCart();
    await loadReviews();
  } catch (errorValue) {
    const message = errorValue.message || "Could not load this restaurant.";
    error.textContent = message;
    document.querySelector("#restaurant-name").textContent = "Restaurant unavailable";
    document.querySelector("#restaurant-description").textContent = message;
    storefrontHero.setAttribute("aria-busy", "false");
  }
}

menuFoodButtons.forEach(button => button.addEventListener("click", () => {
  selectedMenuFood = button.dataset.menuFood;
  renderFilteredMenu();
}));
menuCategorySelect?.addEventListener("change", renderFilteredMenu);
loadStorefront();
