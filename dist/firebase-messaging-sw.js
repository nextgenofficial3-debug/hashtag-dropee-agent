// Firebase Messaging Service Worker — Agent App
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCExdszDcQzhJHoUvOqVlRwyfqfKkoA3kY",
  authDomain: "webapp-af75d.firebaseapp.com",
  projectId: "webapp-af75d",
  storageBucket: "webapp-af75d.firebasestorage.app",
  messagingSenderId: "52507263282",
  appId: "1:52507263282:web:da4df9b6e02b2d23e8d72b",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] New order notification:', payload);

  const { title, body } = payload.notification || {};
  const notificationTitle = title || '🚚 New Delivery Order';
  const notificationOptions = {
    body: body || 'A new order has been assigned to you!',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [300, 100, 300, 100, 300],
    tag: 'new-order',
    renotify: true,
    data: payload.data || {},
    actions: [
      { action: 'accept', title: '✅ View Order' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/agent/dashboard';
  event.waitUntil(clients.openWindow(url));
});
