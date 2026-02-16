// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates periodically
        setInterval(() => {
          reg.update();
        }, 60000); // Check every minute
      })
      .catch(() => {
        // Ignore registration errors in production
      });
  });

  // Handle service worker update
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
