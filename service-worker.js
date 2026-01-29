// Firebase imports
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "…",
  authDomain: "…",
  projectId: "…",
  messagingSenderId: "…",
  appId: "…"
});

const messaging = firebase.messaging();

// Firebase background messages
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "./icons/icon-192.png"
  });
});

// ❗ CRITICAL: Standard push listener (required for iOS + Chrome)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  self.registration.showNotification(data.notification.title, {
    body: data.notification.body,
    icon: "./icons/icon-192.png"
  });
});

// Cache section
const CACHE_NAME = 'todo-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
