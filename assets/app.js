const API = (window.FOODWAY_API_BASE || ((location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "http://127.0.0.1:5100/api" : "https://foodway-restaurant-app.vercel.app/api"));
const grid = document.querySelector("#menu-grid");
let filter = "all";
const money = paise => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((paise || 0) / 100);
const safe = value => { const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML; };

async function load() {
  try {
    const response = await fetch(API + "/public/restaurant?foodType=" + (filter === "all" ? "" : filter));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load menu");
    document.querySelector("#restaurant-name").textContent = data.restaurant.name;
    document.querySelector("#brand-name").textContent = data.restaurant.name;
    document.querySelector("#footer-name").textContent = data.restaurant.name;
    document.querySelector("#restaurant-description").textContent = data.restaurant.description || "";
    document.querySelector("#restaurant-address").textContent = data.restaurant.address;
    document.querySelector("#hero-cuisine").textContent = data.restaurant.cuisine || "Local menu";
    document.querySelector("#hero-status").textContent = data.restaurant.isOpen ? "Accepting orders now" : "Currently closed";
    grid.replaceChildren(...data.menu.map(item => {
      const card = document.createElement("article");
      card.className = "menu-card";
      card.innerHTML = (item.imageUrl ? "<img src='" + safe(item.imageUrl) + "' alt='" + safe(item.name) + "'>" : "<div class='placeholder'></div>") +
        "<div class='menu-body'><h3>" + safe(item.name) + "</h3><p>" + safe(item.description || "Freshly prepared in our kitchen.") +
        "</p><div class='menu-meta'><span class='price'>" + money(item.pricePaise) + "</span><span class='badge " +
        (item.foodType === "nonVeg" ? "nonveg" : "") + "'>" + (item.foodType === "nonVeg" ? "Non-veg" : "Veg") + "</span></div></div>";
      return card;
    }));
  } catch (error) {
    grid.innerHTML = "<p class='empty'>" + safe(error.message) + "</p>";
  }
}
document.querySelectorAll("[data-food]").forEach(button => button.addEventListener("click", () => {
  filter = button.dataset.food;
  document.querySelectorAll("[data-food]").forEach(item => item.classList.toggle("active", item === button));
  load();
}));
load();

