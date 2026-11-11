adminPageTitles.backups = ["Data backups", "Download a secure snapshot of platform records."];

const platformBackupButton = document.querySelector("#download-platform-backup");
const platformBackupStatus = document.querySelector("#platform-backup-status");
platformBackupButton?.addEventListener("click", async () => {
  platformBackupButton.disabled = true;
  platformBackupStatus.textContent = "Preparing the platform backup…";
  try {
    const response = await fetch(`${API_BASE}/admin/backup`, { headers: authHeaders() });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not create the platform backup.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `almadina-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    platformBackupStatus.textContent = "Backup downloaded. Store the file securely.";
  } catch (error) {
    platformBackupStatus.textContent = error.message;
  } finally { platformBackupButton.disabled = false; }
});
