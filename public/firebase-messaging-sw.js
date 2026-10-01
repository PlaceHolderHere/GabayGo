importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js')

const firebaseConfig = Object.fromEntries(new URL(self.location).searchParams.entries())
firebase.initializeApp(firebaseConfig)

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || 'GabayGo event reminder'
  self.registration.showNotification(title, {
    body: payload.data?.body || 'An event is coming up tomorrow.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.data?.eventId || 'gabaygo-event-reminder',
    data: { url: payload.data?.url || '/' },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.openWindow(targetUrl))
})