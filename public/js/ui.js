/**
 * Module for handling UI updates and interactions.
 */

const ui = (() => {

    // Cache DOM elements to avoid repeated lookups
    const elements = {
        userEmail: document.getElementById('userEmail'),
        loadingIndicator: document.getElementById('loadingIndicator'),
        documentList: document.getElementById('documentList'),
        editorModal: document.getElementById('editorModal'),
        documentTitleInput: document.getElementById('documentTitle'),
        documentContentInput: document.getElementById('documentContent'),
        saveStatus: document.getElementById('saveStatus'),
        confirmDialog: document.getElementById('confirmDialog'),
        confirmMessage: document.getElementById('confirmMessage'),
        statusToast: document.getElementById('statusToast')
    };

    let toastTimeout = null; // Store timeout ID for the toast

    /**
     * Updates the user email display in the header.
     * @param {firebase.User} user - The currently logged-in user object.
     */
    function updateUserDisplay(user) {
        if (elements.userEmail) {
            elements.userEmail.textContent = user.email || 'User';
            elements.userEmail.title = user.email; // Tooltip for potentially truncated email
        }
    }

    /**
     * Shows or hides the main loading indicator.
     * @param {boolean} isLoading - True to show, false to hide.
     */
    function setLoading(isLoading) {
        if (elements.loadingIndicator) {
            elements.loadingIndicator.classList.toggle('hidden', !isLoading);
        }
         // Optionally hide document list while loading initial data
         if (elements.documentList) {
              elements.documentList.classList.toggle('hidden', isLoading);
         }
    }

    /**
     * Renders the list of documents in the UI.
     * @param {Array<object>} docs - Array of document objects {id, title, updatedAt, ...}.
     */
    function renderDocumentList(docs) {
        if (!elements.documentList) return;
        elements.documentList.innerHTML = ''; // Clear existing list

        if (docs.length === 0) {
            elements.documentList.innerHTML = '<p>No documents found. Create one!</p>';
            return;
        }

        docs.forEach(doc => {
            const item = document.createElement('div');
            item.classList.add('document-item');
            item.dataset.id = doc.id; // Store ID on the element

            const updatedDate = doc.updatedAt?.toDate ? doc.updatedAt.toDate().toLocaleString() : 'N/A';

            item.innerHTML = `
                <div class="document-info" title="Click to edit '${doc.title}'">
                    <span class="document-title">${doc.title || 'Untitled Document'}</span>
                    <span class="document-meta">Last updated: ${updatedDate}</span>
                </div>
                <div class="document-actions">
                    <button class="action-button edit-button" title="Edit Document">&#9998;</button> <!-- Pencil icon -->
                    <button class="action-button delete-button" title="Delete Document">&#128465;</button> <!-- Trash can icon -->
                </div>
            `;
            elements.documentList.appendChild(item);
        });
    }

     /**
     * Removes a document item from the list UI based on its ID.
     * @param {string} docId - The ID of the document to remove.
     */
    function removeDocumentFromList(docId) {
        const item = elements.documentList?.querySelector(`.document-item[data-id="${docId}"]`);
        if (item) {
            item.remove();
             // Check if list becomes empty
            if (elements.documentList.children.length === 0) {
                elements.documentList.innerHTML = '<p>No documents found. Create one!</p>';
            }
        }
    }

    /**
     * Opens the document editor modal. Optionally pre-fills title and content.
     * @param {string} [title=''] - Optional title to pre-fill.
     * @param {string} [content=''] - Optional content to pre-fill.
     */
    function openEditor(title = '', content = '') {
        if (!elements.editorModal) return;
        elements.documentTitleInput.value = title;
        elements.documentContentInput.value = content;
        updateSaveStatus(''); // Clear status on open
        elements.editorModal.classList.add('active');
        elements.documentTitleInput.focus(); // Focus title input
    }

    /**
     * Closes the document editor modal.
     */
    function closeEditor() {
        if (elements.editorModal) {
            elements.editorModal.classList.remove('active');
            // Clear fields after closing animation might be smoother?
            // setTimeout(() => {
            //      elements.documentTitleInput.value = '';
            //      elements.documentContentInput.value = '';
            // }, 300); // Match transition duration
        }
    }

    /**
     * Updates the save status message in the editor footer.
     * @param {string} statusText - The text to display (e.g., 'Saving...', 'Saved', 'Unsaved changes').
     */
    function updateSaveStatus(statusText) {
        if (elements.saveStatus) {
            elements.saveStatus.textContent = statusText;
        }
    }

    /**
     * Opens the confirmation dialog.
     * @param {string} docId - The ID of the document being considered for action (stored on dialog).
     * @param {string} message - The confirmation message to display.
     */
    function openConfirmDialog(docId, message) {
        if (!elements.confirmDialog) return;
        elements.confirmDialog.dataset.docId = docId; // Store docId for confirmation handler
        elements.confirmMessage.textContent = message;
        elements.confirmDialog.classList.add('active');
    }

    /**
     * Closes the confirmation dialog.
     */
    function closeConfirmDialog() {
        if (elements.confirmDialog) {
            elements.confirmDialog.classList.remove('active');
             // Reset button state if needed
             setButtonLoading(document.getElementById('confirmButton'), false);
        }
    }

    /**
     * Shows a status toast message at the bottom of the screen.
     * @param {string} message - The message to display.
     * @param {boolean} [isError=false] - If true, styles the toast as an error.
     * @param {number} [duration=3000] - How long the toast stays visible in milliseconds.
     */
    function showToast(message, isError = false, duration = 3000) {
        if (!elements.statusToast) return;

        elements.statusToast.textContent = message;
        elements.statusToast.classList.toggle('error', isError); // Add/remove error class
        elements.statusToast.classList.add('visible');

        // Clear existing timeout if any
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        // Set timeout to hide the toast
        toastTimeout = setTimeout(() => {
            elements.statusToast.classList.remove('visible');
            toastTimeout = null; // Clear the timeout ID
        }, duration);
    }

    /**
     * Toggles a loading state on a button (disables and optionally shows spinner).
     * @param {HTMLButtonElement} button - The button element.
     * @param {boolean} isLoading - True to set loading state, false to reset.
     */
    function setButtonLoading(button, isLoading) {
         if (!button) return;
         button.disabled = isLoading;
         // Optional: Add/remove a spinner or change text
         // if (isLoading) {
         //    button.dataset.originalText = button.innerHTML;
         //    button.innerHTML = '<span class="spinner-small"></span> Loading...'; // Needs CSS for spinner-small
         // } else if (button.dataset.originalText) {
         //    button.innerHTML = button.dataset.originalText;
         // }
    }


    // Public interface for the module
    return {
        updateUserDisplay,
        setLoading,
        renderDocumentList,
        removeDocumentFromList,
        openEditor,
        closeEditor,
        updateSaveStatus,
        openConfirmDialog,
        closeConfirmDialog,
        showToast,
        setButtonLoading
    };

})(); // Immediately invoke to create the ui object

