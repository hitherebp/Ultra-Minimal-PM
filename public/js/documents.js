// public/js/documents.js

const documentsModule = (() => {
    let db;
    // Define MAX_VERSIONS at the module level
    const MAX_VERSIONS = 5;

    function init(firestoreInstance) {
        db = firestoreInstance;
        if (!db) {
            console.error("Firestore instance is required for documentsModule.");
            // Potentially throw an error or disable functionality
        }
    }

    // --- Helper References ---
    const getDocRef = (docId) => db.collection('documents').doc(docId);
    const getVersionsRef = (docId) => getDocRef(docId).collection('versions');

    // --- Fetch User's Documents ---
    async function getUserDocuments(userId) {
        if (!db) throw new Error("Firestore not initialized.");
        if (!userId) throw new Error("User ID is required.");
        console.log(`Fetching documents for userId: ${userId}`);
        // This query requires a composite index in Firestore: (userId ASC, lastUpdated DESC)
        const snapshot = await db.collection('documents')
                                 .where('userId', '==', userId)
                                 .orderBy('lastUpdated', 'desc')
                                 .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // --- Get a Single Document (Current State) ---
     async function getDocument(docId) {
         if (!db) throw new Error("Firestore not initialized.");
         const docRef = getDocRef(docId);
         const docSnap = await docRef.get();
         if (docSnap.exists) {
             return { id: docSnap.id, ...docSnap.data() };
         } else {
             console.error(`Document not found with ID: ${docId}`);
             throw new Error("Document not found");
         }
     }

    // --- Create New Document ---
    async function createDocument(userId, title, content) {
        if (!db) throw new Error("Firestore not initialized.");
        if (!userId) throw new Error("User ID is required for creation.");

        const newDocRef = await db.collection('documents').add({
            userId: userId,
            title: title || "Untitled Document",
            content: content || "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        return newDocRef.id;
    }

    // --- Save Document (Handles Versioning) ---
    async function saveDocument(userId, docId, title, content) {
        if (!db) throw new Error("Firestore not initialized.");
        if (!userId) throw new Error("User ID is required for saving.");

        const docRef = getDocRef(docId);
        const versionsCollectionRef = getVersionsRef(docId); // Renamed for clarity

        try {
            const batch = db.batch();

            // 1. Get current document state BEFORE updating
            const currentDocSnap = await docRef.get();
            if (!currentDocSnap.exists) throw new Error("Document to save does not exist.");
            const currentData = currentDocSnap.data();

            // Security check
            if (currentData.userId !== userId) throw new Error("Permission denied.");

            // 2. Add the *current* state as a new version
            const newVersionRef = versionsCollectionRef.doc(); // Auto-ID
            batch.set(newVersionRef, {
                title: currentData.title,
                content: currentData.content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId // Include userId for rules/queries if needed
            });

            // 3. Update the main document with the *new* state
            batch.update(docRef, {
                title: title,
                content: content,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 4. Trim old versions (keep only the latest MAX_VERSIONS)
            // Query for all versions ascending to easily find the oldest
            const allVersionsQuery = versionsCollectionRef.orderBy('timestamp', 'asc');
            const allVersionsSnapshot = await allVersionsQuery.get();

            if (allVersionsSnapshot.size >= MAX_VERSIONS) { // Check if count EXCEEDS max after adding one
                 // Calculate how many to delete (could be more than 1 if saves were rapid)
                 const versionsToDeleteCount = allVersionsSnapshot.size - MAX_VERSIONS + 1; // +1 for the one we're adding
                 for (let i = 0; i < versionsToDeleteCount && i < allVersionsSnapshot.size; i++) {
                      console.log(`Batching delete for old version: ${allVersionsSnapshot.docs[i].id}`);
                      batch.delete(allVersionsSnapshot.docs[i].ref);
                 }
            }

            // 5. Commit the batch
            await batch.commit();
            console.log(`Document ${docId} saved, version created, old versions trimmed.`);
            return true;

        } catch (error) {
            console.error("Error saving document with versioning:", error);
            throw error;
        }
    }

    // --- Delete Document (and its versions - client-side attempt) ---
    async function deleteDocument(docId) {
        if (!db) throw new Error("Firestore not initialized.");
        console.log(`Attempting client-side delete for doc ${docId} and versions.`);

        // Note: A Cloud Function triggered by document delete is the robust way.
        const docRef = getDocRef(docId);
        const versionsCollectionRef = getVersionsRef(docId);

        try {
            // 1. Delete versions first (best effort client-side)
            const versionsSnapshot = await versionsCollectionRef.get();
            if (versionsSnapshot.size > 0) {
                 const deleteVersionsBatch = db.batch();
                 versionsSnapshot.docs.forEach(doc => deleteVersionsBatch.delete(doc.ref));
                 await deleteVersionsBatch.commit();
                 console.log(`Deleted ${versionsSnapshot.size} versions for doc ${docId}.`);
            } else {
                 console.log(`No versions found to delete for doc ${docId}.`);
            }

            // 2. Delete the main document
            await docRef.delete();
            console.log(`Deleted main document ${docId}.`);
        } catch(error) {
             console.error(`Error during client-side deletion of doc ${docId}:`, error);
             // Depending on where it failed, data might be inconsistent.
             throw new Error("Failed to completely delete document and versions.");
        }
    }

    // --- Get Recent Versions (for display list) ---
    async function getVersions(docId) {
        if (!db) throw new Error("Firestore not initialized.");
        const versionsCollectionRef = getVersionsRef(docId);
        const snapshot = await versionsCollectionRef.orderBy('timestamp', 'desc').limit(MAX_VERSIONS).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // --- Get a SINGLE Version by its ID (for preview) ---
    async function getVersionById(docId, versionId) {
         if (!db) throw new Error("Firestore not initialized.");
         if (!docId || !versionId) throw new Error("Document ID and Version ID are required.");
         console.log(`Fetching version ${versionId} for doc ${docId}`);

         const versionRef = getVersionsRef(docId).doc(versionId);
         const docSnap = await versionRef.get();

         if (docSnap.exists) {
             return { id: docSnap.id, ...docSnap.data() };
         } else {
             console.error(`Version not found. Doc ID: ${docId}, Version ID: ${versionId}`);
             throw new Error("Version not found");
         }
    }

    // --- Revert to a Specific Version ---
    async function revertToVersion(userId, docId, versionId) {
         if (!db) throw new Error("Firestore not initialized.");
         if (!userId) throw new Error("User ID is required for reverting.");
         if (!docId || !versionId) throw new Error("Doc ID and Version ID required for revert.");

         const docRef = getDocRef(docId);
         const versionToRevertToRef = getVersionsRef(docId).doc(versionId);
         const versionsCollectionRef = getVersionsRef(docId); // Needed again for batching

         try {
             const batch = db.batch();

             // 1. Get the data from the specific version to revert TO
             const versionSnap = await versionToRevertToRef.get();
             if (!versionSnap.exists) throw new Error(`Version ${versionId} to revert to not found.`);
             const versionData = versionSnap.data();

             // 2. Get the *current* main document data (this will be archived)
             const currentDocSnap = await docRef.get();
             if (!currentDocSnap.exists) throw new Error("Main document not found during revert.");
             const currentData = currentDocSnap.data();

             // Security checks
             if (currentData.userId !== userId || versionData.userId !== userId) {
                 throw new Error("Permission denied to revert this document.");
             }

             // 3. Save the *current* main doc state as a *new* version (before overwriting)
             const newArchivedVersionRef = versionsCollectionRef.doc();
             batch.set(newArchivedVersionRef, {
                 title: currentData.title,
                 content: currentData.content,
                 timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                 userId: userId
             });

             // 4. Update the main document with the data from the selected *old* version
             batch.update(docRef, {
                 title: versionData.title,
                 content: versionData.content,
                 lastUpdated: firebase.firestore.FieldValue.serverTimestamp() // Mark revert time
             });

            // 5. Trim versions *again* (logic similar to saveDocument)
            const allVersionsQuery = versionsCollectionRef.orderBy('timestamp', 'asc');
            // Get size AFTER adding the archived version in the batch (use transaction for perfect count?)
            // Client-side estimate: get current size + 1
            const currentSizeSnapshot = await versionsCollectionRef.limit(1).get(); // Cheap way to check if collection exists
            let estimatedSizeAfterAdd = 1; // Assume at least the one we're adding
            if (!currentSizeSnapshot.empty) {
                 // If not empty, get full count. This might be slightly off due to batch, but ok for trimming
                 const countSnapshot = await allVersionsQuery.get();
                 estimatedSizeAfterAdd = countSnapshot.size + 1;
            }

            if (estimatedSizeAfterAdd > MAX_VERSIONS) {
                const versionsToDeleteCount = estimatedSizeAfterAdd - MAX_VERSIONS;
                 // Query again for the oldest ones to delete
                 const queryToDelete = versionsCollectionRef.orderBy('timestamp', 'asc').limit(versionsToDeleteCount);
                 const snapshotToDelete = await queryToDelete.get();
                 snapshotToDelete.docs.forEach(doc => {
                     console.log(`Batching delete for old version during revert: ${doc.id}`);
                     batch.delete(doc.ref);
                 });
            }

             // 6. Commit the batch
             await batch.commit();
             console.log(`Document ${docId} reverted to version ${versionId}.`);
             // Return the data that was just applied to the main doc
             return { newTitle: versionData.title, newContent: versionData.content };

         } catch (error) {
             console.error(`Error reverting document ${docId} to version ${versionId}:`, error);
             throw error; // Re-throw for handling in app.js
         }
    }

    // --- Public API ---
    return {
        init,
        getUserDocuments,
        getDocument,
        createDocument,
        saveDocument,
        deleteDocument,
        getVersions,    // Get list of recent versions
        getVersionById, // Get specific version content
        revertToVersion // Perform the revert action
    };
})();