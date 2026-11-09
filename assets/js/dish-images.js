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

  window.foodwayDishImage = dishImage;
  console.info("[dish images] Local representative food photos ready");
})();
