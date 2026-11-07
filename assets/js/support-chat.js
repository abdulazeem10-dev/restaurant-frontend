(() => {
  "use strict";
  if (document.getElementById("support-chat-launcher")) return;

  const log = (...args) => console.info("[Support chat]", ...args);
  const launcher = document.createElement("button");
  launcher.id = "support-chat-launcher";
  launcher.className = "support-chat-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Ask Al-Madina AI");
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "support-chat-panel");
  launcher.textContent = "Ask Al-Madina AI";

  const panel = document.createElement("section");
  panel.id = "support-chat-panel";
  panel.className = "support-chat-panel";
  panel.setAttribute("aria-label", "Al-Madina AI chat");
  panel.hidden = true;
  panel.innerHTML = '<header class="support-chat-header"><div><h2>Al-Madina AI</h2><p>Ask about our menu and restaurant</p></div><button class="support-chat-close" type="button" aria-label="Close Al-Madina AI chat">×</button></header><div class="support-chat-messages" id="support-chat-messages" role="log" aria-live="polite" aria-relevant="additions text"></div><form class="support-chat-form"><label class="visually-hidden" for="support-chat-input">Your question</label><textarea id="support-chat-input" maxlength="500" rows="2" placeholder="Type your question…" required></textarea><button type="submit">Send</button></form><p class="support-chat-note">Do not share passwords, OTPs, or payment details. For order status, open My Orders.</p>';
  document.body.append(launcher, panel);

  const close = panel.querySelector(".support-chat-close");
  const form = panel.querySelector("form");
  const input = panel.querySelector("textarea");
  const messages = panel.querySelector(".support-chat-messages");
  const sendButton = form.querySelector("button[type=submit]");
  const history = [];
  let waiting = false;

  function addMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `support-chat-message ${role === "assistant" ? "is-assistant" : "is-user"}`;
    bubble.textContent = text;
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }
  function openChat() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    if (!messages.childElementCount) addMessage("assistant", "Hello! I can help with Al-Madina’s menu and general restaurant questions. For a specific order, please use My Orders.");
    input.focus();
  }
  function closeChat() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", () => panel.hidden ? openChat() : closeChat());
  close.addEventListener("click", closeChat);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) closeChat(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || waiting) return;
    addMessage("user", message);
    history.push({ role: "user", content: message });
    input.value = "";
    waiting = true;
    sendButton.disabled = true;
    const pending = addMessage("assistant", "Checking that for you…");
    try {
      const response = await apiFetch("/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message, history: history.slice(0, -1).slice(-6) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Support request failed (${response.status})`);
      pending.textContent = data.answer || "I couldn’t find an answer just now. Please contact Al-Madina directly.";
      history.push({ role: "assistant", content: pending.textContent });
      history.splice(0, Math.max(0, history.length - 6));
      log("POST /support/chat →", response.status);
    } catch (error) {
      pending.textContent = error.message.includes("temporarily unavailable")
        ? error.message
        : "I couldn’t connect just now. Please try again, or visit My Orders for order help.";
      log("POST /support/chat failed", error.message);
    } finally {
      waiting = false;
      sendButton.disabled = false;
      input.focus();
    }
  });
  log("initialized");
})();
