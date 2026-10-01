import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { onSchedule } from 'firebase-functions/v2/scheduler'

if (getApps().length === 0) initializeApp()

const db = getFirestore()
const messaging = getMessaging()
const timeZone = 'Asia/Manila'

function dateKeyInTimeZone(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function nextDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

function messageForEvent(event) {
  const when = event.startTime ? ` tomorrow at ${event.startTime}` : ' tomorrow'
  return {
    data: {
      eventId: event.id,
      title: `Coming up: ${event.name}`,
      body: `${event.category === 'Schedule' ? 'Community schedule' : 'Community event'}${when}.`,
      url: '/',
    },
  }
}

async function sendPushMessage(message, subscriptions) {
  for (let offset = 0; offset < subscriptions.length; offset += 500) {
    const batch = subscriptions.slice(offset, offset + 500)
    const result = await messaging.sendEachForMulticast({
      ...message,
      tokens: batch.map((subscription) => subscription.token),
    })
    const invalidSubscriptions = batch.filter((_, index) => {
      const response = result.responses[index]
      return !response.success && [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
      ].includes(response.error?.code)
    })
    await Promise.all(invalidSubscriptions.map(({ ref }) => ref.set({
      enabled: false,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })))
  }
}

async function sendEventReminder(event, reminderDate, subscriptions) {
  const dispatchRef = db.collection('NotificationDispatches').doc(`${reminderDate}_${event.source}_${event.id}`)
  const dispatch = await dispatchRef.get()
  if (dispatch.exists) return

  await sendPushMessage(messageForEvent(event), subscriptions)
  await dispatchRef.set({ eventId: event.id, source: event.source, reminderDate, sentAt: FieldValue.serverTimestamp() })
}

export const sendUpcomingEventReminders = onSchedule({
  schedule: '0 9 * * *',
  timeZone,
  region: 'asia-southeast1',
  retryCount: 2,
}, async () => {
  const reminderDate = dateKeyInTimeZone(new Date())
  const eventDate = nextDateKey(reminderDate)
  const [locationsSnapshot, schedulesSnapshot, subscriptionsSnapshot] = await Promise.all([
    db.collection('Locations').where('category', '==', 'Event').get(),
    db.collection('Schedules').where('category', '==', 'Schedule').get(),
    db.collection('NotificationSubscriptions').where('enabled', '==', true).get(),
  ])

  const subscriptions = subscriptionsSnapshot.docs.map((snapshot) => ({ ref: snapshot.ref, ...snapshot.data() }))
  const events = [
    ...locationsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, source: 'Locations', ...snapshot.data() })),
    ...schedulesSnapshot.docs.map((snapshot) => ({ id: snapshot.id, source: 'Schedules', ...snapshot.data() })),
  ].filter((event) => event.startDate === eventDate)

  for (const event of events) {
    await sendEventReminder(event, reminderDate, subscriptions)
  }
})