const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const window = {};
vm.runInNewContext(readFileSync(join(__dirname, "../assets/js/dish-images.js"), "utf8"), {
  window,
  location: { origin: "https://example.test" },
  console
});

test("food type normalization accepts current and legacy menu labels", () => {
  const normalize = window.foodwayNormalizeFoodType;
  assert.equal(normalize("veg"), "veg");
  assert.equal(normalize("Vegetarian"), "veg");
  assert.equal(normalize("Non-Veg"), "nonVeg");
  assert.equal(normalize("Non‑Veg"), "nonVeg");
  assert.equal(normalize("non veg"), "nonVeg");
  assert.equal(normalize("non_veg"), "nonVeg");
  assert.equal(normalize("unknown"), "");
});

test("veg and non-veg carousel filters return only matching dishes", () => {
  const dishes = [
    { name: "Paneer", foodType: "Veg" },
    { name: "Chicken", foodType: "Non-Veg" },
    { name: "Rice", foodType: "veg" },
    { name: "Legacy unknown", foodType: "" }
  ];
  const filter = window.foodwayFilterMenuItemsByFoodType;
  assert.deepEqual(filter(dishes, "veg").map(item => item.name), ["Paneer", "Rice"]);
  assert.deepEqual(filter(dishes, "nonVeg").map(item => item.name), ["Chicken"]);
  assert.equal(filter(dishes, "all").length, dishes.length);
});
