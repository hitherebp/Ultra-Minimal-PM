/**
 * Main application script for Ultra-Minimal PM.
 * Handles initialization, authentication state via authModule,
 * main application logic, and coordination between UI and document modules.
 */

// --- Global state variables ---
let currentEditingDocId = null; // ID of the doc being edited in the modal
let hasUnsavedChanges = false; // Flag for unsaved changes in the editor
let currentUser = null; // Holds the currently authenticated user object (local cache)
let db; // Firestore database instance

// --- Utility Functions (defined first for availability) ---

/**
 * Displays a fatal error message to the user and logs details.
 * Halts further interaction by disabling buttons.
 * @param {string} message - The user-facing error message.
 * @param {Error} [error] - Optional error object for console logging.
 */
function handleFatalError(message, error = null) {
    console.error("FATAL ERROR:", message, error || '');
    const loadingIndicator = document.getElementById('loadingIndicator');
    // Try to display error in the main content area if possible
    if (loadingIndicator) {
        loadingIndicator.innerHTML = `<p style="color: red; font-weight: bold; padding: 20px;">${message}</p>`;
        loadingIndicator.classList.remove('hidden');
        // Hide document list if error occurs
        const docList = document.getElementById('documentList');
        if (docList) docList.classList.add('hidden');
    } else {
        // Fallback if loading indicator isn't available
        alert(`Critical Error: ${message}\nPlease check the console and refresh.`);
    }
    // Disable all buttons on fatal error to prevent further actions
    document.querySelectorAll('button').forEach(btn => btn.disabled = true);
}

// --- Core Application Logic & Event Handlers ---

/**
 * App-specific handler for authentication state changes.
 * This function is passed to authModule.onAuthStateChange.
 * @param {firebase.User|null} user - The current user object or null.
 * @param {Error|null} error - An optional error object if the listener failed.
 */
function handleAuthStateChangedInApp(user, error) {
     if (error) {
        console.error("Received auth state error in app:", error);
        // Use ui.showToast if ui module is available, otherwise fallback
        const toastFunc = typeof ui !== 'undefined' ? ui.showToast : console.error;
        toastFunc(`Authentication error: ${error.message}. Please try refreshing.`, true);
        handleFatalError("Critical authentication error. Check console.", error);
        return;
     }

    if (user) {
        // User is signed in
        currentUser = user; // Update local cache
        console.log("App received signed-in state for:", currentUser.uid);
        if (typeof ui !== 'undefined') {
            ui.updateUserDisplay(currentUser);
            ui.setLoading(true); // Show loading indicator
        }
        // Fetch documents only if documents module and db are ready
        if (typeof documents !== 'undefined' && db) {
            documents.fetchDocuments(db, currentUser.uid, (docs) => {
                if (typeof ui !== 'undefined') {
                    ui.renderDocumentList(docs);
                    ui.setLoading(false); // Hide loading indicator
                }
            }, (fetchError) => {
                console.error("Error fetching documents:", fetchError);
                if (typeof ui !== 'undefined') {
                    ui.showToast(`Error loading documents: ${fetchError.message}`, true);
                    ui.setLoading(false);
                }
            });
        } else {
             handleFatalError("Documents module or Firestore DB not ready.", new Error("DB/Documents module missing"));
        }
    } else {
        // User is signed out
        currentUser = null;
        console.log("App received signed-out state. Redirecting to login...");
        // Redirect to login page; use replace to avoid history issues
        window.location.replace('login.html');
    }
}

/**
 * Handles the logout process using authModule.
 */
function handleLogout() {
    console.log("Requesting sign out via authModule...");
    // Use ui module functions if available
    const toastFunc = typeof ui !== 'undefined' ? ui.showToast : console.log;
    const loadingButtonFunc = typeof ui !== 'undefined' ? ui.setButtonLoading : ()=>{};
    const logoutButton = document.getElementById('logoutButton');

    toastFunc("Logging out...", false);
    if(logoutButton) loadingButtonFunc(logoutButton, true); // Disable button

    // Use authModule if available
    if (typeof authModule !== 'undefined') {
        authModule.signOutUser()
            .then(() => {
                // Sign out successful.
                // The onAuthStateChange listener (handleAuthStateChangedInApp) will trigger the redirect.
                console.log("Sign out call successful.");
                // Button state reset might happen implicitly on page redirect
            })
            .catch(error => {
                // Handle potential errors during sign out
                console.error("Logout failed:", error);
                toastFunc(`Logout error: ${error.message}`, true);
                if(logoutButton) loadingButtonFunc(logoutButton, false); // Re-enable on error
            });
    } else {
         handleFatalError("Auth module not available for sign out.", new Error("authModule missing"));
    }
}

