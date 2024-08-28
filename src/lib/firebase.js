// Import the functions you need from the Firebase SDKs
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Import getStorage

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCueZAfjktaqZrv0B4s0HQhpj18t5oQDZ8",
  authDomain: "wms-app-633f8.firebaseapp.com",
  projectId: "wms-app-633f8",
  storageBucket: "wms-app-633f8.appspot.com",
  messagingSenderId: "426700211099",
  appId: "1:426700211099:web:ff8186fd8ec76b1baf573e",
  measurementId: "G-1803MYW841",
};

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Initialize Firebase Storage

// Export the Firebase services you need
export { auth, db, storage, collection, addDoc, doc, getDoc, updateDoc };
