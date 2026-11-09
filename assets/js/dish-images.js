/* Local representative food photos used when a menu item has no custom image.
   The image library is recorded in assets/images/cuisines/SOURCES.md. */
(() => {
  const imageByPattern = [
    [/dessert|sweet|gulab|ice cream|brownie|cake|kheer|falooda/i, "desserts.webp"],
    [/chinese|manchurian|noodle|schezwan|szechuan|hakka|chilly|chilli/i, "chinese.webp"],
    [/biryani|kepsa|rice|pulao|pulav|fried rice/i, "biryani.webp"],
    [/pizza/i, "pizza.webp"],
    [/burger|fries|papad/i, "burger.webp"],
    [/momo|momos/i, "momo.webp"],
    [/shawarma|roll|wrap/i, "rolls.webp"],
    [/salad|raita/i, "salads.webp"],
    [/dosa|idli|uttapam|upma|sambar|vada|medu/i, "south-indian.webp"],
    [/maharashtrian|poha|pav|puran poli|misal/i, "other.webp"],
    [/tandoori|tikka|kebab|kabab|kolhapuri|mughlai|paneer|chicken|mutton|fish|prawn|egg|thali|roti|naan|gravy|soup|starter/i, "north-indian.webp"]
  ];

  function dishImage(item = {}) {
    if (item.imageUrl) return { src: item.imageUrl, isFallback: false };
    const text = `${item.name || ""} ${item.category || ""}`;
    const match = imageByPattern.find(([pattern]) => pattern.test(text));
    const filename = match?.[1] || "all.webp";
    return { src: `${location.origin}/assets/images/cuisines/${filename}`, isFallback: true };
  }

  function baseDishName(name = "") {
    return String(name).replace(/\s+\((?:half|full)\)$/i, "").trim();
  }

  function menuCategoryFor(item = {}) {
    const sourceCategory = String(item.category || "Menu").trim();
    const category = sourceCategory.toLocaleLowerCase();
    const name = String(item.name || "").toLocaleLowerCase();
    if (category.includes("chinese") || /\bchinese\b/.test(name)) {
      if (/soup/.test(category) || /soup/.test(name)) return "Soup";
      if (/noodle/.test(category) || /noodle/.test(name)) return "Chinese Noodles";
      if (/rice/.test(category) || /rice/.test(name)) return "Chinese Rice";
      if (/starter/.test(category)) return "Chinese Starters";
      return "Chinese";
    }
    return sourceCategory;
  }

  function groupMenuItems(items = []) {
    const groups = new Map();
    for (const item of items) {
      const name = baseDishName(item.name);
      const key = `${String(item.category || "Menu").trim().toLocaleLowerCase()}\u0000${name.toLocaleLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { name, category: item.category || "Menu", variants: [] });
      groups.get(key).variants.push(item);
    }
    return [...groups.values()].map(group => ({
      ...group,
      variants: group.variants.sort((a, b) => {
        const rank = item => /\s+\(half\)$/i.test(item.name) ? 0 : /\s+\(full\)$/i.test(item.name) ? 1 : 2;
        return rank(a) - rank(b) || a.pricePaise - b.pricePaise;
      })
    }));
  }

  window.foodwayDishImage = dishImage;
  window.foodwayBaseDishName = baseDishName;
  window.foodwayMenuCategoryFor = menuCategoryFor;
  window.foodwayGroupMenuItems = groupMenuItems;
  console.info("[dish images] Local representative food photos ready");
})();
