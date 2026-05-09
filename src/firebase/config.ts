import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDh9sFuEc23eawkSh_SdIDUzfA3fdeOyTM",
  authDomain: "krisha-dfe55.firebaseapp.com",
  projectId: "krisha-dfe55",
  storageBucket: "krisha-dfe55.firebasestorage.app",
  messagingSenderId: "681754810232",
  appId: "1:681754810232:web:28c9bb4dd4595065295a8d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
