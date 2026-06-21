import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "totemic-bot-q18qq",
  appId: "1:175855928796:web:b2716147740800b2effb19",
  apiKey: "AIzaSyCvQYYf1bCjBJkaX_vcRizQl9iGs3i2omk",
  authDomain: "totemic-bot-q18qq.firebaseapp.com",
  storageBucket: "totemic-bot-q18qq.firebasestorage.app",
  messagingSenderId: "175855928796"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific database ID provisionsed by AI Studio
export const db = getFirestore(app, "ai-studio-dbc4405b-42b4-4a37-b3ce-718935fb050b");

// Initialize Auth
export const auth = getAuth(app);
