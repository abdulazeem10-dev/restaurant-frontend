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
  panel.innerHTML = '<header class="support-chat-header"><div><h2>Al-Madina AI</h2><p>Ask about our menu and restaurant</p></div><button class="support-chat-close" type="button" aria-label="Close Al-Madina AI chat">×</button></header><div class="support-chat-messages" id="support-chat-messages" role="log" aria-live="polite" aria-relevant="additions text"></div><form class="support-chat-form"><label class="visually-hidden" for="support-chat-input">Your question</label><textarea id="support-chat-input" maxlength="500" rows="2" placeholder="Type or speak your question…" required></textarea><div class="support-chat-actions"><button class="support-chat-mic" type="button" aria-label="Start voice input" aria-pressed="false" title="Ask by voice"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8"></path></svg></button><button type="submit">Send</button></div><span class="support-chat-voice-status" role="status" aria-live="polite"></span></form><p class="support-chat-note">Voice input uses your browser’s speech service. Do not share passwords, OTPs, or payment details. For order status, open My Orders.</p>';
  document.body.append(launcher, panel);

  const close = panel.querySelector(".support-chat-close");
  const form = panel.querySelector("form");
  const input = panel.querySelector("textarea");
  const messages = panel.querySelector(".support-chat-messages");
  const sendButton = form.querySelector("button[type=submit]");
  const micButton = panel.querySelector(".support-chat-mic");
  const voiceStatus = panel.querySelector(".support-chat-voice-status");
  const history = [];
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let voiceResponsePending = false;
  let waiting = false;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
      micButton.classList.add("is-listening");
      micButton.setAttribute("aria-pressed", "true");
      micButton.setAttribute("aria-label", "Stop voice input");
      voiceStatus.textContent = "Listening… speak your question.";
      log("voice input started");
    };
    recognition.onresult = event => {
      const transcript = [...event.results].map(result => result[0].transcript).join(" ").trim();
      if (!transcript) return;
      input.value = `${input.value.trim()} ${transcript}`.trim().slice(0, 500);
      voiceResponsePending = true;
      voiceStatus.textContent = "Question captured. Sending to Al-Madina AI…";
      log("voice question captured");
    };
    recognition.onerror = event => {
      voiceResponsePending = false;
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access is blocked. Allow microphone access in your browser settings."
        : event.error === "no-speech" ? "No speech detected. Tap the microphone and try again."
          : "Voice input had a problem. You can type your question instead.";
      voiceStatus.textContent = message;
      log("voice input failed", event.error);
    };
    recognition.onend = () => {
      micButton.classList.remove("is-listening");
      micButton.setAttribute("aria-pressed", "false");
      micButton.setAttribute("aria-label", "Start voice input");
      if (voiceResponsePending && input.value.trim()) form.requestSubmit();
      else if (voiceStatus.textContent === "Listening… speak your question.") voiceStatus.textContent = "";
    };
  }

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
    voiceResponsePending = false;
    recognition?.abort();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", () => panel.hidden ? openChat() : closeChat());
  close.addEventListener("click", closeChat);
  micButton.addEventListener("click", () => {
    if (!recognition) {
      voiceStatus.textContent = "Voice input is not supported in this browser. Please type your question.";
      log("voice input unavailable in this browser");
      return;
    }
    if (micButton.getAttribute("aria-pressed") === "true") recognition.stop();
    else {
      voiceStatus.textContent = "Allow microphone access if your browser asks.";
      try { recognition.start(); }
      catch (error) { voiceStatus.textContent = "Voice input is already starting. Please wait."; log("voice start error", error.message); }
    }
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) closeChat(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || waiting) return;
    voiceStatus.textContent = "";
    addMessage("user", message);
    history.push({ role: "user", content: message });
    input.value = "";
    waiting = true;
    sendButton.disabled = true;
    micButton.disabled = true;
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
      if (voiceResponsePending && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
        window.speechSynthesis.cancel();
        const spokenReply = new SpeechSynthesisUtterance(pending.textContent);
        spokenReply.lang = "en-IN";
        window.speechSynthesis.speak(spokenReply);
        log("speaking AI response");
      }
    } catch (error) {
      pending.textContent = error.message.includes("temporarily unavailable")
        ? error.message
        : "I couldn’t connect just now. Please try again, or visit My Orders for order help.";
      log("POST /support/chat failed", error.message);
    } finally {
      voiceResponsePending = false;
      waiting = false;
      sendButton.disabled = false;
      micButton.disabled = false;
      input.focus();
    }
  });
  log("initialized");
})();
