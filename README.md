# Ultra-Minimal PM - Firebase Template

A simple, browser-based project/document management tool built with HTML, CSS, vanilla JavaScript, and Firebase (Authentication, Firestore, Hosting). Designed as a starting point or template for simple Firebase web apps.

## Features

*   **Google Authentication:** Secure sign-in/registration using Firebase Authentication.
*   **Firestore Database:** Create, Read, Update, and Delete simple text documents stored in Cloud Firestore.
*   **Client-Side Rendering:** Document list updates based on Firestore fetches.
*   **Minimal UI:** Clean interface focused on core functionality.
*   **Client-Side:** Runs entirely in the browser using Firebase Hosting.
*   **Secret Management:** Configuration setup to keep your Firebase API keys out of your public repository template.

## Technology Stack

*   HTML5
*   CSS3
*   Vanilla JavaScript (ES6+)
*   Firebase SDK (v9.6.0 Compat libraries used in this template)
    *   Firebase Authentication (Google Sign-in)
    *   Cloud Firestore (Database)
    *   Firebase Hosting

## Prerequisites

*   A Google Account (for Firebase)
*   Node.js and npm (or yarn) installed (for Firebase CLI)
*   Firebase CLI installed (`npm install -g firebase-tools`)

## Setup Instructions

1.  **Clone or Download:**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```
    (Replace URL with your repository) OR download the ZIP and extract it.

2.  **Firebase Project:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/).
    *   Create a new Firebase project (or use an existing one).
    *   **Enable Authentication:**
        *   Go to Authentication -> Sign-in method.
        *   Enable the "Google" provider. Enter a project support email.
    *   **Enable Firestore:**
        *   Go to Firestore Database -> Create database.
        *   Start in **Test mode** (you will secure it later with `firestore.rules`). Choose a region.
    *   **Register Web App:**
        *   Go to Project Settings (gear icon) -> General tab.
        *   Scroll down to "Your apps". Click the Web icon (`</>`).
        *   Give your app a nickname.
        *   **Important:** Do **NOT** check the box for "Also set up Firebase Hosting" at this step.
        *   Click "Register app".
        *   **Copy the `firebaseConfig` object.** You need these values. Close the popup after copying.

3.  **Configure API Keys:**
    *   In your project folder, navigate to the `public/js/` directory.
    *   **Copy** the file `config.example.js` and **rename** the copy to `config.js`.
    *   **Edit `public/js/config.js`:** Replace the placeholder values (`"YOUR_API_KEY"`, etc.) with the actual values from your Firebase project's `firebaseConfig`.
    *   **Crucially:** The `.gitignore` file prevents `public/js/config.js` from being committed. **DO NOT** commit `config.js` to your public repository.

4.  **Restrict API Key (Security Best Practice):**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Select your Firebase project.
    *   Navigate to "APIs & Services" -> "Credentials".
    *   Find the API key listed in your `firebaseConfig`. Click its name.
    *   Under "Application restrictions", select "HTTP referrers (web sites)".
    *   Click "Add An Item" and add your Firebase Hosting URLs:
        *   `your-project-id.web.app`
        *   `your-project-id.firebaseapp.com`
        *   (Add custom domains if you use them)
    *   (Optional but Recommended) Under "API restrictions", select "Restrict key" and choose needed APIs (e.g., "Identity Toolkit API", "Cloud Firestore API").
    *   Click "Save".

5.  **Firebase Login & Project Association (CLI):**
    *   Open your terminal/command prompt in the project's **root** directory.
    *   Log in: `firebase login`
    *   Associate project: `firebase use --add` (Select your Firebase project).

6.  **Deploy Firestore Rules:**
    *   Deploy security rules: `firebase deploy --only firestore:rules`

7.  **Run Locally (Optional):**
    *   Use the Firebase Hosting emulator: `firebase emulators:start --only hosting`
    *   Open `http://localhost:5000` (or the indicated port).

8.  **Deploy to Firebase Hosting:**
    *   Deploy your app: `firebase deploy --only hosting`
    *   Firebase CLI will provide your live site URL.

## File Structure

```
your-project-root/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── config.example.js
│   │   ├── config.js         (Gitignored)
│   │   ├── documents.js
│   │   └── ui.js
│   ├── 404.html
│   ├── app.html
│   ├── auth-test.html
│   ├── default.html
│   ├── index.html
│   └── login.html
├── .gitignore
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── LICENSE
└── README.md
```

## API Key Visibility Note

The `firebaseConfig` (including your API key) in `public/js/config.js` **will be visible** to users viewing your deployed website's source code. This is expected by Firebase. Security relies on **Firebase Authentication + Firestore Security Rules** (enforced server-side), not on hiding the client-side config. Restricting your API key (Step 4 above) is crucial to prevent others from using your config on *their* websites.

## Customization Notes

*   **Firebase SDK Version:** Uses v9.6.0 Compat. Consider upgrading to the modular SDK (v9+) for potential benefits, requiring code changes.
*   **Realtime Updates:** For true realtime, modify `js/documents.js` to use Firestore's `onSnapshot()` instead of `.get()`. Handle unsubscribing.
*   **Styling:** Modify `public/css/style.css`.
*   **Error Handling:** Enhance user feedback for errors.