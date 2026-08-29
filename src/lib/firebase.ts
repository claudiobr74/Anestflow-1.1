import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, memoryLocalCache, memoryLruGarbageCollector } from "firebase/firestore";
import config from "../../firebase-applet-config.json";

const firebaseConfig = {
  projectId: config.projectId,
  appId: config.appId,
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  measurementId: config.measurementId
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use in-memory cache to ensure full offline support during active sessions
// while preventing persistent storage/exposure of sensitive patient charts in IndexedDB on shared hospital computers
export const db = config.firestoreDatabaseId 
  ? initializeFirestore(app, { localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() }) }, config.firestoreDatabaseId)
  : initializeFirestore(app, { localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() }) });

