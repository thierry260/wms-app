// src/lib/utils/cache.js
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  documentId,
} from "firebase/firestore";
import { db } from "$lib/firebase";
import { browser } from "$app/environment";
import { fetchWorkspaceData } from "$lib/utils/get";

export async function updateWorkspaceArray(
  workspaceId,
  collection,
  docId,
  remove = false
) {
  if (!browser) return;

  const docRef = doc(db, "workspaces", workspaceId);

  const workspaceDoc = await getDoc(docRef);
  if (!workspaceDoc.exists()) return;

  const collectionData = workspaceDoc.data()[collection] || {};

  if (remove) {
    delete collectionData[docId];

    // Also remove from localStorage
    const cachedCollection = JSON.parse(localStorage.getItem(collection)) || {};
    delete cachedCollection[docId];
    localStorage.setItem(collection, JSON.stringify(cachedCollection));
  } else {
    collectionData[docId] = {
      lastUpdated: new Date(),
      // Any other necessary metadata can be added here
    };
  }

  await updateDoc(docRef, {
    [collection]: collectionData,
  });
}

export async function updateDocsArray(slug) {
  if (!browser) return;

  const workspaceId = localStorage.getItem("workspace");
  if (!workspaceId) {
    throw new Error("Workspace ID is not set in local storage.");
  }

  // The correct document reference for the workspace
  const docRef = doc(db, "workspaces", workspaceId);

  // Reference to the collection within the workspace
  const collectionRef = collection(db, `workspaces/${workspaceId}/${slug}`);
  const snapshot = await getDocs(collectionRef);

  // Create an associative array to hold the document data
  const collectionData = {};

  snapshot.forEach((doc) => {
    collectionData[doc.id] = {
      lastUpdated: new Date(),
      // Additional data from the document can be added here if needed
    };
  });

  // Update the workspace document with the new data for the specified slug
  await updateDoc(docRef, {
    [slug]: collectionData,
  });

  return collectionData;
}

const MAX_BATCH_SIZE = 10; // Firestore `in` operator limit

export async function getCachedDocs(collectionName) {
  if (!browser) return;

  const workspaceId = localStorage.getItem("workspace");
  if (!workspaceId) {
    throw new Error("Workspace ID is not set in local storage.");
  }

  const workspaceDocRef = doc(db, "workspaces", workspaceId);
  const workspaceDocSnap = await getDoc(workspaceDocRef);

  if (!workspaceDocSnap.exists()) {
    throw new Error("Workspace document does not exist.");
  }

  const workspaceDoc = workspaceDocSnap.data();
  const collectionData = workspaceDoc[collectionName];
  if (!collectionData) {
    throw new Error(`No data found for collection: ${collectionName}`);
  }

  const cachedCollection =
    JSON.parse(localStorage.getItem(collectionName)) || {};

  const resultData = [];
  const idsToFetch = [];

  for (const docId in collectionData) {
    const cachedItem = cachedCollection[docId];
    const lastFetched = cachedItem?.lastFetched
      ? new Date(cachedItem.lastFetched)
      : null;

    const lastUpdatedTimestamp = collectionData[docId].lastUpdated;
    const lastUpdated = lastUpdatedTimestamp
      ? new Date(
          lastUpdatedTimestamp.seconds * 1000 +
            lastUpdatedTimestamp.nanoseconds / 1000000
        )
      : null;

    if (lastFetched && lastUpdated && lastFetched > lastUpdated) {
      resultData.push({ id: docId, ...cachedItem.data });
    } else {
      idsToFetch.push(docId);
    }
  }

  console.log("data from cache: ", resultData);
  console.log("idsToFetch: ", idsToFetch);

  if (idsToFetch.length > 0) {
    // Handle batching if needed
    for (let i = 0; i < idsToFetch.length; i += MAX_BATCH_SIZE) {
      const batchIds = idsToFetch.slice(i, i + MAX_BATCH_SIZE);
      const collectionRef = collection(
        db,
        `workspaces/${workspaceId}/${collectionName}`
      );
      const q = query(collectionRef, where(documentId(), "in", batchIds));
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          const docData = docSnap.data();
          const docId = docSnap.id;

          // Update or add the doc in the local storage object
          cachedCollection[docId] = {
            lastFetched: new Date().toISOString(),
            data: docData,
          };

          resultData.push({ id: docId, ...docData });
        }
      });
    }

    // Save the updated collection object back to localStorage
    localStorage.setItem(collectionName, JSON.stringify(cachedCollection));
  }

  console.log(resultData);
  return resultData;
}

// // Save data to localStorage with expiration
// export function saveToCache(key, data) {
//   const cache = {
//     timestamp: Date.now(),
//     data,
//   };
//   localStorage.setItem(key, JSON.stringify(cache));
// }

// // Get data from localStorage with expiration check
// export function getFromCache(key, expirationMinutes = 30) {
//   // Default to 30 minutes
//   const expirationTime = expirationMinutes * 60 * 1000; // Convert minutes to milliseconds
//   const cache = JSON.parse(localStorage.getItem(key));
//   if (cache && Date.now() - cache.timestamp < expirationTime) {
//     return cache.data;
//   }
//   return null;
// }

// // Remove data from localStorage
// export function removeFromCache(key) {
//   localStorage.removeItem(key);
// }
