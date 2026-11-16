// Replace this value with the Google OAuth 2.0 Web Client ID from Google Cloud.
// The Client ID is public; never put a Google client secret in frontend code.
const GOOGLE_CLIENT_ID = "737614463218-ss96t6grusq61q75bb49mm8r1kmo6fpf.apps.googleusercontent.com";

function renderGoogleSignInButton() {
  const container = document.querySelector("#google-signin-button");
  if (!container) return;
  const divider = document.querySelector(".auth-divider");

  function showFallback(message) {
    container.classList.add("is-fallback");
    container.hidden = false;
    container.textContent = message;
  }

  if (GOOGLE_CLIENT_ID.startsWith("YOUR_")) {
    showFallback("Google sign-in is unavailable. Use email or phone instead.");
    return;
  }

  function initializeGoogleSignIn() {
    if (!window.google?.accounts?.id) {
      showFallback("Google sign-in is unavailable. Use email or phone instead.");
      return;
    }
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential
      });
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(320, Math.max(220, container.parentElement.clientWidth || 320))
      });
      container.classList.remove("is-fallback");
      container.hidden = false;
      if (divider) divider.hidden = false;
    } catch {
      showFallback("Google sign-in is unavailable. Use email or phone instead.");
    }
  }

  if (window.google?.accounts?.id) {
    initializeGoogleSignIn();
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = initializeGoogleSignIn;
  script.onerror = () => {
    showFallback("Google sign-in is unavailable. Use email or phone instead.");
  };
  document.head.append(script);
}

async function handleGoogleCredential(response) {
  const message = document.querySelector("#message");
  if (message) setStatusMessage(message, "Signing in with Google…");

  try {
    let result;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      result = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential })
      });
      if (![502, 503, 504].includes(result.status) || attempt === 1) break;
      await result.text();
      if (message) setStatusMessage(message, "The server is waking up. Retrying sign-in…");
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    if ([502, 503, 504].includes(result.status)) {
      throw new Error("The backend is still waking up. Please wait a moment and try Google sign-in again.");
    }

    const responseText = await result.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      const contentType = result.headers.get("content-type") || "unknown content type";
      const isHtml = /text\/html|<!doctype\s+html|<html/i.test(`${contentType} ${responseText.slice(0, 200)}`);
      if (isHtml) {
        throw new Error(`Google sign-in reached a web page instead of the API (HTTP ${result.status}). Check the Vercel /api rewrite and Render deployment, then try again.`);
      }
      throw new Error(`Google sign-in returned an unreadable response (HTTP ${result.status}). Please try again.`);
    }
    if (!result.ok) throw new Error(data.error || "Google sign-in failed");

    completeAuthentication(data);
    const next = new URLSearchParams(location.search).get("next");
    location.href = ["cart.html", "payment.html"].includes(next) ? next : "index.html";
  } catch (error) {
    if (message) setStatusMessage(message, error.message, "error");
  }
}
