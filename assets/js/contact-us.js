// Add the official profile URLs here when Al Madina's social accounts are ready.
const contactSocialProfiles = Object.freeze({
  instagram: "",
  facebook: ""
});

document.querySelectorAll("[data-social-profile]").forEach(placeholder => {
  const profile = contactSocialProfiles[placeholder.dataset.socialProfile];
  if (!profile) return;

  try {
    const url = new URL(profile);
    if (url.protocol !== "https:") return;

    const link = document.createElement("a");
    link.className = placeholder.className;
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = placeholder.dataset.socialProfile === "instagram" ? "Instagram" : "Facebook";
    placeholder.replaceWith(link);
  } catch {
    // Keep the social profile marked as coming soon until a valid HTTPS link is set.
  }
});
