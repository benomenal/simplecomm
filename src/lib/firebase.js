// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAip5S4Flyqaq7OpnmdCVl_U8YdXMB4h6k", // Ganti "a" dengan API Key aslimu
  authDomain: "community-webapp-d5747.firebaseapp.com",
  databaseURL: "https://community-webapp-d5747-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "community-webapp-d5747",
  storageBucket: "community-webapp-d5747.firebasestorage.app",
  messagingSenderId: "341474671768",
  appId: "1:341474671768:web:8225dd29535f124ce824ed",
  measurementId: "G-0J1HN6R33G"
};

// Singleton Pattern: Cek apakah app sudah ada agar tidak error saat hot-reload
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inisialisasi Service
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export Service (Hanya sekali di sini)
export { app, auth, db, storage };