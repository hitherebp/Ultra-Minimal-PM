// public/js/ui.js

const uiModule = (() => {
    // --- DOM Element Selectors ---
    const toastElement = document.getElementById('statusToast');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const documentListContainer = document.getElementById('documentList');
    const userEmailSpan = document.getElementById('userEmail');

    // Editor Modal Elements
    const editorModal = document.getElementById('editorModal');
    const documentTitleInput = document.getElementById('documentTitle');
    const documentContentInput = document.getElementById('documentContent');
    const saveStatusSpan = document.getElementById('saveStatus');
    const closeEditorButton = document.getElementById('closeEditorButton');
    const saveDocButton = document.getElementById('saveDocButton');
    const versionListContainer = document.getElementById('versionListContainer'); // For versions

    // Confirmation Dialog Elements
    const confirmDialog = document.getElementById('confirmDialog');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmButton = document.getElementById('confirmButton');
    const cancelButton = document.getElementById('cancelButton');
    const closeConfirmButton = document.getElementById('closeConfirmButton');

    let toastTimeout = null; // To manage the toast timer

    // --- Toast Notifications ---
    function showToast(message, isError = false, duration = 3000) {
        if (!toastElement) return;

        toastElement.textContent = message;
        toastElement.className = 'status-toast'; // Reset classes
        if (isError) {
            toastElement.classList.add('error');
        }
        toastElement.classList.add('visible');

        // Clear existing timeout if any
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        // Set new timeout to hide
        toastTimeout = setTimeout(() => {
            toastElement.classList.remove('visible');
            toastTimeout = null; // Reset timeout variable
        }, duration);
    }

    // --- Loading Indicator ---
    function showLoading(message = 'Loading...') {
        if (!loadingIndicator) return;
        const messageElement = loadingIndicator.querySelector('p');
        if (messageElement) messageElement.textContent = message;
        loadingIndicator.classList.remove('hidden');
    }

    function hideLoading() {
        if (!loadingIndicator) return;
        loadingIndicator.classList.add('hidden');
    }

    // --- User Info Display ---
    function updateUserInfo(email) {
        if (userEmailSpan) {
            userEmailSpan.textContent = email || 'Not logged in';
            userEmailSpan.title = email ? `Logged in as ${email}` : '';
        }
    }

    // --- Document List Display ---
    function displayDocuments(docs) {
        if (!documentListContainer) return;
        hideLoading(); // Ensure loading indicator is hidden

        if (!docs || docs.length === 0) {
            documentListContainer.innerHTML = '<p>No documents found. Create one!</p>';
            documentListContainer.classList.remove('hidden'); // Show the container even if empty
            return;
        }

        let docsHtml = '';
        docs.forEach(doc => {
            // Format timestamp (handle potential server timestamps)
            let updatedDateStr = 'N/A';
            if (doc.lastUpdated && doc.lastUpdated.toDate) {
                updatedDateStr = doc.lastUpdated.toDate().toLocaleString();
            } else if (doc.lastUpdated) {
                // Fallback if it's already a string or number? Adjust as needed.
                 try { updatedDateStr = new Date(doc.lastUpdated).toLocaleString(); } catch (e) {}
            }

            docsHtml += `
                <div class="document-item" data-doc-id="${doc.id}">
                    <div class="document-info">
                        <span class="document-title">${doc.title || 'Untitled Document'}</span>
                        <span class="document-meta">Last updated: ${updatedDateStr}</span>
                    </div>
                    <div class="document-actions">
                         <!-- Use specific class for delete -->
                        <button class="action-button delete-button" title="Delete Document" data-doc-id="${doc.id}" aria-label="Delete Document">
                            🗑️
                        </button>
                         <!-- Edit button is implicit by clicking document-info -->
                    </div>
                </div>
            `;
        });

        documentListContainer.innerHTML = docsHtml;
        documentListContainer.classList.remove('hidden'); // Ensure it's visible
    }

    // --- Editor Modal ---
    function openEditor(doc = { id: null, title: '', content: '' }) {
        if (!editorModal || !documentTitleInput || !documentContentInput || !saveStatusSpan || !saveDocButton || !versionListContainer) {
             console.error("Editor elements not found!");
             return;
        }
        // Store current doc id using a data attribute on the modal itself
        editorModal.dataset.docId = doc.id || '';

        documentTitleInput.value = doc.title || '';
        documentContentInput.value = doc.content || '';
        saveStatusSpan.textContent = ''; // Clear status on open
        saveDocButton.disabled = false; // Ensure save is enabled

        // Clear previous versions and show loading state
        versionListContainer.innerHTML = '<p class="loading-versions">Loading versions...</p>';

        editorModal.classList.add('active');
        documentTitleInput.focus(); // Focus title input
    }

    function closeEditor() {
        if (!editorModal) return;
        editorModal.classList.remove('active');
        editorModal.dataset.docId = ''; // Clear the stored document ID
        // Optional: Clear the form fields
        // documentTitleInput.value = '';
        // documentContentInput.value = '';
        // Clear versions list when closing
        if (versionListContainer) versionListContainer.innerHTML = '';
        saveStatusSpan.textContent = ''; // Clear status
    }

    function setSaveStatus(status) {
        if (saveStatusSpan) {
            saveStatusSpan.textContent = status;
        }
    }

    // --- NEW: Update Editor Content (e.g., after revert) ---
    function updateEditorContent(title, content) {
         if(documentTitleInput) documentTitleInput.value = title;
         if(documentContentInput) documentContentInput.value = content;
         // Optionally update status or clear it
         // setSaveStatus('Reverted. Save if you wish to keep changes.');
    }

    // --- NEW: Display Versions in Editor ---
    function displayVersions(versions) {
        if (!versionListContainer) return;

        if (!versions || versions.length === 0) {
            versionListContainer.innerHTML = '<p class="no-versions">No previous versions found.</p>';
            return;
        }

        let versionsHtml = '<h4>Previous Versions:</h4><ul>';
        versions.forEach(version => {
            // --- START: Modified Date Formatting ---
            let formattedDate = 'Unknown date';
            try {
                 if (version.timestamp && version.timestamp.toDate) {
                     const dateObj = version.timestamp.toDate();
                     // Example: "Mar 30, 2024, 10:15 AM" - Adjust options as needed
                     const options = {
                         month: 'short', // e.g., 'Mar'
                         day: 'numeric',   // e.g., '30'
                         year: 'numeric', // e.g., '2024' (Optional, remove for shorter)
                         hour: 'numeric',   // e.g., '10'
                         minute: '2-digit', // e.g., '15'
                         hour12: true      // Use AM/PM
                     };
                     formattedDate = dateObj.toLocaleString(undefined, options); // Use locale defaults

                     // --- Alternative Shorter Format ---
                     // const optionsShort = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
                     // formattedDate = dateObj.toLocaleTimeString(undefined, optionsShort);

                 } else if (version.timestamp) {
                     // Fallback for non-firestore timestamps (less likely)
                     formattedDate = new Date(version.timestamp).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
                 }
            } catch (e) { console.warn("Error formatting version date:", e); }
            // --- END: Modified Date Formatting ---


            // Use textContent to prevent XSS if title comes from user input
            const safeTitle = version.title || 'Untitled';

            versionsHtml += `
                <li class="version-item" data-version-id="${version.id}">
                    <span class="version-timestamp" title="${escapeHtml(safeTitle)} - ${formattedDate}">${formattedDate}</span>
                    <button class="button small secondary revert-button" data-version-id="${version.id}" aria-label="Revert to this version">Revert</button>
                    <!-- Optional: Add a 'View' button later -->
                </li>
            `;
        });
        versionsHtml += '</ul>';
        versionListContainer.innerHTML = versionsHtml;
    }

    // --- Confirmation Dialog ---
    function showConfirmation(title, message, onConfirmCallback) {
        // Get references to the NON-replaced dialog elements first
        const dialogContainer = document.getElementById('confirmDialog'); // Renamed for clarity
        const titleElement = document.getElementById('confirmTitle');     // Renamed for clarity
        const messageElement = document.getElementById('confirmMessage');   // Renamed for clarity

        // **Crucial Change: Re-select buttons *inside* the function**
        const currentConfirmButton = document.getElementById('confirmButton');
        const currentCancelButton = document.getElementById('cancelButton');
        const currentCloseButton = document.getElementById('closeConfirmButton'); // Renamed for clarity

        // Check if ALL required elements exist *now*
        if (!dialogContainer || !titleElement || !messageElement || !currentConfirmButton || !currentCancelButton || !currentCloseButton) {
            console.error("Confirmation dialog elements (or buttons) not found!");
            // Maybe show a generic error toast if buttons are missing now
            showToast("Error showing confirmation dialog.", true);
            return; // Exit if any element is missing
        }

        // Update title and message
        titleElement.textContent = title;
        messageElement.textContent = message;

        // --- Button Cloning and Listener Removal ---
        // Clone the *currently active* buttons found above
        const newConfirmButton = currentConfirmButton.cloneNode(true);
        currentConfirmButton.parentNode?.replaceChild(newConfirmButton, currentConfirmButton);

        const newCancelButton = currentCancelButton.cloneNode(true);
        currentCancelButton.parentNode?.replaceChild(newCancelButton, currentCancelButton);

        const newCloseButton = currentCloseButton.cloneNode(true);
        currentCloseButton.parentNode?.replaceChild(newCloseButton, currentCloseButton);
        // --- End of Cloning ---

        // --- Add New Listeners to the Cloned Buttons ---
        const closeHandler = () => {
            dialogContainer.classList.remove('active');
        };

        newConfirmButton.onclick = () => {
            closeHandler();
            if (typeof onConfirmCallback === 'function') {
                try {
                    onConfirmCallback();
                } catch (e) {
                     console.error("Error executing confirmation callback:", e);
                     showToast("An error occurred performing the action.", true);
                }
            }
        };

        newCancelButton.onclick = closeHandler;
        newCloseButton.onclick = closeHandler; // Use the new variable name
        // --- End of Listener Assignment ---

        // Make the dialog visible
        dialogContainer.classList.add('active');
    }

    // --- Utility: Simple HTML Escaping ---
    function escapeHtml(unsafe) {
        // Ensure input is a string
        const str = String(unsafe || '');

        // Perform the replacements using the correct entities in strings
        return str
             .replace(/&/g, "&amp;")     // Replace & with &amp;
             .replace(/</g, "&lt;")      // Replace < with &lt;
             .replace(/>/g, "&gt;")      // Replace > with &gt;
             .replace(/"/g, "&quot;")   // Replace " with &quot;
             .replace(/'/g, "&#039;");   // Replace ' with &#039; (safer entity)
     }

    // --- Public API ---
    return {
        showToast,
        showLoading,
        hideLoading,
        updateUserInfo,
        displayDocuments,
        openEditor,
        closeEditor,
        setSaveStatus,
        updateEditorContent, // Expose function to update editor fields
        displayVersions,     // Expose function to show versions
        showConfirmation
    };
})();