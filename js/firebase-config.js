import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmGKLEA1C1L5htlJaOJ8KWL2uJOKWkVf4",
  authDomain: "comments-9c37f.firebaseapp.com",
  projectId: "comments-9c37f",
  storageBucket: "comments-9c37f.firebasestorage.app",
  messagingSenderId: "819901494216",
  appId: "1:819901494216:web:e687eea914ea71855986fd"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
