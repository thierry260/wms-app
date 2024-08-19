// src/routes/+layout.js
import { auth } from "$lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { redirect } from "@sveltejs/kit";
import { browser } from "$app/environment";
import { user } from "$lib/stores/user"; // Import the store

export async function load({ url }) {
  if (browser) {
    return new Promise((resolve, reject) => {
      onAuthStateChanged(auth, (currentUser) => {
        if (
          !currentUser &&
          !url.pathname.startsWith("/login") &&
          !url.pathname.startsWith("/get-wms")
        ) {
          reject(redirect(302, "/login"));
        } else {
          user.set(currentUser); // Update the store
          resolve({ user: currentUser });
        }
      });
    });
  }

  return { user: null };
}
