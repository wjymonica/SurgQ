// Replace with your Firebase project config from Firebase Console > Project settings > General.
// Leave projectId as "YOUR_PROJECT_ID" to run without auth (no login, no progress sync).
//
// Authentication: enable "Email/Password" (first toggle). Optionally enable "Email link" for sign-in on other devices.
// If you get auth/configuration-not-found for email link: add your domain under Authentication > Settings > Authorized domains.
//
// Required: Create a Realtime Database (Build > Realtime Database). Use rules so each user can read/write only their data:
//   {
//     "rules": {
//       "users": {
//         "$uid": {
//           ".read": "auth != null && auth.uid == $uid",
//           ".write": "auth != null && auth.uid == $uid"
//         }
//       }
//     }
//   }
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBWc3GcWlbLbEt8wSLbAE2nuPRwph7pCT8",
  authDomain: "surgqtest.firebaseapp.com",
  projectId: "surgqtest",
  storageBucket: "surgqtest.firebasestorage.app",
  messagingSenderId: "871045470522",
  appId: "1:871045470522:web:2d51714501422bec8bd803",
  measurementId: "G-BCZKTYJVL9"
};
