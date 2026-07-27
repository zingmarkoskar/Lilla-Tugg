import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBcOq0JWfShSxbXgO4d4tS6mZmctJNXEBc",
  authDomain: "lilla-tugg.firebaseapp.com",
  projectId: "lilla-tugg",
  storageBucket: "lilla-tugg.firebasestorage.app",
  messagingSenderId: "994628160772",
  appId: "1:994628160772:web:5617ba7b152d8dcab01451",
  measurementId: "G-RDHJKB9VFM",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
