// Swap Google Fonts from print to all once loaded (CSP-safe, no inline handler)
const fontsLink = document.getElementById("google-fonts");
if (fontsLink) {
  fontsLink.addEventListener("load", () => { fontsLink.media = "all"; });
  // If already cached / loaded before this script runs
  if (fontsLink.sheet) fontsLink.media = "all";
}

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates periodically
        setInterval(() => {
          reg.update();
        }, 3600000); // Check every hour
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
