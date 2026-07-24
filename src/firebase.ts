import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCd9SSn4UKpfQ0LSfY5wsAuKNxCE6Gii0c",
  authDomain: "guardianmdm-724c7.firebaseapp.com",
  databaseURL: "https://guardianmdm-724c7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "guardianmdm-724c7",
  storageBucket: "guardianmdm-724c7.firebasestorage.app",
  messagingSenderId: "612801674493",
  appId: "1:612801674493:web:ffd8a0c85b3b6bfae69294",
  measurementId: "G-958KHX39Y4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
storage.maxUploadRetryTime = 10000; // Fail fast after 10s instead of hanging
