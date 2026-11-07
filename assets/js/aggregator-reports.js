(() => {
  const importForm = document.querySelector("#aggregator-import-form");
  const reportForm = document.querySelector("#aggregator-report-filter");
  if (!importForm || !reportForm) return;
  const importMessage = document.querySelector("#aggregator-import-message");
  const summaryRoot = document.querySelector("#aggregator-report-summary");
  const detailsRoot = document.querySelector("#aggregator-report-details");

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted && char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i += 1;
        row.push(field.trim()); field = "";
        if (row.some(Boolean)) rows.push(row);
        row = [];
      } else field += char;
    }
    if (quoted) throw new Error("CSV contains an unclosed quote.");
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows.length < 2) throw new Error("CSV has no order rows.");
    const headers = rows.shift().map(value => value.replace(/^\uFEFF/, "").toLowerCase());
    const expected = ["orderid", "date", "status", "gross", "commission", "payout"];
    if (expected.some(header => !headers.includes(header))) throw new Error(`CSV headers must include: ${expected.join(", ")}. Download the template if needed.`);
    return rows.map(cells => {
      const value = key => cells[headers.indexOf(key)] || "";
      return { orderId: value("orderid"), date: value("date"), status: value("status"), gross: Number(value("gross")), commission: Number(value("commission")), payout: Number(value("payout")) };
    });
  }

  importForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = importForm.querySelector("button[type=submit]");
    const file = importForm.elements.file.files[0];
    if (!file || file.size > 1_000_000) { importMessage.textContent = "Choose a CSV file smaller than 1 MB."; return; }
    button.disabled = true;
    try {
      const rows = parseCsv(await file.text());
      if (rows.length > 500) throw new Error("Import up to 500 rows at a time.");
      const result = await apiFetch("/restaurants/owner/aggregator-reports/import", { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ platform: importForm.elements.platform.value, rows }) });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || `Import failed (${result.status})`);
      console.info(`[API] POST /restaurants/owner/aggregator-reports/import → ${result.status}`, { imported: data.imported, platform: data.platform });
      importMessage.textContent = `Imported ${data.imported} ${data.platform} order rows (${data.inserted} new, ${data.updated} updated).`;
      await loadAggregatorReport();
    } catch (error) { importMessage.textContent = error.message; console.error("[aggregator-reports] import failed", error); }
    finally { button.disabled = false; }
  });

  function makeMetric(label, value) {
    const card = document.createElement("article"); card.className = "report-metric";
    const title = document.createElement("span"); title.textContent = label;
    const strong = document.createElement("strong"); strong.textContent = value;
    card.append(title, strong); return card;
  }
  async function loadAggregatorReport() {
    const params = new URLSearchParams({ from: reportForm.elements.from.value, to: reportForm.elements.to.value });
    try {
      const response = await apiFetch(`/restaurants/owner/aggregator-reports?${params}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Report failed (${response.status})`);
      console.info(`[API] GET /restaurants/owner/aggregator-reports → ${response.status}`);
      summaryRoot.replaceChildren();
      const rows = data.platforms || [];
      const totals = rows.reduce((sum, entry) => ({ orders: sum.orders + entry.orders, gross: sum.gross + entry.grossPaise, commission: sum.commission + entry.commissionPaise, payout: sum.payout + entry.payoutPaise }), { orders: 0, gross: 0, commission: 0, payout: 0 });
      summaryRoot.append(makeMetric("Aggregator orders", String(totals.orders)), makeMetric("Gross sales", formatRupees(totals.gross)), makeMetric("Commission", formatRupees(totals.commission)), makeMetric("Net payout", formatRupees(totals.payout)));
      detailsRoot.replaceChildren();
      if (!rows.length) { detailsRoot.textContent = "No uploaded aggregator sales for this date range."; return; }
      const table = document.createElement("table"); table.className = "data-table";
      table.innerHTML = "<thead><tr><th>Platform</th><th>Orders</th><th>Gross sales</th><th>Commission</th><th>Net payout</th></tr></thead>";
      const body = document.createElement("tbody");
      for (const entry of rows) { const tr = document.createElement("tr"); [entry._id, entry.orders, formatRupees(entry.grossPaise), formatRupees(entry.commissionPaise), formatRupees(entry.payoutPaise)].forEach(value => { const td = document.createElement("td"); td.textContent = String(value); tr.append(td); }); body.append(tr); }
      table.append(body); detailsRoot.append(table);
    } catch (error) { summaryRoot.replaceChildren(); detailsRoot.textContent = error.message; console.error("[aggregator-reports] report load failed", error); }
  }
  function setDateDefaults() {
    if (reportForm.elements.from.value) return;
    const today = new Date(); const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
    reportForm.elements.to.value = today.toISOString().slice(0, 10);
    reportForm.elements.from.value = weekAgo.toISOString().slice(0, 10);
  }
  reportForm.addEventListener("submit", event => { event.preventDefault(); loadAggregatorReport(); });
  setDateDefaults();
  loadAggregatorReport();
})();