/**
 * Handles creating a new document. Opens the editor modal.
 * Checks for unsaved changes before proceeding.
 */
function handleNewDocument() {
    console.log("handleNewDocument function CALLED");
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Are you sure you want to discard them and start a new document?")) {
        console.log("New document cancelled due to unsaved changes.");
        return;
    }
    console.log("Opening editor for new document.");
    currentEditingDocId = null; // Ensure we know it's a new doc
    hasUnsavedChanges = false;
    // Use ui module if available
    if (typeof ui !== 'undefined') {
        ui.openEditor(); // Opens with blank fields
        ui.updateSaveStatus(''); // Clear save status
    } else {
         handleFatalError("UI module not available to open editor.", new Error("ui module missing"));
    }
}

/**
 * Handles closing the document editor modal.
 * Checks for unsaved changes before proceeding.
 */
function handleCloseEditor() {
    console.log("handleCloseEditor function CALLED");
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Are you sure you want to close without saving?")) {
        console.log("Close editor cancelled due to unsaved changes.");
        return;
    }
    console.log("Closing editor.");
     // Use ui module if available
    if (typeof ui !== 'undefined') {
        ui.closeEditor();
    } else {
        console.warn("UI module not available to close editor."); // Non-fatal?
    }
    currentEditingDocId = null;
    hasUnsavedChanges = false;
}

/**
 * Handles saving the document currently in the editor (new or existing).
 */
function handleSaveDocument() {
    console.log("handleSaveDocument CALLED");
    // Use ui module functions if available
    const toastFunc = typeof ui !== 'undefined' ? ui.showToast : console.error;
    const statusFunc = typeof ui !== 'undefined' ? ui.updateSaveStatus : console.log;
    const loadingButtonFunc = typeof ui !== 'undefined' ? ui.setButtonLoading : ()=>{};
    const saveButton = document.getElementById('saveDocButton');

    if (!currentUser) {
        toastFunc("Error: Not authenticated. Cannot save.", true);
        return;
    }
    if (typeof documents === 'undefined' || !db) {
         handleFatalError("Documents module or DB not ready for saving.", new Error("DB/Documents module missing"));
         return;
    }

    const titleElement = document.getElementById('documentTitle');
    const contentElement = document.getElementById('documentContent'); // Adapt if using rich text editor (e.g., call ui.getEditorContent())

    if (!titleElement || !contentElement) {
         handleFatalError("Editor title or content elements not found.", new Error("DOM elements missing"));
         return;
    }

    const title = titleElement.value;
    const content = contentElement.value; // Replace with ui.getEditorContent() if needed

    console.log(`Saving document: ID=${currentEditingDocId || 'New'}`);
    statusFunc('Saving...');
    if(saveButton) loadingButtonFunc(saveButton, true); // Disable save button

    documents.saveDocument(db, currentUser.uid, currentEditingDocId, title, content,
        (savedDocId) => {
            // Success
            console.log(`Document ${savedDocId} saved successfully.`);
            toastFunc("Document saved!", false);
            statusFunc('Saved');
            hasUnsavedChanges = false;
            currentEditingDocId = savedDocId; // Update ID if it was a new doc
            if(saveButton) loadingButtonFunc(saveButton, false); // Re-enable button

            // Refresh document list to show changes/new doc
            documents.fetchDocuments(db, currentUser.uid, (docs) => {
                if (typeof ui !== 'undefined') ui.renderDocumentList(docs);
            }, (err) => {
                 console.error("Error refreshing list after save:", err);
                 toastFunc("Error refreshing document list.", true);
            });
        },
        (error) => {
            // Error
            console.error("Error saving document:", error);
            toastFunc(`Error saving: ${error.message}`, true);
            statusFunc('Save failed');
            if(saveButton) loadingButtonFunc(saveButton, false); // Re-enable button
        }
    );
}

/**
 * Handles clicks within the document list using event delegation.
 * Determines if an edit or delete action was triggered.
 * @param {Event} event - The click event object.
 */
