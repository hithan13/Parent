import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";

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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

async function run() {
  await signInAnonymously(auth);
  const kioskRef = ref(database, "devices/da3ce5695efb5d67/kioskModeEnabled");
  const snap = await get(kioskRef);
  console.log("Database kioskModeEnabled:", snap.val());
  
  const appsRef = ref(database, "devices/da3ce5695efb5d67/allowedApps");
  const appsSnap = await get(appsRef);
  console.log("Database allowedApps:", appsSnap.val());
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
