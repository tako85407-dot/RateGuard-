
import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent as firebaseLogEvent } from "firebase/analytics";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  signOut, 
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  runTransaction,
  collection
} from "firebase/firestore";
import { UserProfile, QuoteData } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyC9dJAyiVilxlyr_KJX1lw1kH_exFzheas",
  authDomain: "rateguard-a46d6.firebaseapp.com",
  projectId: "rateguard-a46d6",
  storageBucket: "rateguard-a46d6.firebasestorage.app",
  messagingSenderId: "43714758111",
  appId: "1:43714758111:web:49b7ecab330ef69c21306a",
  measurementId: "G-Y19ZXQKFEZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- Analytics Helper ---
export const logAnalyticsEvent = (eventName: string, params?: any) => {
  try {
    firebaseLogEvent(analytics, eventName, params);
  } catch (e) {
    console.warn("Analytics Error:", e);
  }
};

// --- User Synchronization (The "Upsert" Pattern) ---
export const syncUserToFirestore = async (user: User): Promise<UserProfile | null> => {
  if (!user) return null;

  const userRef = doc(db, "users", user.uid);
  
  try {
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // User exists: Update lastSeen
      await updateDoc(userRef, {
        lastSeen: serverTimestamp()
      });
      logAnalyticsEvent('auth_success', { method: 'existing_user' });
      return userSnap.data() as UserProfile;
    } else {
      // User missing: Create new doc with default credits
      const newUserProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        credits: 5, // Free trial credits
        tier: 'free',
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      };
      
      await setDoc(userRef, newUserProfile);
      logAnalyticsEvent('auth_success', { method: 'new_signup' });
      return newUserProfile;
    }
  } catch (error) {
    console.error("Error syncing user profile:", error);
    logAnalyticsEvent('error_boundary', { message: 'firestore_sync_failed' });
    return null;
  }
};

// --- The Analysis Transaction (Atomic Operation) ---
export const deductCreditsAndSaveQuote = async (userId: string, quoteData: QuoteData): Promise<{ success: boolean; newCredits?: number; error?: string }> => {
  const userRef = doc(db, "users", userId);
  const quoteRef = doc(collection(db, "quotes")); // Auto-ID

  try {
    return await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw "User does not exist!";
      }

      const userData = userDoc.data() as UserProfile;
      const currentCredits = userData.credits || 0;

      if (currentCredits <= 0) {
        throw "Insufficient credits";
      }

      // 1. Deduct Credit
      const newCredits = currentCredits - 1;
      transaction.update(userRef, { credits: newCredits });

      // 2. Save Quote Data
      transaction.set(quoteRef, {
        ...quoteData,
        ownerId: userId,
        timestamp: serverTimestamp(),
        analyzedAt: new Date().toISOString()
      });

      return { success: true, newCredits };
    });
  } catch (e: any) {
    console.error("Transaction failed: ", e);
    logAnalyticsEvent('error_boundary', { message: 'transaction_failed', error: e.toString() });
    return { success: false, error: e.toString() };
  }
};

export { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  signOut, 
  onAuthStateChanged,
  User 
};
