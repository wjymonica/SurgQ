// Replace with your Firebase project config from Firebase Console > Project settings > General.
// Leave projectId as "YOUR_PROJECT_ID" to run without auth (no login, no progress sync).
//
// Authentication: enable "Email/Password" (first toggle). Optionally enable "Email link" for sign-in on other devices.
// If you get auth/configuration-not-found for email link: add your domain under Authentication > Settings > Authorized domains.
//
// Required: Create a Realtime Database (Build > Realtime Database). Copy its URL from the console and set databaseURL below.
// Required: Use rules so each user can read/write only their data (see Firebase Console > Realtime Database > Rules).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBWc3GcWlbLbEt8wSLbAE2nuPRwph7pCT8",
  authDomain: "surgqtest.firebaseapp.com",
  databaseURL: "https://surgqtest-default-rtdb.firebaseio.com", // Required for progress sync. If missing, set from Firebase Console > Realtime Database.
  projectId: "surgqtest",
  storageBucket: "surgqtest.firebasestorage.app",
  messagingSenderId: "871045470522",
  appId: "1:871045470522:web:2d51714501422bec8bd803",
  measurementId: "G-BCZKTYJVL9"
};

// ── App mode ──────────────────────────────────────────────
// "debug" : no login required, all questions, jump panel + PDF export
// "v1"    : login required, version-1 question set, forward-only, Firebase sync
// "v2"    : login required, version-2 question set, forward-only, Firebase sync
window.APP_CONFIG = {
  mode: "v1", // ← change to "v1" or "v2" to deploy
};
