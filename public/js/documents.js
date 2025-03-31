/**
 * Module for handling Firestore database operations related to documents.
 */

// Define the documents object globally or export if using modules
const documents = (() => {

    /**
     * Fetches all documents for the given user from Firestore, ordered by update time.
     * @param {firebase.firestore.Firestore} db - Firestore database instance.
     * @param {string} userId - The UID of the currently logged-in user.
     * @param {function(Array<object>)} onSuccess - Callback function on successful fetch, receives an array of document objects {id, title, content, updatedAt, ...}.
     * @param {function(Error)} onError - Callback function on error.
     */
    function fetchDocuments(db, userId, onSuccess, onError) {
        if (!userId) {
            onError(new Error("User ID is required to fetch documents."));
            return;
        }
        console.log(`Fetching documents for user: ${userId}`);
        db.collection('documents')
          .where('userId', '==', userId) // Query for documents belonging to the user
          .orderBy('updatedAt', 'desc')  // Order by most recently updated
          .get()
          .then(querySnapshot => {
              const docs = [];
              querySnapshot.forEach(doc => {
                  // Include document ID along with data
                  docs.push({ id: doc.id, ...doc.data() });
              });
              console.log(`Fetched ${docs.length} documents.`);
              onSuccess(docs);
          })
          .catch(error => {
              console.error("Error fetching documents: ", error);
              onError(error);
          });
    }

     /**
     * Fetches a single document by its ID. Ensures the document belongs to the user.
     * @param {firebase.firestore.Firestore} db - Firestore database instance.
     * @param {string} docId - The ID of the document to fetch.
     * @param {string} userId - The UID of the currently logged-in user (for verification).
     * @param {function(object|null)} onSuccess - Callback function, receives document data {id, title, ...} or null if not found/not owned.
     * @param {function(Error)} onError - Callback function on error.
     */
    function fetchSingleDocument(db, docId, userId, onSuccess, onError) {
         if (!docId || !userId) {
            onError(new Error("Document ID and User ID are required."));
            return;
        }
        console.log(`Fetching single document: ${docId} for user: ${userId}`);
        db.collection('documents').doc(docId)
          .get()
          .then(doc => {
              if (doc.exists) {
                   const data = doc.data();
                   // Security check: Ensure the fetched document belongs to the current user
                   if (data.userId === userId) {
                       console.log("Document found and user matches.");
                       onSuccess({ id: doc.id, ...data });
                   } else {
                       console.warn(`User mismatch: Doc ${docId} belongs to ${data.userId}, accessed by ${userId}`);
                       onSuccess(null); // Treat as not found for this user
                   }
              } else {
                  console.log(`Document ${docId} not found.`);
                  onSuccess(null); // Document doesn't exist
              }
          })
          .catch(error => {
               console.error(`Error fetching document ${docId}: `, error);
               onError(error);
          });
    }


    /**
     * Saves a document (creates new or updates existing) to Firestore.
     * Automatically sets `createdAt` (on create) and `updatedAt` timestamps.
     * @param {firebase.firestore.Firestore} db - Firestore database instance.
     * @param {string} userId - The UID of the currently logged-in user.
     * @param {string|null} docId - The ID of the document to update, or null/undefined to create a new one.
     * @param {string} title - The document title.
     * @param {string} content - The document content.
     * @param {function(string)} onSuccess - Callback on success, receives the document ID (new or existing).
     * @param {function(Error)} onError - Callback on error.
     */
    function saveDocument(db, userId, docId, title, content, onSuccess, onError) {
        if (!userId) {
            onError(new Error("User ID is required to save documents."));
            return;
        }

        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        const data = {
            userId: userId,
            title: title.trim() || "Untitled Document", // Ensure title is not empty, provide default
            content: content, // Assuming content can be empty
            // createdAt: timestamp, // Set only if creating new (handled below)
            updatedAt: timestamp  // Always update 'updatedAt'
        };

        if (docId) {
            // Update existing document
            console.log(`Updating document: ${docId}`);
            db.collection('documents').doc(docId)
              // Use set with merge: true to update fields or create them if they don't exist,
              // BUT importantly, it only works if the document already exists.
              // It also respects the security rule check on resource.data.userId
              .set(data, { merge: true })
              .then(() => {
                  console.log("Document successfully updated");
                  onSuccess(docId);
              })
              .catch(error => {
                  console.error(`Error updating document ${docId}: `, error);
                  onError(error);
              });
        } else {
            // Create new document
            console.log(`Creating new document for user: ${userId}`);
            // Explicitly add createdAt only when creating
            data.createdAt = timestamp;
            db.collection('documents')
              .add(data) // add() generates a new ID
              .then(docRef => {
                  console.log("Document successfully created with ID: ", docRef.id);
                  onSuccess(docRef.id); // Return the newly generated ID
              })
              .catch(error => {
                  console.error("Error creating document: ", error);
                  onError(error);
              });
        }
    }

    /**
     * Deletes a document from Firestore.
     * Rules should ensure only the owner can delete.
     * @param {firebase.firestore.Firestore} db - Firestore database instance.
     * @param {string} docId - The ID of the document to delete.
     * @param {string} userId - The UID of the user initiating the delete (used for logging/potential pre-check).
     * @param {function()} onSuccess - Callback function on successful deletion.
     * @param {function(Error)} onError - Callback function on error.
     */
    function deleteDocument(db, docId, userId, onSuccess, onError) {
        if (!docId || !userId) {
             onError(new Error("Document ID and User ID are required for deletion."));
             return;
        }
        console.log(`Attempting to delete document: ${docId} by user: ${userId}`);
        db.collection('documents').doc(docId)
          .delete()
          .then(() => {
              console.log(`Document ${docId} successfully deleted.`);
              onSuccess();
          })
          .catch(error => {
              // This could be a permission error if rules deny it, or a network error.
              console.error(`Error deleting document ${docId}: `, error);
              onError(error);
          });
    }


    // Public interface for the module
    return {
        fetchDocuments,
        fetchSingleDocument,
        saveDocument,
        deleteDocument
    };

})(); // Immediately invoke the function to create the documents object
