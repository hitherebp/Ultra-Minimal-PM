// 1. Rename this file to config.js (in the same 'public/js/' directory)
// 2. Replace the placeholder values below with your actual Firebase project configuration.
// 3. Make sure config.js is listed in your root .gitignore file (e.g., public/js/config.js)!

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",                     // Replace with your Firebase project's API Key
  authDomain: "YOUR_AUTH_DOMAIN",               // Replace with your Firebase project's Auth Domain
  projectId: "YOUR_PROJECT_ID",                 // Replace with your Firebase project's Project ID
  storageBucket: "YOUR_STORAGE_BUCKET",           // Replace with your Firebase project's Storage Bucket
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your Firebase project's Messaging Sender ID
  appId: "YOUR_APP_ID"                        // Replace with your Firebase project's App ID
  // measurementId: "YOUR_MEASUREMENT_ID" // Optional: Add if you use Google Analytics
};

// Make the config available globally using the window object for simplicity in this example.
// In larger apps, consider using JavaScript modules (import/export).
window.firebaseConfig = firebaseConfig;

// --- API Key Visibility & Security ---
// IMPORTANT: This config object WILL BE VISIBLE in the browser's source code.
// This is by design. Firebase security relies on:
// 1. Firebase Authentication (verifying users).
// 2. Security Rules (Firestore, Storage rules enforced on the server).
//
// DO NOT put secret credentials (like server private keys) in this file.
//
// CRITICAL: Restrict your API Key in the Google Cloud Console using HTTP referrers
// to prevent others from using your Firebase config on their own websites.
// See README.md for instructions.