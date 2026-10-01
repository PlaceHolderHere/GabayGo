import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, firebaseApp, firebaseConfig, hasFirebaseConfig } from './firebase'

const pushPreferenceKey = 'gabaygo-event-push-enabled-v1'
const pushTokenKey = 'gabaygo-event-fcm-token-v1'
const deviceIdKey = 'gabaygo-notification-device-v1'
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY

function getDeviceId() {
  let deviceId = localStorage.getItem(deviceIdKey)
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(deviceIdKey, deviceId)
  }
  return deviceId
}

function subscriptionReference(userId) {
  return doc(db, 'NotificationSubscriptions', `${userId}_${getDeviceId()}`)
}

function serviceWorkerUrl() {
  const url = new URL('/firebase-messaging-sw.js', window.location.origin)
  Object.entries(firebaseConfig).forEach(([key, value]) => url.searchParams.set(key, value))
  return `${url.pathname}${url.search}`
}

async function registerMessagingWorker() {
  return navigator.serviceWorker.register(serviceWorkerUrl(), { scope: '/' })
}

export async function getPushStatus(user) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) {
    return { state: 'unsupported', message: 'Web push is not supported by this browser.' }
  }
  if (!hasFirebaseConfig || !vapidKey || !db) {
    return { state: 'configuration', message: 'Add the Firebase configuration and VITE_FIREBASE_VAPID_KEY to your environment.' }
  }
  if (!user) return { state: 'signed-out', message: 'Sign in to receive reminders for upcoming events.' }
  if (Notification.permission === 'denied') {
    return { state: 'blocked', message: 'Notifications are blocked in this browser. Allow them in the site settings first.' }
  }
  const enabled = Notification.permission === 'granted' && localStorage.getItem(pushPreferenceKey) === 'true'
  return {
    state: enabled ? 'enabled' : 'ready',
    message: enabled
      ? 'This browser will receive reminders one day before scheduled events.'
      : 'Get a browser notification one day before a scheduled event.',
  }
}

export async function enablePushNotifications(user) {
  if (!user) throw new Error('Sign in before enabling event reminders.')
  const status = await getPushStatus(user)
  if (['unsupported', 'configuration', 'blocked'].includes(status.state)) throw new Error(status.message)

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const registration = await registerMessagingWorker()
  const messaging = getMessaging(firebaseApp)
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error('Firebase did not return a notification token. Please try again.')

  await setDoc(subscriptionReference(user.uid), {
    userId: user.uid,
    deviceId: getDeviceId(),
    token,
    enabled: true,
    updatedAt: serverTimestamp(),
  })
  localStorage.setItem(pushTokenKey, token)
  localStorage.setItem(pushPreferenceKey, 'true')
  return getPushStatus(user)
}

export async function disablePushNotifications(user) {
  if (!user) throw new Error('Sign in before changing event reminder settings.')
  const token = localStorage.getItem(pushTokenKey)
  if (token) {
    await setDoc(subscriptionReference(user.uid), {
      userId: user.uid,
      deviceId: getDeviceId(),
      token,
      enabled: false,
      updatedAt: serverTimestamp(),
    }, { merge: true })
    if (await isSupported()) await deleteToken(getMessaging(firebaseApp))
  }
  localStorage.removeItem(pushTokenKey)
  localStorage.setItem(pushPreferenceKey, 'false')
  return getPushStatus(user)
}

export async function showTestNotification() {
  if (Notification.permission !== 'granted') throw new Error('Enable event reminders first.')
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification('GabayGo event reminders are ready', {
    body: 'You will receive a reminder one day before a scheduled event.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'gabaygo-notification-test',
    data: { url: '/' },
  })
}

export async function listenForForegroundMessages(onNotification) {
  if (!firebaseApp || !(await isSupported())) return () => {}
  return onMessage(getMessaging(firebaseApp), async (payload) => {
    onNotification?.(payload)
    if (Notification.permission !== 'granted') return
    const registration = await navigator.serviceWorker.ready
    const title = payload.notification?.title || payload.data?.title || 'GabayGo event reminder'
    await registration.showNotification(title, {
      body: payload.notification?.body || payload.data?.body || 'An event is coming up tomorrow.',
      icon: payload.notification?.icon || '/icon.svg',
      badge: '/icon.svg',
      tag: payload.data?.eventId || 'gabaygo-event-reminder',
      data: { url: payload.data?.url || '/' },
    })
  })
}