function handleDocumentListClick(event) {
    console.log("handleDocumentListClick function CALLED");
    const target = event.target;
    const docItem = target.closest('.document-item');
    if (!docItem) {
         console.log("Click outside relevant item in list.");
         return;
    }

    const docId = docItem.dataset.id;
    if (!docId) {
         console.warn("Clicked item has no data-id attribute.");
         return;
    }

    // Check if delete button was clicked
    if (target.closest('.delete-button')) {
        console.log(`-> Delete button clicked for doc: ${docId}`);
        const docTitle = docItem.querySelector('.document-title')?.textContent || 'this document';
        if (typeof ui !== 'undefined') {
            ui.openConfirmDialog(docId, `Are you sure you want to delete "${docTitle}"?`);
        } else {
             handleFatalError("UI module not available for confirm dialog.", new Error("ui module missing"));
        }
    }
    // Check if edit button or document info area was clicked
    else if (target.closest('.edit-button') || target.closest('.document-info')) {
         console.log(`-> Edit action triggered for doc: ${docId}`);
         if (hasUnsavedChanges && !confirm("You have unsaved changes in the editor. Are you sure you want to discard them and load another document?")) {
            console.log("Edit cancelled due to unsaved changes.");
            return;
         }
        loadDocumentIntoEditor(docId);
    }
}

/**
 * Loads a specific document's data into the editor modal.
 * @param {string} docId - The ID of the document to load.
 */
function loadDocumentIntoEditor(docId) {
    console.log(`loadDocumentIntoEditor CALLED for docId: ${docId}`);
    // Use ui module functions if available
    const toastFunc = typeof ui !== 'undefined' ? ui.showToast : console.error;
    const loadingFunc = typeof ui !== 'undefined' ? ui.setLoading : ()=>{}; // App loading state? Or modal loading state?
    const openEditorFunc = typeof ui !== 'undefined' ? ui.openEditor : ()=>{};
    const statusFunc = typeof ui !== 'undefined' ? ui.updateSaveStatus : ()=>{};

    if (!currentUser) {
         toastFunc("Not logged in.", true);
         return;
    }
     if (typeof documents === 'undefined' || !db) {
         handleFatalError("Documents module or DB not ready for loading.", new Error("DB/Documents module missing"));
         return;
    }

    loadingFunc(true); // Show loading state (maybe refine this later)
    console.log(`Fetching doc ${docId} for editor...`);

    documents.fetchSingleDocument(db, docId, currentUser.uid,
        (docData) => {
            if (docData) {
                currentEditingDocId = docId;
                hasUnsavedChanges = false;
                openEditorFunc(docData.title, docData.content); // Populate editor
                statusFunc(''); // Clear status
                loadingFunc(false);
                console.log(`Doc ${docId} loaded into editor.`);
            } else {
                // Document might have been deleted or doesn't belong to user
                toastFunc("Error: Document not found or access denied.", true);
                loadingFunc(false);
                console.error(`Document ${docId} not found or user ${currentUser.uid} mismatch.`);
            }
        },
        (error) => {
            console.error(`Error fetching document ${docId}:`, error);
            toastFunc(`Error loading document: ${error.message}`, true);
            loadingFunc(false);
        }
    );
}

/**
 * Handles the confirmation of a document deletion from the dialog.
 */
function handleConfirmDelete() {
    console.log("handleConfirmDelete CALLED");
     // Use ui module functions if available
    const toastFunc = typeof ui !== 'undefined' ? ui.showToast : console.error;
    const closeDialogFunc = typeof ui !== 'undefined' ? ui.closeConfirmDialog : ()=>{};
    const loadingButtonFunc = typeof ui !== 'undefined' ? ui.setButtonLoading : ()=>{};
    const removeUIFunc = typeof ui !== 'undefined' ? ui.removeDocumentFromList : ()=>{};
    const confirmButton = document.getElementById('confirmButton');
    const dialog = document.getElementById('confirmDialog');

    const docId = dialog?.dataset.docId; // Get ID stored on dialog

    if (!docId || !currentUser) {
        toastFunc("Error: Cannot delete document (missing ID or user).", true);
        closeDialogFunc();
        return;
    }
     if (typeof documents === 'undefined' || !db) {
         handleFatalError("Documents module or DB not ready for deleting.", new Error("DB/Documents module missing"));
         return;
    }


    console.log(`Confirmed deletion for doc: ${docId}`);
    if(confirmButton) loadingButtonFunc(confirmButton, true); // Disable button

    documents.deleteDocument(db, docId, currentUser.uid,
        () => {
            // Success
            console.log(`Document ${docId} deleted successfully.`);
            toastFunc("Document deleted.", false);
            closeDialogFunc();
            // No need to re-enable button as dialog closes
            removeUIFunc(docId); // Optimistic UI update
        },
        (error) => {
            // Error
            console.error(`Error deleting document ${docId}:`, error);
            toastFunc(`Error deleting document: ${error.message}`, true);
            closeDialogFunc();
            // No need to re-enable button as dialog closes (state is reset on open)
        }
    );
}

