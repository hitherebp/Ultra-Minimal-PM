/**
 * Module for handling Firebase Authentication.
 * Provides methods for sign-in, sign-out, and observing auth state.
 */

const authModule = (() => {
    let authInstance = null;
    let authStateCallback = null; // Stores the callback provided by the app

    /**
     * Initializes the auth module. Should be called after Firebase App is initialized.
     * @returns {firebase.auth.Auth|null} The auth instance or null if init failed.
     */
    function initFirebaseAuth() {
        if (authInstance) {
            return authInstance; // Already initialized
        }
        try {
            // Ensure Firebase app is initialized (check might be redundant if called correctly)
            if (!firebase || firebase.apps.length === 0) {
                console.error("Firebase App not initialized before initializing auth.");
                // Attempt to initialize if config exists (fallback, ideally init happens earlier)
                if (window.firebaseConfig && !window.firebaseConfig.apiKey.startsWith("YOUR_")) {
                     if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
                     console.warn("Attempted Firebase App initialization within auth module.");
                } else {
                     throw new Error("Firebase App not ready and config missing/invalid.");
                }
            }
            authInstance = firebase.auth();
            console.log("Firebase Auth Initialized.");

            // Set up the single, central auth state listener
            authInstance.onAuthStateChanged(user => {
                console.log('Auth state changed in auth.js. User:', user ? user.uid : null);
                // Call the application's callback, if registered
                if (typeof authStateCallback === 'function') {
                    authStateCallback(user);
                }
            }, error => {
                console.error("Error in onAuthStateChanged listener:", error);
                // Optionally call the callback with an error state or null user
                 if (typeof authStateCallback === 'function') {
                    authStateCallback(null, error); // Pass error as second argument
                }
            });

            return authInstance;
        } catch (error) {
            console.error("Failed to initialize Firebase Auth:", error);
            return null;
        }
    }

    /**
     * Registers a callback function to be invoked when the auth state changes.
     * Replaces any previously registered callback.
     * @param {function(firebase.User|null, Error|null)} callback - Function to call with user object (or null) and optional error.
     */
    function onAuthStateChange(callback) {
        if (typeof callback !== 'function') {
            console.error("onAuthStateChange requires a function callback.");
            return;
        }
        authStateCallback = callback;
        // Ensure the internal listener is running
        if (!authInstance) {
            initFirebaseAuth();
        }
        // Immediately call the callback with the current state *if* auth is ready
        if (authInstance) {
             // Use currentUser cautiously on initial load, onAuthStateChanged is more reliable
             // Consider delaying this immediate call or letting the listener fire naturally.
             // For now, let the listener handle the initial state reporting.
             console.log("Registered auth state change callback. Listener will report current state.");
        }
    }

    /**
     * Initiates Sign in using Google Popup.
     * @returns {Promise<firebase.auth.UserCredential>} Promise resolving on success, rejecting on error.
     */
    function signInWithGoogle() {
        if (!authInstance) {
            initFirebaseAuth();
            if (!authInstance) return Promise.reject(new Error("Auth not initialized"));
        }
        const provider = new firebase.auth.GoogleAuthProvider();
        // Consider adding custom parameters if needed:
        // provider.addScope('profile');
        // provider.addScope('email');
        return authInstance.signInWithPopup(provider);
    }

    // --- Placeholder for future providers ---
    // function signInWithEmail(email, password) {
    //     if (!authInstance) return Promise.reject(new Error("Auth not initialized"));
    //     return authInstance.signInWithEmailAndPassword(email, password);
    // }
    // function signUpWithEmail(email, password) {
    //     if (!authInstance) return Promise.reject(new Error("Auth not initialized"));
    //     return authInstance.createUserWithEmailAndPassword(email, password);
    // }
    // --- End Placeholders ---


    /**
     * Signs the current user out.
     * @returns {Promise<void>} Promise resolving on success, rejecting on error.
     */
    function signOutUser() {
        if (!authInstance) {
             console.warn("Attempted sign out, but auth not initialized.");
            return Promise.resolve(); // Resolve silently if not initialized
        }
        return authInstance.signOut();
    }

    /**
     * Gets the currently signed-in user object.
     * Note: Can be null on initial load before onAuthStateChanged fires.
     * @returns {firebase.User|null} The current user or null.
     */
    function getCurrentUser() {
        if (!authInstance) {
             // Ensure init is attempted if not done yet
             initFirebaseAuth();
        }
        return authInstance ? authInstance.currentUser : null;
    }

    // Public interface
    return {
        initFirebaseAuth, // Expose init mainly for explicit control if needed
        onAuthStateChange,
        signInWithGoogle,
        // Add future providers here: signInWithEmail, etc.
        signOutUser,
        getCurrentUser
    };

})(); // Immediately invoke the function to create the authModule object