// src/routes/+layout.js
import { auth } from "$lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { browser } from "$app/environment";
import { user } from "$lib/stores/user";

export async function load({ url }) {
  if (browser) {
    // Ensure the auth state listener is set up if it hasn't been already
    onAuthStateChanged(auth, (currentUser) => {
      user.set(currentUser);

      // If the user is not authenticated and trying to access protected routes, redirect to login
      if (
        !currentUser &&
        !url.pathname.startsWith("/login") &&
        !url.pathname.startsWith("/get-wms")
      ) {
        window.location.href = "/login";
      }
    });
  }

  return { user: auth.currentUser || null };
}
