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
    const toggleVersionsButton = document.getElementById('toggleVersionsButton'); // New Button
    const previewStatusMessage = document.getElementById('previewStatusMessage'); // Preview Status Message
    const currentVersionInfo = document.getElementById('currentVersionInfo'); // Current Version Info



    // --- Initialize state of hide/view version button ---
    if (toggleVersionsButton && versionListContainer) {
        // 1. Ensure the sidebar is NOT collapsed when the modal opens
        versionListContainer.classList.remove('collapsed'); 

        // 2. Set the correct initial text/title for the button
        toggleVersionsButton.textContent = 'Hide Versions'; 
        toggleVersionsButton.title = 'Hide Versions Sidebar';
    }
    // --- End initialization ---


    // New buttons for preview/revert flow
    const confirmRevertButton = document.getElementById('confirmRevertButton');
    const cancelPreviewButton = document.getElementById('cancelPreviewButton');

    // Confirmation Dialog Elements (for Delete)
    const confirmDialog = document.getElementById('confirmDialog');
    // const confirmTitle = document.getElementById('confirmTitle'); // Managed inside showConfirmation
    // const confirmMessage = document.getElementById('confirmMessage'); // Managed inside showConfirmation
    // const confirmButton = document.getElementById('confirmButton'); // Managed inside showConfirmation
    // const cancelButton = document.getElementById('cancelButton'); // Managed inside showConfirmation
    // const closeConfirmButton = document.getElementById('closeConfirmButton'); // Managed inside showConfirmation

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
            let updatedDateStr = 'N/A';
            if (doc.lastUpdated && doc.lastUpdated.toDate) {
                updatedDateStr = doc.lastUpdated.toDate().toLocaleString();
            } else if (doc.lastUpdated) {
                 try { updatedDateStr = new Date(doc.lastUpdated).toLocaleString(); } catch (e) {}
            }

            docsHtml += `
                <div class="document-item" data-doc-id="${doc.id}">
                    <div class="document-info">
                        <span class="document-title">${escapeHtml(doc.title) || 'Untitled Document'}</span>
                        <span class="document-meta">Last updated: ${updatedDateStr}</span>
                    </div>
                    <div class="document-actions">
                        <button class="action-button delete-button" title="Delete Document" data-doc-id="${doc.id}" aria-label="Delete Document">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        documentListContainer.innerHTML = docsHtml;
        documentListContainer.classList.remove('hidden'); // Ensure it's visible
    }

    // --- Editor Modal ---
    function openEditor(doc = { id: null, title: '', content: '' }) {
        // Ensure all required elements are present
        if (!editorModal || !documentTitleInput || !documentContentInput || !saveStatusSpan || !saveDocButton || !versionListContainer || !currentVersionInfo) { // Added currentVersionInfo check
             console.error("Editor elements not found!");
             showToast("Error opening editor.", true); // Inform user
             return;
        }
        
        // Store current doc id using a data attribute on the modal itself
        editorModal.dataset.docId = doc.id || '';

        // Set initial content
        documentTitleInput.value = doc.title || '';
        documentContentInput.value = doc.content || '';

        // --- ADDED: LOGIC FOR CURRENT VERSION INFO ---
        if (currentVersionInfo) { // Check if the element exists
            let currentTimestampStr = 'N/A (New Document)'; // Default for new docs
            if (doc.lastUpdated) { // Check if lastUpdated exists
                try {
                    // Handle both Firestore Timestamps and standard Date objects/strings
                    const dateObj = doc.lastUpdated.toDate ? doc.lastUpdated.toDate() : new Date(doc.lastUpdated);
                    // Define formatting options
                    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
                    // Format the date
                    currentTimestampStr = dateObj.toLocaleString(undefined, options);
                } catch (e) {
                    console.warn("Error formatting current doc date:", e);
                    currentTimestampStr = 'Invalid Date'; // Fallback on error
                }
            }
            // Update the HTML of the placeholder div
            currentVersionInfo.innerHTML = `<span class="label">Current:</span> ${escapeHtml(currentTimestampStr)}`; // Use escapeHtml for safety
        } else {
            console.warn("currentVersionInfo element not found"); // Log if element is missing
        }
        // --- END OF ADDED LOGIC ---

        // Ensure normal editing state on open
        setEditingState('normal'); // Set default state (shows Save, hides Revert/Cancel, enables inputs)

        // Clear previous versions list and show loading state
        if (versionListContainer) {
             versionListContainer.innerHTML = '<p class="loading-versions">Loading versions...</p>'; // Clear old versions
        }
        
        // --- ADDED: Initialize toggle button state ---
        if (toggleVersionsButton && versionListContainer) {
            versionListContainer.classList.remove('collapsed'); // Ensure sidebar is expanded
            toggleVersionsButton.textContent = 'Hide Versions'; // Set correct button text
            toggleVersionsButton.title = 'Hide Versions Sidebar'; // Set correct tooltip
        }
        // --- END of toggle button init ---

        // Show the modal
        editorModal.classList.add('active');
        documentTitleInput.focus(); // Focus title input for convenience
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
        // Ensure state is reset on close
        setEditingState('normal');
    }

    // Event listener
    if (toggleVersionsButton && versionListContainer) {
        toggleVersionsButton.addEventListener('click', () => {
            versionListContainer.classList.toggle('collapsed');
            
            // Optional: Change button text based on state
            if (versionListContainer.classList.contains('collapsed')) {
                toggleVersionsButton.textContent = 'Show Versions';
                toggleVersionsButton.title = 'Show Versions Sidebar';
            } else {
                toggleVersionsButton.textContent = 'Hide Versions'; // Or just 'Versions'
                toggleVersionsButton.title = 'Hide Versions Sidebar';
            }
        });
    } else {
        console.error("Could not find toggle button or version list container elements.");
    }
    
    function setSaveStatus(status) {
        if (saveStatusSpan) {
            saveStatusSpan.textContent = status;
        }
    }

    // Updates the editor fields (title and content)
    function updateEditorContent(title, content) {
         if(documentTitleInput) documentTitleInput.value = title;
         if(documentContentInput) documentContentInput.value = content;
    }

    // --- Manage Editor State (Normal vs Preview) ---
    function setEditingState(state, previewTimestamp = null) { 
        // Ensure all required elements exist before proceeding
        if (!saveDocButton || !confirmRevertButton || !cancelPreviewButton || !saveStatusSpan || !previewStatusMessage || !documentContentInput) {
            console.warn("Cannot set editing state: One or more required elements missing.");
            return;
        }

        if (state === 'preview') {
            // --- Entering Preview Mode ---
            saveDocButton.classList.add('hidden');          // Hide Save
            confirmRevertButton.classList.remove('hidden'); // Show Confirm Revert
            cancelPreviewButton.classList.remove('hidden'); // Show Cancel Preview
            
            // --- MODIFIED: Format timestamp and set message ---
            let statusText = 'Previewing previous version';
            if (previewTimestamp) { // Check if timestamp was passed
                try {
                    const dateObj = previewTimestamp.toDate ? previewTimestamp.toDate() : new Date(previewTimestamp);
                    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
                    const formattedDate = dateObj.toLocaleString(undefined, options);
                    statusText += `: ${escapeHtml(formattedDate)}`; // Append formatted date
                } catch (e) {
                    console.warn("Error formatting preview timestamp:", e);
                    statusText += ' (date unavailable)'; // Fallback
                }
            }
            previewStatusMessage.textContent = statusText; // Set the combined text
            // --- END OF MODIFICATION ---
            


            previewStatusMessage.classList.remove('hidden');
            saveStatusSpan.textContent = ''; // Clear the old status span

            // Disable editing
            saveDocButton.disabled = true; 
            documentContentInput.disabled = true; 
            // Optional: Make title read-only too?
            // if(documentTitleInput) documentTitleInput.disabled = true; 

        } else { 
            // --- Exiting Preview Mode ('normal' state) ---
            saveDocButton.classList.remove('hidden'); // Show Save
            confirmRevertButton.classList.add('hidden'); // Hide Confirm Revert
            cancelPreviewButton.classList.add('hidden'); // Hide Cancel Preview

            // Hide and clear the new status message
            previewStatusMessage.classList.add('hidden');
            previewStatusMessage.textContent = '';
            saveStatusSpan.textContent = ''; // Ensure old status is clear

            // Re-enable editing
            saveDocButton.disabled = false;
            documentContentInput.disabled = false;
            // Optional: Re-enable title if you disabled it
            // if(documentTitleInput) documentTitleInput.disabled = false;
        }
    }

    // --- Display Versions in Editor (with "View" buttons) ---
    function displayVersions(versions) {
        if (!versionListContainer) return;

        if (!versions || versions.length === 0) {
            versionListContainer.innerHTML = '<p class="no-versions">No previous versions found.</p>';
            return;
        }

        let versionsHtml = '<h4>Previous Versions:</h4><ul>';
        versions.forEach(version => {
            // Safely format timestamp using specified options
            let formattedDate = 'Unknown date';
            try {
                 if (version.timestamp && version.timestamp.toDate) {
                     const dateObj = version.timestamp.toDate();
                     const options = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
                     formattedDate = dateObj.toLocaleString(undefined, options);
                 } else if (version.timestamp) { // Fallback for non-firestore timestamps
                     const options = { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12: true };
                     formattedDate = new Date(version.timestamp).toLocaleString(undefined, options);
                 }
            } catch (e) { console.warn("Error formatting version date:", e); }

            // Use helper to escape title for safety
            const safeTitle = escapeHtml(version.title) || 'Untitled';

            versionsHtml += `
                <li class="version-item" data-version-id="${version.id}">
                    <span class="version-timestamp" title="${safeTitle} - ${formattedDate}">${formattedDate}</span>
                    <button class="button small secondary view-version-button" data-version-id="${version.id}" aria-label="View this version">View</button>
                </li>
            `;
        });
        versionsHtml += '</ul>';
        versionListContainer.innerHTML = versionsHtml;
    }

    // --- Confirmation Dialog (for Delete) ---
    function showConfirmation(title, message, onConfirmCallback) {
        // Re-select elements each time to ensure they exist and handle potential replacements
        const dialogContainer = document.getElementById('confirmDialog');
        const titleElement = document.getElementById('confirmTitle');
        const messageElement = document.getElementById('confirmMessage');
        const currentConfirmButton = document.getElementById('confirmButton');
        const currentCancelButton = document.getElementById('cancelButton');
        const currentCloseButton = document.getElementById('closeConfirmButton');

        if (!dialogContainer || !titleElement || !messageElement || !currentConfirmButton || !currentCancelButton || !currentCloseButton) {
            console.error("Confirmation dialog elements not found!");
            showToast("Error showing confirmation dialog.", true);
            return;
        }

        titleElement.textContent = title;
        messageElement.textContent = message;

        // Button Cloning to remove old listeners
        const newConfirmButton = currentConfirmButton.cloneNode(true);
        currentConfirmButton.parentNode?.replaceChild(newConfirmButton, currentConfirmButton);
        const newCancelButton = currentCancelButton.cloneNode(true);
        currentCancelButton.parentNode?.replaceChild(newCancelButton, currentCancelButton);
        const newCloseButton = currentCloseButton.cloneNode(true);
        currentCloseButton.parentNode?.replaceChild(newCloseButton, currentCloseButton);

        // Add new listeners
        const closeHandler = () => dialogContainer.classList.remove('active');

        newConfirmButton.onclick = () => {
            closeHandler();
            if (typeof onConfirmCallback === 'function') {
                try { onConfirmCallback(); } catch (e) {
                     console.error("Error executing confirmation callback:", e);
                     showToast("An error occurred performing the action.", true);
                }
            }
        };
        newCancelButton.onclick = closeHandler;
        newCloseButton.onclick = closeHandler;

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

     // --- NEW FUNCTION for updating the current version timestamp display. ---
    function updateCurrentVersionTimestamp(timestamp) {
        if (!currentVersionInfo) { // Check if the element exists
            console.warn("updateCurrentVersionTimestamp: currentVersionInfo element not found");
            return; 
        }
        
        let currentTimestampStr = 'N/A'; // Default
        if (timestamp) { // Check if timestamp was provided
            try {
                // Handle both Firestore Timestamps and standard Date objects/strings
                const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                // Define formatting options (same as in openEditor)
                const options = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
                // Format the date
                currentTimestampStr = dateObj.toLocaleString(undefined, options);
            } catch (e) {
                console.warn("Error formatting timestamp in updateCurrentVersionTimestamp:", e);
                currentTimestampStr = 'Invalid Date'; // Fallback on error
            }
        }
        // Update the HTML of the placeholder div
        currentVersionInfo.innerHTML = `<span class="label">Current:</span> ${escapeHtml(currentTimestampStr)}`; // Use escapeHtml for safety
    }
    // --- END OF NEW FUNCTION ---


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
        showConfirmation,    // Expose confirmation dialog helper
        setEditingState,      // Expose the new state manager
        updateCurrentVersionTimestamp // <-- Exposure current version time stamp

    };
})();

