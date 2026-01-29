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

messaging.onBackgroundMessage((payload) => { self.registration.showNotification(payload.notification.title, { body: payload.notification.body, icon: "./icons/icon-192.png" }); });

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
