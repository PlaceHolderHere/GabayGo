# GabayGo

A React and Vite app for community locations, alerts, updates, and marketplace listings.

## Netlify demo

Set the following environment variables in Netlify, then trigger a new deploy:

- `VITE_DEMO_MODE=true`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY` (Firebase Console > Project settings > Cloud Messaging > Web Push certificates)
- `VITE_GEMINI_API_KEY`

In the Firebase demo project, enable **Authentication > Sign-in method > Anonymous**, add the Netlify site domain under **Authentication > Settings > Authorized domains**, and publish this repository's `firestore.rules`. The app silently creates an anonymous session, which grants demo admin controls for adding and editing map locations, managing reports, and approving or denying listings. Gemini chat does not require Firebase authentication.

These Firestore rules intentionally grant admin access to every anonymous account. Use a dedicated Firebase project for the public demo, never the production project. Anyone can modify or delete demo content, and usage of the client-side Gemini key can incur charges. Restrict the Gemini key to the required API and set quota limits.

## Event push reminders

Add `VITE_FIREBASE_VAPID_KEY` to `.env` using the public key from Firebase Console > Project settings > Cloud Messaging > Web Push certificates, then rebuild/redeploy the web app. The Updates participation section lets signed-in users enable reminders on the current browser. A scheduled Cloud Function sends a push notification at 9:00 a.m. Asia/Manila on the day before entries in `Locations` with category `Event` and entries in `Schedules`.

To deploy reminders, select your Firebase project with `firebase use --add`, enable Cloud Messaging and Cloud Firestore, then run `firebase deploy --only firestore:rules,functions`. Scheduled Functions require the Blaze billing plan because Firebase provisions Cloud Scheduler. Add every production web domain under Authentication > Settings > Authorized domains. Users must allow notifications in their browser; the site must be served over HTTPS (localhost is also supported).