import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getStorage,
  ref,
  listAll,
  getDownloadURL,
  deleteObject,
  uploadBytes,
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDQdnqvQpagLHw-l_GKzWbzI7Rs47C6CTw",
  authDomain: "label-b1.firebaseapp.com",
  projectId: "label-b1",
  storageBucket: "label-b1.firebasestorage.app",
  messagingSenderId: "89801642346",
  appId: "1:89801642346:web:aba864a827ebd6d0681513",
  measurementId: "G-06N8NTRCH4",
};

const firebaseApp = initializeApp(firebaseConfig);
const imageDb = getStorage(firebaseApp); // Giữ nguyên imageDb
const firestoreDb = getFirestore(firebaseApp);

export {
  firestoreDb,
  firebaseApp,
  imageDb,
  ref,
  listAll,
  getDownloadURL,
  deleteObject,
  uploadBytes,
};