// --- Event Listener Setup Function ---

/**
 * Sets up global event listeners for UI elements.
 * Assumes handler functions (like handleNewDocument) are defined above.
 */
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Check if UI module is available before adding listeners that depend on it
    const uiAvailable = typeof ui !== 'undefined';

    // Logout Button
    document.getElementById('logoutButton')?.addEventListener('click', handleLogout);

    // New Document Button
    document.getElementById('newDocButton')?.addEventListener('click', handleNewDocument);

    // Document List Click (Event Delegation)
    document.getElementById('documentList')?.addEventListener('click', handleDocumentListClick);

    // Editor related listeners - only add if UI module is present
    if (uiAvailable) {
        document.getElementById('closeEditorButton')?.addEventListener('click', handleCloseEditor);
        document.getElementById('saveDocButton')?.addEventListener('click', handleSaveDocument);

        // Editor Input Change Detection (adapt for rich text if necessary)
        document.getElementById('documentTitle')?.addEventListener('input', () => { hasUnsavedChanges = true; ui.updateSaveStatus('Unsaved changes'); });
        document.getElementById('documentContent')?.addEventListener('input', () => { hasUnsavedChanges = true; ui.updateSaveStatus('Unsaved changes'); });

        // Confirmation Dialog Buttons
        document.getElementById('cancelButton')?.addEventListener('click', ui.closeConfirmDialog);
        document.getElementById('confirmButton')?.addEventListener('click', handleConfirmDelete);
        document.getElementById('closeConfirmButton')?.addEventListener('click', ui.closeConfirmDialog);
    } else {
        console.warn("UI module not found, skipping setup for editor/dialog listeners.");
    }

    console.log("Event listeners setup process complete.");
}


// --- Main Initialization Logic (Runs on DOMContentLoaded) ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing app...");

    // Comprehensive Initialization Checks
    let errorMsg = "Critical setup error: ";
    let setupOk = true;
    if (typeof firebase === 'undefined') { errorMsg += "Firebase SDK missing. "; setupOk = false; }
    if (typeof window.firebaseConfig === 'undefined' || window.firebaseConfig.apiKey.startsWith("YOUR_")) { errorMsg += "Firebase config invalid. "; setupOk = false; }
    if (typeof authModule === 'undefined') { errorMsg += "Auth module missing. "; setupOk = false; }
    if (typeof ui === 'undefined') { errorMsg += "UI module missing. "; setupOk = false; } // Check UI module
    if (typeof documents === 'undefined') { errorMsg += "Documents module missing. "; setupOk = false; } // Check Documents module

    if (!setupOk) {
         handleFatalError(errorMsg + "Check console and script includes."); // handleFatalError is defined above
         console.error(errorMsg, "Check HTML script tags in app.html and ensure all JS files load correctly.");
         return; // Stop execution if setup is incomplete
    }

    // Proceed with initialization if checks pass
    try {
        // Initialize Firebase App (only if not done already)
        if (firebase.apps.length === 0) {
            console.log("Initializing Firebase App from app.js...");
            firebase.initializeApp(window.firebaseConfig);
            console.log("Firebase App initialized by app.js");
        } else {
             console.log("Firebase App already initialized (app.js check).");
        }
        // Get Firestore instance
        db = firebase.firestore();
        console.log("Firestore Initialized.");

        // Initialize Auth Module (which sets up its internal listener)
        authModule.initFirebaseAuth();

        // Register OUR callback function to react to auth state changes
        authModule.onAuthStateChange(handleAuthStateChangedInApp); // handleAuthStateChangedInApp is defined above

        // Setup Global Event Listeners (requires handlers to be defined above)
        setupEventListeners(); // setupEventListeners and its handlers are defined above

        console.log("App initialization sequence complete.");

    } catch (error) {
        // Catch any unexpected errors during the init sequence
        handleFatalError(`App initialization error: ${error.message}`, error); // handleFatalError is defined above
    }
});