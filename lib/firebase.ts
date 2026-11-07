import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: "AIzaSyDSu2D_Ld_cf3d_w4rej0e1DbGB61oQVy0",
  authDomain: "pulse-cf829.firebaseapp.com",
  projectId: "pulse-cf829",
  storageBucket: "pulse-cf829.firebasestorage.app",
  messagingSenderId: "76324774754",
  appId: "1:76324774754:web:4a9f361a57d54510d6823b",
};

export function getFirebase() {
  const app = getApps().length ? getApp() : initializeApp(config);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return { auth: getAuth(app), db: getFirestore(app), provider };
}
