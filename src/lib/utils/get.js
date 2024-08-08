import { doc, getDoc } from "firebase/firestore";
import { db } from "$lib/firebase";
import { browser } from "$app/environment";

const CACHE_KEY = "cachedWorkspaceData";
const CACHE_EXPIRATION_KEY = "cachedWorkspaceDataExpiration";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchWorkspaceData(fieldName = null) {
  let cachedData = null;
  let cacheExpiration = null;

  if (browser) {
    cachedData = JSON.parse(localStorage.getItem(CACHE_KEY));
    cacheExpiration = localStorage.getItem(CACHE_EXPIRATION_KEY);
  }

  if (cachedData && cacheExpiration && Date.now() < parseInt(cacheExpiration)) {
  } else {
    console.log("Fetching fresh workspace data");
    try {
      if (!browser) {
        console.error("Not in a browser environment");
        return null;
      }

      const workspaceId = localStorage.getItem("workspace");
      if (!workspaceId) {
        console.error("Workspace ID not found in localStorage");
        return null;
      }

      const docRef = doc(db, "workspaces", workspaceId);
      const docSnap = await getDoc(docRef);
      console.log("workspace - getDoc");

      if (docSnap.exists()) {
        cachedData = docSnap.data();
        if (browser) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(cachedData));
          localStorage.setItem(
            CACHE_EXPIRATION_KEY,
            Date.now() + CACHE_DURATION_MS
          );
        }
      } else {
        console.log("Document not found");
        return null;
      }
    } catch (error) {
      console.error("Error fetching document: ", error);
      return null;
    }
  }

  if (fieldName) {
    return cachedData[fieldName] ?? null;
  }

  return cachedData;
}

export function clearCache() {
  if (browser) {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRATION_KEY);
  }
}

let cachedTemplateData = {};

export async function fetchTemplateData(templateId) {
  if (cachedTemplateData[templateId]) {
    return cachedTemplateData[templateId];
  }

  try {
    if (!browser) {
      console.error("Not in a browser environment");
      return null;
    }

    const workspaceId = localStorage.getItem("workspace");
    if (!workspaceId) {
      console.error("Workspace ID not found in localStorage");
      return null;
    }

    console.log(templateId);
    const templateDocRef = doc(
      db,
      "workspaces",
      workspaceId,
      "templates",
      templateId
    );
    const templateDocSnap = await getDoc(templateDocRef);
    console.log("template - getDoc");

    if (templateDocSnap.exists()) {
      cachedTemplateData[templateId] = templateDocSnap.data();
      return cachedTemplateData[templateId];
    } else {
      console.log(`Template with ID ${templateId} not found`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching template document:", error);
    return null;
  }
}
