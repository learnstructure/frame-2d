import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, increment, setDoc, onSnapshot } from "firebase/firestore";

// Load config from process.env (injected by Vite define)
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase only if config is present to prevent crashes during dev without credentials
let db: any = null;
if (firebaseConfig.apiKey) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) {
        console.error("Firebase initialization error:", e);
    }
}

/**
 * Increments the analysis count in Firestore.
 * Path: default/info
 * Field: count.analysis
 */
export const incrementAnalysisCount = async () => {
    if (!db) {
        console.warn("Firebase not initialized. Check .env variables.");
        return;
    }

    // Reference to collection "default", document "info"
    const docRef = doc(db, "default", "info");

    try {
        // Attempt to increment the nested field "count.analysis"
        await updateDoc(docRef, {
            "count.analysis": increment(1)
        });
    } catch (error: any) {
        // If the document doesn't exist yet, create it
        if (error.code === 'not-found') {
            try {
                await setDoc(docRef, {
                    count: { analysis: 1 }
                }, { merge: true });
            } catch (createError) {
                console.error("Failed to create analysis counter doc:", createError);
            }
        } else {
            console.error("Failed to increment analysis count:", error);
        }
    }
};

/**
 * Subscribes to the analysis count in Firestore.
 * Callback receives the current count.
 * Returns an unsubscribe function.
 */
export const subscribeToAnalysisCount = (callback: (count: number) => void) => {
    if (!db) return () => { };

    const docRef = doc(db, "default", "info");

    // onSnapshot provides real-time updates
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Check if count exists and has analysis property
            const count = data.count?.analysis || 0;
            callback(count);
        } else {
            callback(0);
        }
    }, (error) => {
        console.warn("Failed to subscribe to analysis count:", error);
    });
};