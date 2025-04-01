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
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = '<div style="padding: 20px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; text-align: center;">Application cannot start. Configuration or script loading error. Check the console.</div>';
        }
        return;
    }

    // --- DOM Elements ---
    const newDocButton = document.getElementById('newDocButton');
    const documentList = document.getElementById('documentList');
    const editorModal = document.getElementById('editorModal');
    const saveDocButton = document.getElementById('saveDocButton');
    const closeEditorButton = document.getElementById('closeEditorButton');
    const versionListContainer = document.getElementById('versionListContainer');
    const logoutButton = document.getElementById('logoutButton');
    const confirmRevertButton = document.getElementById('confirmRevertButton');
    const cancelPreviewButton = document.getElementById('cancelPreviewButton');

    // --- State ---
    let currentUser = null;
    let currentFirestore = null;
    let isPreviewing = false;       // Track if editor is in preview mode
    let originalDocContent = null;  // Store {title, content} before previewing
    let previewedVersionId = null;  // Store the ID of the version being previewed

    // --- Initialization ---
    function initializeApp() {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
                console.log("Firebase App Initialized by app.js");
            } else {
                firebase.app();
                console.log("Firebase App already initialized.");
            }

            const authInstance = firebase.auth();
            currentFirestore = firebase.firestore();

            authModule.initFirebaseAuth(authInstance);
            documentsModule.init(currentFirestore);

            setupAuthListener(authInstance);
            setupEventListeners();

            console.log("Application initialized successfully.");

        } catch (error) {
            console.error("Error initializing Firebase or modules in app.js:", error);
            uiModule.showToast("Error initializing application. Check console.", true, 10000);
        }
    }

    // --- Auth Listener ---
    function setupAuthListener(authInstance) {
        authModule.onAuthStateChange((user, error) => {
            if (error) {
                console.error("Auth state error received in app.js:", error);
                uiModule.showToast("Authentication error.", true);
                return;
            }
            if (user) {
                currentUser = user;
                console.log("User logged in:", currentUser.uid);
                uiModule.updateUserInfo(currentUser.email);
                loadUserDocuments();
            } else {
                currentUser = null;
                console.log("User logged out or not signed in.");
                uiModule.updateUserInfo(null);
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
             return;
        }
        uiModule.showLoading('Loading documents...');
        if(documentList) documentList.classList.add('hidden');

        try {
            const docs = await documentsModule.getUserDocuments(currentUser.uid);
            uiModule.displayDocuments(docs);
        } catch (error) {
            console.error('Error loading documents:', error);
            // Check if it's an index error specifically
             if (error.code === 'failed-precondition' && error.message.includes('index')) {
                 uiModule.showToast('Database setup needed. Follow console instructions to create an index.', true, 15000);
                 console.error("Firestore Index Required:", error.message); // Log the full error again
             } else {
                 uiModule.showToast('Failed to load documents.', true);
             }
            uiModule.displayDocuments([]); // Display empty state
        } finally {
            uiModule.hideLoading();
        }
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                 authModule.signOutUser ? authModule.signOutUser() : firebase.auth().signOut();
            });
        }
        if (newDocButton) {
            newDocButton.addEventListener('click', handleNewDocument);
        }
        if (documentList) {
            documentList.addEventListener('click', handleDocumentListClick);
        }
        if (saveDocButton) {
            saveDocButton.addEventListener('click', handleSaveDocument);
        }
        if (closeEditorButton) {
            closeEditorButton.addEventListener('click', () => uiModule.closeEditor());
        }
        // Listen on version list for "View" button clicks
        if (versionListContainer) {
             versionListContainer.addEventListener('click', handleVersionListClick);
        }
        // Listeners for new preview/revert buttons
        if (confirmRevertButton) {
            confirmRevertButton.addEventListener('click', handleConfirmRevert);
        }
        if (cancelPreviewButton) {
            cancelPreviewButton.addEventListener('click', handleCancelPreview);
        }
    }

    // --- Event Handlers ---

    async function handleNewDocument() {
        if (!currentUser) { uiModule.showToast("Please log in first.", true); return; }
        const title = prompt("Enter title for new document:", "Untitled Document");
        if (title === null) return;

        uiModule.showLoading('Creating document...');
        try {
            const newDocId = await documentsModule.createDocument(currentUser.uid, title, "");
            uiModule.showToast('Document created!');
            const newDocData = await documentsModule.getDocument(newDocId);
            loadUserDocuments(); // Reload list
            handleOpenEditor(newDocData); // Open the new doc
        } catch (error) {
            console.error('Error creating document:', error);
            uiModule.showToast(`Failed to create document: ${error.message}`, true);
        } finally { uiModule.hideLoading(); }
    }

    async function handleOpenEditor(docData) {
         if (!currentUser || !docData || !docData.id) { return; }

         isPreviewing = false; // Reset state
         originalDocContent = null;
         previewedVersionId = null;
         uiModule.setEditingState('normal'); // Ensure normal state

         uiModule.openEditor(docData); // Populates fields

         // Fetch and display versions
         try {
              const versions = await documentsModule.getVersions(docData.id);
              uiModule.displayVersions(versions);
         } catch (error) {
              console.error(`Error loading versions for doc ${docData.id}:`, error);
              uiModule.displayVersions([]);
              uiModule.showToast('Could not load document versions.', true);
         }
    }

    async function handleDocumentListClick(event) {
        const target = event.target;
        const deleteButton = target.closest('.delete-button');
        if (deleteButton) {
            const docItem = deleteButton.closest('.document-item');
            const docId = docItem?.dataset.docId;
            const docTitle = docItem?.querySelector('.document-title')?.textContent || 'this document';
            if (docId && currentUser) handleDeleteClick(docId, docTitle);
            return;
        }
        const docInfo = target.closest('.document-info');
        const docItem = target.closest('.document-item');
        if (docInfo && docItem) {
            const docId = docItem.dataset.docId;
            if (docId && currentUser) {
                uiModule.showLoading('Opening document...');
                try {
                    const docData = await documentsModule.getDocument(docId);
                    handleOpenEditor(docData);
                } catch (error) {
                    console.error("Error fetching document to open:", error);
                    uiModule.showToast("Failed to open document.", true);
                } finally { uiModule.hideLoading(); }
            }
        }
    }

    async function handleSaveDocument() {
        // Prevent saving while previewing
        if (isPreviewing || !currentUser || !saveDocButton) return;

        const docId = editorModal?.dataset.docId;
        const titleInput = document.getElementById('documentTitle');
        const contentInput = document.getElementById('documentContent');
        if (!docId || !titleInput || !contentInput) { return; }

        const title = titleInput.value;
        const content = contentInput.value;

        saveDocButton.disabled = true;
        uiModule.setSaveStatus('Saving...');
        try {
            // --- MODIFIED LINE: Capture the result ---
            // Assuming saveDocument now returns { ..., lastUpdated: newTimestamp } or just newTimestamp
            const saveResult = await documentsModule.saveDocument(currentUser.uid, docId, title, content); 
            
            // --- ADDED LINE: Update the current version display ---
            // Adjust based on what saveDocument actually returns (e.g., saveResult.lastUpdated or just saveResult)
            if (saveResult && saveResult.lastUpdated) { 
                 uiModule.updateCurrentVersionTimestamp(saveResult.lastUpdated); 
            } else {
                 console.warn("Save successful, but couldn't get updated timestamp to update UI.");
                 // Optionally, try fetching the doc again here to get the timestamp
            }
    
            uiModule.setSaveStatus('Saved!');
            uiModule.showToast('Document saved successfully.');
            loadUserDocuments(); // Refresh list
            
            // Refresh versions list in editor
            const versions = await documentsModule.getVersions(docId);
            uiModule.displayVersions(versions);
    
        } catch (error) {
            console.error('Error saving document:', error);
            uiModule.showToast(`Failed to save document: ${error.message}`, true);
            uiModule.setSaveStatus('Error saving.');
        } finally {
             setTimeout(() => {
                 if (editorModal?.classList.contains('active') && saveDocButton) {
                     saveDocButton.disabled = false;
                 }
             }, 500);
        }
    }

    function handleDeleteClick(docId, docTitle) {
        uiModule.showConfirmation(
            'Delete Document?',
            `Are you sure you want to delete "${docTitle}"? This includes all its versions and cannot be undone.`,
            async () => {
                uiModule.showLoading('Deleting...');
                try {
                    await documentsModule.deleteDocument(docId);
                    uiModule.showToast('Document deleted.');
                    loadUserDocuments();
                } catch (error) {
                    console.error('Error deleting document:', error);
                    uiModule.showToast(`Failed to delete document: ${error.message}`, true);
                } finally { uiModule.hideLoading(); }
            }
        );
    }

    // --- Version Handling ---

    function handleVersionListClick(event) {
        const viewButton = event.target.closest('.view-version-button');
        if (!viewButton || !currentUser || !editorModal) return;
        const versionId = viewButton.dataset.versionId;
        const docId = editorModal.dataset.docId;
        if (versionId && docId) handleViewVersion(docId, versionId);
    }

    async function handleViewVersion(docId, versionId) {
        const titleInput = document.getElementById('documentTitle');
        const contentInput = document.getElementById('documentContent');
        if (!titleInput || !contentInput) return; // Ensure elements exist

        console.log(`Attempting to view version ${versionId} for doc ${docId}`);
        originalDocContent = { title: titleInput.value, content: contentInput.value }; // Store current state
        isPreviewing = true;
        previewedVersionId = versionId; // Store the ID being previewed

        uiModule.setSaveStatus("Loading version preview...");
        try {
            const versionData = await documentsModule.getVersionById(docId, versionId);
            uiModule.updateEditorContent(versionData.title, versionData.content); // Load preview

            // --- MODIFIED LINE: Pass the timestamp ---
            uiModule.setEditingState('preview', versionData.timestamp); // Pass timestamp here
            // --- END OF MODIFICATION ---
            
        } catch (error) {
            console.error("Error fetching version for preview:", error);
            uiModule.showToast("Failed to load version preview.", true);
            isPreviewing = false; // Reset state on error
            originalDocContent = null;
            previewedVersionId = null;
            uiModule.setEditingState('normal');
            uiModule.setSaveStatus("Preview failed.");
        }
    }

    function handleCancelPreview() {
        if (!isPreviewing || !originalDocContent) { return; }
        console.log("Cancelling preview, restoring original content.");
        uiModule.updateEditorContent(originalDocContent.title, originalDocContent.content); // Restore
        isPreviewing = false; // Reset state
        originalDocContent = null;
        previewedVersionId = null;
        uiModule.setEditingState('normal');
    }

    async function handleConfirmRevert() {
        if (!isPreviewing || !currentUser || !editorModal || !previewedVersionId) { return; }

        const docId = editorModal.dataset.docId;
        if (!docId) { return; } // Should have docId if modal is open

        console.log(`Confirming revert for doc ${docId} to version ${previewedVersionId}`);
        uiModule.setSaveStatus('Reverting...');
        if(confirmRevertButton) confirmRevertButton.disabled = true;
        if(cancelPreviewButton) cancelPreviewButton.disabled = true;

        try {
            // Use the stored version ID for the revert operation
            await documentsModule.revertToVersion(currentUser.uid, docId, previewedVersionId);

            // Editor already shows the correct content from the preview
            uiModule.setSaveStatus('Reverted successfully.');
            uiModule.showToast('Document reverted.');

            isPreviewing = false; // Reset state
            originalDocContent = null;
            previewedVersionId = null;
            uiModule.setEditingState('normal');

            // Refresh lists
            loadUserDocuments();
            const newVersions = await documentsModule.getVersions(docId);
            uiModule.displayVersions(newVersions);

        } catch (error) {
            console.error('Error confirming revert:', error);
            uiModule.showToast(`Failed to revert document: ${error.message}`, true);
            uiModule.setSaveStatus('Revert failed.');
            // Don't reset state here, allow user to cancel or retry?
            // Re-enable buttons if revert failed
             if(confirmRevertButton) confirmRevertButton.disabled = false;
             if(cancelPreviewButton) cancelPreviewButton.disabled = false;
        }
    }

    // --- Start the application ---
    initializeApp();

}); // End DOMContentLoaded