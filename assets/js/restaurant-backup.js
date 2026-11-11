restaurantViewInfo.backup = ["Data backup", "Download a copy of this restaurant’s records."];

const restaurantBackupNav = document.querySelector("#backup-nav");
const restaurantBackupButton = document.querySelector("#download-restaurant-backup");
const restaurantBackupStatus = document.querySelector("#restaurant-backup-status");

async function enableRestaurantBackupForAllowedRole() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    if (!response.ok) return;
    const { user } = await response.json();
    const allowed = user?.role === "restaurant" || (user?.role === "restaurant_staff" && user?.restaurantStaffRole === "secondary_admin");
    restaurantBackupNav.hidden = !allowed;
    if (allowed) {
      const roleObserver = new MutationObserver(() => { if (restaurantBackupNav.hidden) restaurantBackupNav.hidden = false; });
      roleObserver.observe(restaurantBackupNav, { attributes: true, attributeFilter: ["hidden"] });
    }
    if (!allowed) document.querySelector('[data-restaurant-section="backup"]').hidden = true;
  } catch (error) { console.warn("[backup] could not load restaurant role", error); }
}
enableRestaurantBackupForAllowedRole();

restaurantBackupButton?.addEventListener("click", async () => {
  restaurantBackupButton.disabled = true;
  restaurantBackupStatus.textContent = "Preparing the restaurant backup…";
  try {
    const response = await fetch(`${API_BASE}/restaurants/owner/backup`, { headers: authHeaders() });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not create the restaurant backup.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `almadina-restaurant-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    restaurantBackupStatus.textContent = "Backup downloaded. Store the file securely.";
  } catch (error) {
    restaurantBackupStatus.textContent = error.message;
  } finally { restaurantBackupButton.disabled = false; }
});
