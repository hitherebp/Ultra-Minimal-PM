// public/js/documents.js

const documentsModule = (() => {
    // Assume db is initialized firebase.firestore() instance (likely in app.js or auth.js)
    let db;
    const MAX_VERSIONS = 5; // <<< Maximum number of versions to retain


    function init(firestoreInstance) {
        db = firestoreInstance;
        if (!db) {
            console.error("Firestore instance is required for documentsModule.");
        }
    }

    // --- Helper to get document and subcollection refs ---
    const getDocRef = (docId) => db.collection('documents').doc(docId);
    const getVersionsRef = (docId) => getDocRef(docId).collection('versions');

    // --- Fetch Documents (Existing - no change needed unless adding metadata) ---
    async function getUserDocuments(userId) {
        if (!db) throw new Error("Firestore not initialized.");
        if (!userId) throw new Error("User ID is required.");
        console.log(`Fetching documents for userId: ${userId}`);
        const snapshot = await db.collection('documents')
                                 .where('userId', '==', userId)
                                 .orderBy('lastUpdated', 'desc') // Assuming you want ordering
                                 .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // --- Get a Single Document (Existing - no change needed) ---
     async function getDocument(docId) {
         if (!db) throw new Error("Firestore not initialized.");
         const docRef = getDocRef(docId);
         const docSnap = await docRef.get();
         if (docSnap.exists) {
             return { id: docSnap.id, ...docSnap.data() };
         } else {
             throw new Error("Document not found");
         }
     }

    // --- Create New Document (Existing - minor change: add lastUpdated) ---
    async function createDocument(userId, title, content) {
        if (!db) throw new Error("Firestore not initialized.");
        if (!userId) throw new Error("User ID is required for creation.");

        const newDocRef = await db.collection('documents').add({
            userId: userId,
            title: title || "Untitled Document",
            content: content || "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp() // Add lastUpdated on creation
        });
        return newDocRef.id;
    }

    // --- Save/Update Document (Major Changes for Versioning) ---
    async function saveDocument(userId, docId, title, content) {
        if (!db) throw new Error("Firestore not initialized.");
        if (!userId) throw new Error("User ID is required for saving.");

        const docRef = getDocRef(docId);
        const versionsRef = getVersionsRef(docId);
        
        try {
            // Use a transaction or batched write for atomicity
            const batch = db.batch();

            // 1. Get the current document state *before* updating
            const currentDocSnap = await docRef.get();
            if (!currentDocSnap.exists) {
                throw new Error("Document to save does not exist.");
            }
            const currentData = currentDocSnap.data();

            // Security check (though rules should enforce this too)
            if (currentData.userId !== userId) {
                throw new Error("Permission denied to save this document.");
            }

            // 2. Add the *current* state as a new version in the subcollection
            // Only add if title or content actually changed? Optional optimization.
            const newVersionRef = versionsRef.doc(); // Auto-generate ID
            batch.set(newVersionRef, {
                title: currentData.title,
                content: currentData.content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId // Store userId for rules
            });

            // 3. Update the main document with the *new* state
            batch.update(docRef, {
                title: title,
                content: content,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 4. Trim old versions (keep only the latest MAX_VERSIONS)
            // Query for versions older than the newest ones to delete them.
            const versionsQuery = versionsRef.orderBy('timestamp', 'desc').limit(MAX_VERSIONS);
            const versionsSnapshot = await versionsQuery.get();

            if (versionsSnapshot.size >= MAX_VERSIONS) {
                // Find the timestamp of the *last* document we want to keep
                 const oldestKeptTimestamp = versionsSnapshot.docs[versionsSnapshot.size - 1].data().timestamp;

                 // Query for versions *older* than this timestamp (or equal if timestamps collide, handle carefully)
                 // A slightly safer approach: query all ordered ascending, figure out which ones to delete.
                 const allVersionsQuery = versionsRef.orderBy('timestamp', 'asc');
                 const allVersionsSnapshot = await allVersionsQuery.get();

                 if (allVersionsSnapshot.size > MAX_VERSIONS) {
                     const versionsToDeleteCount = allVersionsSnapshot.size - MAX_VERSIONS;
                     for (let i = 0; i < versionsToDeleteCount; i++) {
                         console.log(`Batching delete for old version: ${allVersionsSnapshot.docs[i].id}`);
                         batch.delete(allVersionsSnapshot.docs[i].ref);
                     }
                 }
            }

            // 5. Commit the batch
            await batch.commit();
            console.log(`Document ${docId} saved, version created, old versions trimmed.`);
            return true; // Indicate success

        } catch (error) {
            console.error("Error saving document with versioning:", error);
            throw error; // Re-throw for handling in app.js
        }
    }

    // --- Delete Document (Needs to delete subcollection too!) ---
    async function deleteDocument(docId) {
        if (!db) throw new Error("Firestore not initialized.");
        console.log(`Attempting to delete document ${docId} and its versions.`);

        // It's complex to delete subcollections client-side efficiently.
        // Best Practice: Use a Firebase Cloud Function triggered on document delete.
        // Simple Client-Side (Less robust, rate limited): Delete main doc, *then* try to delete versions.

        const docRef = getDocRef(docId);
        const versionsRef = getVersionsRef(docId);

        // 1. Delete versions (can be slow/incomplete on client)
        const versionsSnapshot = await versionsRef.get();
        const batch = db.batch();
        versionsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit(); // Commit version deletes first
        console.log(`Deleted ${versionsSnapshot.size} versions for doc ${docId}.`);

        // 2. Delete the main document
        await docRef.delete();
        console.log(`Deleted main document ${docId}.`);
    }

    // --- NEW: Get Versions for a Document ---
    async function getVersions(docId) {
        if (!db) throw new Error("Firestore not initialized.");
        const versionsRef = getVersionsRef(docId);
        const snapshot = await versionsRef.orderBy('timestamp', 'desc').limit(MAX_VERSIONS).get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // --- NEW: Revert to a Specific Version ---
    async function revertToVersion(userId, docId, versionId) {
         if (!db) throw new Error("Firestore not initialized.");
         if (!userId) throw new Error("User ID is required for reverting.");

         const docRef = getDocRef(docId);
         const versionRef = getVersionsRef(docId).doc(versionId);
         const versionsRef = getVersionsRef(docId); // Needed for trimming later
         try {
             const batch = db.batch();

             // 1. Get the data from the version we want to revert *to*
             const versionSnap = await versionRef.get();
             if (!versionSnap.exists) {
                 throw new Error("Version to revert to not found.");
             }
             const versionData = versionSnap.data();

             // 2. Get the *current* data from the main document (to archive it)
             const currentDocSnap = await docRef.get();
             if (!currentDocSnap.exists) {
                 throw new Error("Main document not found during revert.");
             }
             const currentData = currentDocSnap.data();

             // Security check
            if (currentData.userId !== userId || versionData.userId !== userId) {
                throw new Error("Permission denied to revert this document.");
            }

             // 3. Save the *current* state as a *new* version (before overwriting main doc)
             const newVersionRef = versionsRef.doc(); // Auto-generate ID
             batch.set(newVersionRef, {
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

            // 5. Trim versions *again* after adding the one from step 3
            // (Duplicating logic from saveDocument - could be refactored into a helper)
            const allVersionsQuery = versionsRef.orderBy('timestamp', 'asc');
            const allVersionsSnapshot = await allVersionsQuery.get(); // Get potentially updated list

            // Calculate how many versions exist *after* adding one in step 3
            const potentialVersionCount = allVersionsSnapshot.size + 1; // +1 because batch hasn't committed yet

            if (potentialVersionCount > MAX_VERSIONS) {
                const versionsToDeleteCount = potentialVersionCount - MAX_VERSIONS;
                // Query again to be sure we get the oldest ones based on persisted data + batch
                const queryToDelete = versionsRef.orderBy('timestamp', 'asc').limit(versionsToDeleteCount);
                const snapshotToDelete = await queryToDelete.get();
                 snapshotToDelete.docs.forEach(doc => {
                     console.log(`Batching delete for old version during revert: ${doc.id}`);
                     batch.delete(doc.ref);
                 });
            }

             // 6. Commit the batch
             await batch.commit();
             console.log(`Document ${docId} reverted to version ${versionId}.`);
             return { newTitle: versionData.title, newContent: versionData.content }; // Return reverted data

         } catch (error) {
             console.error("Error reverting document:", error);
             throw error;
         }
    }


    // --- Public API ---
    return {
        init,
        getUserDocuments,
        getDocument, // Keep if used directly elsewhere
        createDocument,
        saveDocument, // Updated function
        deleteDocument, // Updated function
        getVersions,    // New function
        revertToVersion // New function
    };
})();

// Ensure this module is initialized somewhere (e.g., in app.js after Firebase init)
// Example: documentsModule.init(firebase.firestore());