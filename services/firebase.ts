
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  User as FirebaseUser,
  signOut as firebaseSignOut
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { UserProfile, QuoteData } from "../types";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAP_fpKfZ4gANhlNzUBhJbFKHWRauEF7hc",
  authDomain: "rateguard-3d8b9.firebaseapp.com",
  projectId: "rateguard-3d8b9",
  storageBucket: "rateguard-3d8b9.firebasestorage.app",
  messagingSenderId: "811913626284",
  appId: "1:811913626284:web:db6d49f5d8ce3ad12c1509"
};

// --- INITIALIZATION ---
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };

// --- HELPER: USER HANDSHAKE ---
// Ensures Firestore document exists for the auth user
export const initializeUserProfile = async (user: FirebaseUser) => {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // New User Handshake
    const newProfile = {
      email: user.email,
      displayName: user.displayName || 'Agent',
      role: "free",
      credits: 5,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      // country & taxID will be collected in Onboarding
    };

    const defaultSettings = {
      preferredCurrency: "USD",
      theme: "dark",
      notifications: { email: true }
    };

    await setDoc(userRef, newProfile);
    await setDoc(doc(db, "settings", user.uid), defaultSettings);
    return true; // isNewUser
  } else {
    // Existing User - Update last seen
    await updateDoc(userRef, { lastSeen: Date.now() });
    return false; // isNewUser
  }
};

// --- AUTH LOGIC ---

// 1. Google Sign In
export const handleGoogleSignIn = async (): Promise<{ user: FirebaseUser; isNewUser: boolean }> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const isNewUser = await initializeUserProfile(result.user);
    return { user: result.user, isNewUser };
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

// 2. Email Sign Up
export const handleEmailSignUp = async (email: string, pass: string, name: string) => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(res.user, { displayName: name });
    await sendEmailVerification(res.user);
    // CRITICAL: Sign out immediately. User must verify before accessing the app.
    await firebaseSignOut(auth);
    return true;
  } catch (error) {
    console.error("Sign Up Error:", error);
    throw error;
  }
};

// 3. Email Sign In
export const handleEmailSignIn = async (email: string, pass: string) => {
  try {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    
    if (!res.user.emailVerified) {
      await firebaseSignOut(auth);
      throw new Error("Email not verified. Please check your inbox.");
    }

    // Handshake on successful verified login
    await initializeUserProfile(res.user);
    return res.user;
  } catch (error) {
    console.error("Sign In Error:", error);
    throw error;
  }
};

export const resendVerification = async (user: FirebaseUser) => {
  await sendEmailVerification(user);
}

export const signOut = async () => {
  await firebaseSignOut(auth);
};

export const onAuthStateChanged = (cb: (user: FirebaseUser | null) => void) => {
  return onFirebaseAuthStateChanged(auth, cb);
};

// --- DATABASE OPERATIONS ---

export const syncUserToFirestore = async (user: FirebaseUser): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return { uid: user.uid, ...userSnap.data() } as UserProfile;
    }
    // Self-healing: If user is verified but doc missing, create it now
    if (user.emailVerified) {
       await initializeUserProfile(user);
       const retrySnap = await getDoc(userRef);
       if (retrySnap.exists()) return { uid: user.uid, ...retrySnap.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Sync Profile Error:", error);
    return null;
  }
};

export const saveQuoteToFirestore = async (userId: string, quoteData: Partial<QuoteData>, pdfBase64: string, geminiRaw: any) => {
  try {
    const quoteSize = new Blob([pdfBase64]).size;
    if (quoteSize > 1048487) {
       throw new Error("File too large for direct DB storage. Must be < 1MB.");
    }

    const newQuote = {
      userId,
      status: quoteData.totalCost && quoteData.totalCost > 2000 ? 'flagged' : 'analyzed',
      workflowStatus: 'uploaded',
      carrier: quoteData.carrier || 'Unknown',
      origin: quoteData.origin || 'Unknown',
      destination: quoteData.destination || 'Unknown',
      totalAmount: quoteData.totalCost || 0,
      totalCost: quoteData.totalCost || 0,
      surcharges: quoteData.surcharges || [],
      pdfBase64,
      geminiRaw,
      createdAt: Date.now(),
      reliabilityScore: 85,
      notes: []
    };

    const docRef = await addDoc(collection(db, "quotes"), newQuote);
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      credits: increment(-1)
    });

    return { success: true, id: docRef.id, ...newQuote };
  } catch (error: any) {
    console.error("Save Quote Error:", error);
    return { success: false, error: error.message, id: undefined };
  }
};

export const processEnterpriseUpgrade = async (userId: string, paypalId: string) => {
  try {
    await setDoc(doc(db, "transactions", paypalId), {
      userId,
      subtotal: 200.00,
      taxAmount: 31.00,
      totalPaid: 231.00,
      status: "COMPLETED",
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "users", userId), {
      role: "enterprise",
      credits: 999999
    });

    return true;
  } catch (error) {
    console.error("Upgrade Error:", error);
    return false;
  }
};

export const updateComplianceProfile = async (userId: string, data: { country: string; taxID: string; companyName: string }) => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    country: data.country,
    taxID: data.taxID,
    companyName: data.companyName
  });
};

export const logAnalyticsEvent = (name: string, params: any) => {
  console.log(`[Analytics] ${name}`, params);
};
