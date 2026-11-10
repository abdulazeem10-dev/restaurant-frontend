const isAlMadinaAndroidApp = /AlMadinaAndroidApp/i.test(navigator.userAgent);

if (!isAlMadinaAndroidApp && "serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(error => console.error("Al-Madina app setup failed:", error));
}
