// Paste your Firebase web app config here
// (Firebase console → Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config).
// These values are not secret; they only identify your project.
// While apiKey is empty, the app runs in local-only mode (data saved in this browser only).
export const firebaseConfig = {
  apiKey: 'AIzaSyD9wO_YtX8f2juWEGUqvHdlO36Qe3xCS3E',
  authDomain: 'synced-rest-booth.firebaseapp.com',
  projectId: 'synced-rest-booth',
  storageBucket: 'synced-rest-booth.firebasestorage.app',
  messagingSenderId: '190286696164',
  appId: '1:190286696164:web:6feb0ec5d4cc40f28126f1',
};

// Every device using the same BOOTH_ID shares one dataset. Change it to run a separate booth.
export const BOOTH_ID = 'main';

export const cloudEnabled = !!firebaseConfig.apiKey;
