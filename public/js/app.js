// public/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Module & Firebase Sanity Checks ---
    let firebaseReady = typeof firebase !== 'undefined';
    let configReady = typeof window.firebaseConfig !== 'undefined' && !window.firebaseConfig.apiKey.startsWith("YOUR_");
    let authModuleReady = typeof authModule !== 'undefined';
    let uiModuleReady = typeof uiModule !== 'undefined';
    let documentsModuleReady = typeof documentsModule !== 'undefined';

    if (!firebaseReady || !configReady || !authModuleReady || !uiModuleReady || !documentsModuleReady) {
        console.error("Critical Setup Error: Missing Firebase SDK, invalid config, or essential JS modules (auth, ui, documents).");
        // Attempt to inform the user visually if possible
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = '<div style="padding: 20px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; text-align: center;">Application cannot start. Configuration or script loading error. Check the console.</div>';
        }
        // Prevent further execution
        return;
    }

    // --- DOM Elements (other than those managed by uiModule) ---
    const newDocButton = document.getElementById('newDocButton');
    const documentList = document.getElementById('documentList'); // For event delegation
    const editorModal = document.getElementById('editorModal'); // To get docId
    const saveDocButton = document.getElementById('saveDocButton');
    const closeEditorButton = document.getElementById('closeEditorButton');
    const versionListContainer = document.getElementById('versionListContainer'); // For event delegation
    const logoutButton = document.getElementById('logoutButton'); // Explicitly grab if needed

    // --- State ---
    let currentUser = null;
    let currentFirestore = null; // Store Firestore instance globally for this script

    // --- Initialization ---
    function initializeApp() {
        try {
            // Initialize Firebase App (defensive check)
            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
                console.log("Firebase App Initialized by app.js");
            } else {
                firebase.app(); // Use existing default app
                console.log("Firebase App already initialized.");
            }

            // Get Firebase Service Instances
            const authInstance = firebase.auth();
            currentFirestore = firebase.firestore(); // Assign to global scope

            // Initialize Modules that depend on Firebase services
            // Pass the instances they need
            authModule.initFirebaseAuth(authInstance);
            documentsModule.init(currentFirestore);
            // uiModule doesn't directly depend on Firebase services

            // Setup core listeners
            setupAuthListener(authInstance); // Pass authInstance if listener needs it directly
            setupEventListeners();

            console.log("Application initialized successfully.");

        } catch (error) {
            console.error("Error initializing Firebase or modules in app.js:", error);
            uiModule.showToast("Error initializing application. Check console.", true, 10000);
            // Optionally disable UI elements here if needed
        }
    }

    // --- Auth Listener ---
    function setupAuthListener(authInstance) {
        // Use the module's listener mechanism
        authModule.onAuthStateChange((user, error) => {
            if (error) {
                console.error("Auth state error received in app.js:", error);
                uiModule.showToast("Authentication error.", true);
                // Force redirect to login on auth errors might be too aggressive
                // Consider just logging or showing a persistent error message
                // window.location.replace('login.html');
                return;
            }

            if (user) {
                // User is signed in.
                currentUser = user; // Store the user object
                console.log("User logged in:", currentUser.uid);
                uiModule.updateUserInfo(currentUser.email); // Update UI with email
                loadUserDocuments(); // Load documents for the logged-in user
            } else {
                // User is signed out.
                currentUser = null;
                console.log("User logged out or not signed in.");
                uiModule.updateUserInfo(null); // Clear user info in UI
                // Redirect to login page if not already there
                if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('index.html')) {
                     window.location.replace('login.html');
                }
            }
        });
    }

    // --- Load User Documents ---
    async function loadUserDocuments() {
        if (!currentUser || !currentFirestore) {
             console.log("Cannot load documents: No user or Firestore instance.");
             return; // Exit if no user or Firestore not initialized
        }

        uiModule.showLoading('Loading documents...');
        documentList.classList.add('hidden'); // Hide list while loading

        try {
            const docs = await documentsModule.getUserDocuments(currentUser.uid);
            uiModule.displayDocuments(docs); // Render the list using the UI module
        } catch (error) {
            console.error('Error loading documents:', error);
            uiModule.showToast('Failed to load documents.', true);
            uiModule.displayDocuments([]); // Display empty state on error
        } finally {
            uiModule.hideLoading();
        }
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Logout Button
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                 // Prefer using authModule's signout if it handles cleanup/state
                 if (authModule && authModule.signOutUser) {
                     authModule.signOutUser();
                 } else {
                     firebase.auth().signOut(); // Direct Firebase call as fallback
                 }
            });
        }

        // New Document Button
        if (newDocButton) {
            newDocButton.addEventListener('click', handleNewDocument);
        }

        // Event Delegation for Document List (Open Editor & Delete)
        if (documentList) {
            documentList.addEventListener('click', handleDocumentListClick);
        }

        // Save Document Button (in Modal)
        if (saveDocButton) {
            saveDocButton.addEventListener('click', handleSaveDocument);
        }

        // Close Editor Button (in Modal)
        if (closeEditorButton) {
            closeEditorButton.addEventListener('click', () => uiModule.closeEditor());
        }

        // Event Delegation for Version List (Revert)
        if (versionListContainer) {
             versionListContainer.addEventListener('click', handleRevertClick);
        }

        // Potential: Add listener for closing modal via background click or ESC key
    }

    // --- Event Handlers ---

    async function handleNewDocument() {
        if (!currentUser) {
             uiModule.showToast("Please log in first.", true);
             return;
        }

        const title = prompt("Enter title for new document:", "Untitled Document");
        if (title === null) return; // User cancelled prompt

        uiModule.showLoading('Creating document...');
        try {
            // Create the document in Firestore
            const newDocId = await documentsModule.createDocument(currentUser.uid, title, "");
            uiModule.showToast('Document created!');

            // Fetch the full data of the newly created document
            const newDocData = await documentsModule.getDocument(newDocId);

            // Option 1: Reload the entire list (simpler)
            loadUserDocuments();

            // Option 2: Add directly to UI (more complex, skipped for simplicity)

            // Automatically open the new document in the editor
            handleOpenEditor(newDocData); // Pass the fetched data

        } catch (error) {
            console.error('Error creating document:', error);
            uiModule.showToast(`Failed to create document: ${error.message}`, true);
        } finally {
            uiModule.hideLoading();
        }
    }

    // Handles opening the editor for a specific document (new or existing)
    async function handleOpenEditor(docData) {
         if (!currentUser || !docData || !docData.id) {
              console.warn("Cannot open editor: Missing user or document data.");
              return;
         }

         // 1. Open the editor and populate title/content
         uiModule.openEditor(docData);

         // 2. Fetch and display versions for this document
         try {
              const versions = await documentsModule.getVersions(docData.id);
              uiModule.displayVersions(versions); // UI module handles rendering
         } catch (error) {
              console.error(`Error loading versions for doc ${docData.id}:`, error);
              uiModule.displayVersions([]); // Show empty/error state in version list
              uiModule.showToast('Could not load document versions.', true);
         }
    }

    // Handles clicks within the main document list (open or delete)
    async function handleDocumentListClick(event) {
        const target = event.target;

        // Check for Delete Button click first
        const deleteButton = target.closest('.delete-button');
        if (deleteButton) {
            const docItem = deleteButton.closest('.document-item');
            const docId = docItem?.dataset.docId;
            const docTitle = docItem?.querySelector('.document-title')?.textContent || 'this document';

            if (docId && currentUser) {
                handleDeleteClick(docId, docTitle); // Pass details to specific delete handler
            }
            return; // Stop processing if delete was clicked
        }

        // Check for click to Open Editor (on the info area)
        const docInfo = target.closest('.document-info');
        const docItem = target.closest('.document-item'); // Still need the item for docId
        if (docInfo && docItem) {
            const docId = docItem.dataset.docId;
            if (docId && currentUser) {
                uiModule.showLoading('Opening document...');
                try {
                    // Fetch the complete, latest document data before opening
                    const docData = await documentsModule.getDocument(docId);
                    handleOpenEditor(docData); // Use the common handler
                } catch (error) {
                    console.error("Error fetching document to open:", error);
                    uiModule.showToast("Failed to open document.", true);
                } finally {
                    uiModule.hideLoading();
                }
            }
        }
    }

    // Handles saving the document currently in the editor
    async function handleSaveDocument() {
        if (!currentUser || !saveDocButton) return;

        const docId = editorModal?.dataset.docId; // Get ID from modal data attribute
        const titleInput = document.getElementById('documentTitle');
        const contentInput = document.getElementById('documentContent');

        if (!docId || !titleInput || !contentInput) {
            console.error("Cannot save: Missing docId or editor input elements.");
            uiModule.showToast("Save failed: Internal error.", true);
            return;
        }

        const title = titleInput.value;
        const content = contentInput.value;

        saveDocButton.disabled = true;
        uiModule.setSaveStatus('Saving...');

        try {
            // Use the versioning-aware save function
            await documentsModule.saveDocument(currentUser.uid, docId, title, content);
            uiModule.setSaveStatus('Saved!');
            uiModule.showToast('Document saved successfully.');

            // Refresh the main document list to show updated timestamp/title
            loadUserDocuments();

            // Refresh the versions list within the editor after saving
            try {
                 const versions = await documentsModule.getVersions(docId);
                 uiModule.displayVersions(versions);
            } catch (verError) {
                 console.error("Failed to refresh versions after save:", verError);
                 // Don't necessarily show error toast here, main save worked
            }

        } catch (error) {
            console.error('Error saving document:', error);
            uiModule.showToast(`Failed to save document: ${error.message}`, true);
            uiModule.setSaveStatus('Error saving.');
        } finally {
            // Re-enable button slightly after status update for better UX
             setTimeout(() => {
                 // Check modal is still open and button exists before enabling
                 if (editorModal?.classList.contains('active') && saveDocButton) {
                     saveDocButton.disabled = false;
                     // Optionally clear status after more time
                     // setTimeout(() => { if (uiModule.setSaveStatus) uiModule.setSaveStatus(''); }, 2000);
                 }
             }, 500);
        }
    }

    // Specific handler for the delete action, initiated by handleDocumentListClick
    function handleDeleteClick(docId, docTitle) {
         // Use the UI confirmation dialog
        uiModule.showConfirmation(
            'Delete Document?',
            `Are you sure you want to delete "${docTitle}"? This includes all its versions and cannot be undone.`,
            async () => { // onConfirm callback
                uiModule.showLoading('Deleting...');
                try {
                    // Use the updated delete function that handles versions (client-side attempt)
                    await documentsModule.deleteDocument(docId);
                    uiModule.showToast('Document deleted.');
                    loadUserDocuments(); // Refresh the list
                } catch (error) {
                    console.error('Error deleting document:', error);
                    uiModule.showToast(`Failed to delete document: ${error.message}`, true);
                } finally {
                    uiModule.hideLoading();
                }
            }
            // onCancel callback is handled internally by uiModule
        );
    }

    // Handles clicks within the version list (currently only Revert)
    function handleRevertClick(event) {
        const revertButton = event.target.closest('.revert-button');
        if (!revertButton || !currentUser || !editorModal) return;

        const versionId = revertButton.dataset.versionId;
        const docId = editorModal.dataset.docId; // Get current doc ID from editor modal

        if (!versionId || !docId) {
            console.error("Missing versionId or docId for revert action.");
            uiModule.showToast("Cannot revert: Internal error.", true);
            return;
        }

        const versionItem = revertButton.closest('.version-item');
        const versionTimestamp = versionItem?.querySelector('.version-timestamp')?.textContent || 'this version';

        // Confirm the revert action
        uiModule.showConfirmation(
            'Revert Document?',
            `Revert to the version from ${versionTimestamp}? The current content will be saved as a new version before reverting.`,
            async () => { // onConfirm callback
                uiModule.setSaveStatus('Reverting...'); // Update editor status
                if(saveDocButton) saveDocButton.disabled = true; // Disable save during revert

                try {
                    // Perform the revert using the documents module function
                    const revertedData = await documentsModule.revertToVersion(currentUser.uid, docId, versionId);

                    // Update the editor fields with the reverted content
                    uiModule.updateEditorContent(revertedData.newTitle, revertedData.newContent);
                    uiModule.setSaveStatus('Reverted successfully.');
                    uiModule.showToast('Document reverted.');

                    // Refresh the version list in the editor immediately
                    const newVersions = await documentsModule.getVersions(docId);
                    uiModule.displayVersions(newVersions);

                    // Refresh the main document list to update the timestamp
                    loadUserDocuments();

                } catch (error) {
                    console.error('Error reverting document:', error);
                    uiModule.showToast(`Failed to revert document: ${error.message}`, true);
                    uiModule.setSaveStatus('Revert failed.');
                } finally {
                    if(saveDocButton) saveDocButton.disabled = false; // Re-enable save button
                }
            }
            // onCancel is handled by uiModule
        );
    }

    // --- Start the application ---
    initializeApp();
});