// src/routes/+layout.js
import { auth } from "$lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { redirect } from "@sveltejs/kit";
import { browser } from "$app/environment";
import { user } from "$lib/stores/user"; // Import the store

export async function load({ url }) {
  if (browser) {
    // Create a promise to handle authentication state
    return new Promise((resolve) => {
      // Set up the auth state change listener
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        // Clean up the listener
        unsubscribe(); // Update the store with the current user

        user.set(currentUser); // Check for redirection

        if (
          !currentUser &&
          !url.pathname.startsWith("/login") &&
          !url.pathname.startsWith("/get-wms")
        ) {
          window.location.href = "/login";
        } // Resolve with the user

        resolve({ user: currentUser });
      });
    });
  } // Handle SSR if needed

  return { user: null };
}
