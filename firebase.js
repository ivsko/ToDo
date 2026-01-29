import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPJ16CpHGe-EUjjUuvs99l88HCRVSBe6o",
  authDomain: "project-bbc34.firebaseapp.com",
  databaseURL: "https://project-bbc34-default-rtdb.firebaseio.com",
  projectId: "project-bbc34",
  storageBucket: "project-bbc34.firebasestorage.app",
  messagingSenderId: "693327947051",
  appId: "1:693327947051:web:2b75b62d28506a5e5e916e",
  measurementId: "G-BTM7Z25QHN"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app); 
