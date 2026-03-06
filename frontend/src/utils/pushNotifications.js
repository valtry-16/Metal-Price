import { PROD_API_URL } from "./constants";

// Convert base64 VAPID key to Uint8Array for subscription
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Get the VAPID public key from backend (or use env var)
async function getVapidKey() {
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (envKey) return envKey;
  const res = await fetch(`${PROD_API_URL}/push/vapid-key`);
  if (!res.ok) throw new Error("Push not available");
  const data = await res.json();
  return data.publicKey;
}

// Subscribe to push notifications
export async function subscribeToPush(userId, metals) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported in this browser");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission denied");
  }

  const registration = await navigator.serviceWorker.ready;
  const vapidKey = await getVapidKey();

  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  // Send to backend
  const res = await fetch(`${PROD_API_URL}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      userId,
      metals,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to subscribe");
  }

  return await res.json();
}

// Update metal preferences
export async function updatePushPreferences(userId, metals) {
  const res = await fetch(`${PROD_API_URL}/push/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, metals }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update preferences");
  }
  return await res.json();
}

// Get current push preferences
export async function getPushPreferences(userId) {
  const res = await fetch(`${PROD_API_URL}/push/preferences/${userId}`);
  if (!res.ok) return { metals: [], subscribed: false };
  return await res.json();
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(userId) {
  // Unsubscribe the browser
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();

  // Tell the backend
  const res = await fetch(`${PROD_API_URL}/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to unsubscribe");
  }
  return await res.json();
}

// Check if push is currently subscribed
export async function isPushSubscribed() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}
