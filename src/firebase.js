import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTxpCrYddJII9i7JQ2ZykhDoXzuqz8M4Q",
  authDomain: "milkarapp-1ee7e.firebaseapp.com",
  projectId: "milkarapp-1ee7e",
  storageBucket: "milkarapp-1ee7e.firebasestorage.app",
  messagingSenderId: "694568697171",
  appId: "1:694568697171:web:94967db073d3ae5605f5a6",
  measurementId: "G-FE29CXDTJ1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
export const db = getFirestore(app);