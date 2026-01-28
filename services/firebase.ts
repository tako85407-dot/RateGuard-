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
  increment,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  writeBatch,
  arrayUnion
} from "firebase/firestore";
import { UserProfile, QuoteData, LiveRate, Audit } from "../types";

// --- CONFIGURATION ---
// Prioritize Vercel Env Vars, fallback to hardcoded values for local dev convenience
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyAP_fpKfZ4gANhlNzUBhJbFKHWRauEF7hc",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "rateguard-3d8b9.firebaseapp.com",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "rateguard-3d8b9",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "rateguard-3d8b9.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "811913626284",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:811913626284:web:db6d49f5d8ce3ad12c1509"
};

// --- INITIALIZATION ---
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };

// --- HELPER: USER HANDSHAKE & SELF-HEALING ORG ---
// Ensures Firestore document exists and User belongs to an Org
export const initializeUserProfile = async (user: FirebaseUser) => {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  let userData: any = {};
  let isNewUser = false;

  if (!userSnap.exists()) {
    isNewUser = true;
    userData = {
      email: user.email,
      displayName: user.displayName || 'Agent',
      role: "free",
      credits: 5,
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    
    // Default settings for new user
    await setDoc(doc(db, "settings", user.uid), {
      profitThreshold: 15,
      autoAudit: true,
      notifications: { email: true }
    });
  } else {
    userData = userSnap.data();
    await updateDoc(userRef, { lastSeen: Date.now() });
  }

  // --- SELF-HEALING ORG LOGIC ---
  // If user has no orgId, create a new Organization and link them
  if (!userData.orgId) {
    console.log("Healing: User has no Org. Creating new...");
    const orgName = userData.companyName || `${userData.displayName || 'User'}'s Team`;
    
    // Create Org
    const orgRef = await addDoc(collection(db, "organizations"), {
      name: orgName,
      admins: [user.uid],
      members: [user.uid],
      createdAt: Date.now()
    });

    // Update User with new Org ID
    userData.orgId = orgRef.id;
    
    if (isNewUser) {
      await setDoc(userRef, userData);
    } else {
      await updateDoc(userRef, { orgId: orgRef.id });
    }
  } else if (isNewUser) {
    // Just save the new user if they somehow had an orgId (unlikely path for new, but safe)
    await setDoc(userRef, userData);
  }

  return isNewUser;
};

// --- AUTH LOGIC ---

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

export const handleEmailSignUp = async (email: string, pass: string, name: string) => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(res.user, { displayName: name });
    await sendEmailVerification(res.user);
    await firebaseSignOut(auth);
    return true;
  } catch (error) {
    console.error("Sign Up Error:", error);
    throw error;
  }
};

export const handleEmailSignIn = async (email: string, pass: string) => {
  try {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    if (!res.user.emailVerified) {
      await firebaseSignOut(auth);
      throw new Error("Email not verified. Please check your inbox.");
    }
    await initializeUserProfile(res.user);
    return res.user;
  } catch (error) {
    console.error("Sign In Error:", error);
    throw error;
  }
};

export const signOut = async () => {
  await firebaseSignOut(auth);
};

export const onAuthStateChanged = (cb: (user: FirebaseUser | null) => void) => {
  return onFirebaseAuthStateChanged(auth, cb);
};

// --- USER & DATA OPERATIONS ---

export const syncUserToFirestore = async (user: FirebaseUser): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return { uid: user.uid, ...userSnap.data() } as UserProfile;
    }
    // Self-healing attempt
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

// --- TEAM MANAGEMENT LOGIC ---

export const addTeammateByUID = async (ownerUid: string, colleagueUid: string) => {
  try {
    if (ownerUid === colleagueUid) {
      throw new Error("You cannot invite yourself.");
    }

    // 1. Get Owner's Profile to find OrgId
    const ownerRef = doc(db, "users", ownerUid);
    const ownerSnap = await getDoc(ownerRef);
    if (!ownerSnap.exists()) throw new Error("Owner profile not found.");
    
    const ownerData = ownerSnap.data();
    const orgId = ownerData.orgId;
    if (!orgId) throw new Error("Owner is not part of an organization.");

    // 2. Check if Colleague exists
    const colleagueRef = doc(db, "users", colleagueUid);
    const colleagueSnap = await getDoc(colleagueRef);
    if (!colleagueSnap.exists()) throw new Error("User ID not found in database.");

    const colleagueData = colleagueSnap.data();
    if (colleagueData.orgId === orgId) throw new Error("User is already in this team.");

    // 3. ATOMIC WRITE: Update Colleague's Org AND Update Organization Members
    const batch = writeBatch(db);

    // Update Colleague
    batch.update(colleagueRef, { orgId: orgId });

    // Update Organization
    const orgRef = doc(db, "organizations", orgId);
    batch.update(orgRef, {
      members: arrayUnion(colleagueUid)
    });

    await batch.commit();
    return { success: true };

  } catch (error: any) {
    console.error("Add Teammate Error:", error);
    return { success: false, error: error.message };
  }
};

// --- REAL-TIME RATES LOGIC ---

// 1. Writer: Simulate Market Movement
export const updateLiveRates = async () => {
  // Base rates to simulate around
  const baseRates: Record<string, number> = {
    'USD/CAD': 1.3521,
    'EUR/USD': 1.0845,
    'GBP/USD': 1.2730
  };

  const pairs = Object.keys(baseRates);

  for (const pair of pairs) {
    const base = baseRates[pair];
    // Random fluctuation +/- 0.0005
    const fluctuation = (Math.random() - 0.5) * 0.001; 
    const midMarket = base + fluctuation;
    
    // Bank spread ~2%
    const bankRate = midMarket * 1.02;
    // RateGuard optimization ~0.3% spread
    const rateGuardRate = midMarket * 1.003;
    
    const savingsPips = Math.round((bankRate - rateGuardRate) * 10000);

    const rateData: Partial<LiveRate> = {
      pair,
      midMarketRate: parseFloat(midMarket.toFixed(5)),
      bankRate: parseFloat(bankRate.toFixed(5)),
      rateGuardRate: parseFloat(rateGuardRate.toFixed(5)),
      savingsPips,
      timestamp: Date.now(),
      trend: fluctuation > 0 ? 'up' : 'down'
    };

    // Write to Firestore 'rates' collection, doc ID = pair name
    // Using setDoc with merge to create or update
    await setDoc(doc(db, "rates", pair.replace('/', '-')), rateData, { merge: true });
  }
};

// 2. Reader: Subscribe to Rates
export const listenToRates = (callback: (rates: LiveRate[]) => void) => {
  return onSnapshot(collection(db, "rates"), (snapshot) => {
    const rates: LiveRate[] = [];
    snapshot.forEach(doc => {
      rates.push({ id: doc.id, ...doc.data() } as LiveRate);
    });
    callback(rates);
  });
};

// --- AUDIT & TEAM HISTORY LOGIC ---

export const saveAudit = async (auditData: { 
  orgId: string, 
  userId: string, 
  userName: string, 
  pair: string, 
  amount: number, 
  bankRate: number, 
  midMarketRate: number 
}) => {
  try {
    const leakage = auditData.amount * (auditData.bankRate - auditData.midMarketRate);
    
    const newAudit: Omit<Audit, 'id'> = {
      ...auditData,
      leakage: parseFloat(leakage.toFixed(2)),
      timestamp: Date.now()
    };

    await addDoc(collection(db, "audits"), newAudit);
    return true;
  } catch (e) {
    console.error("Failed to save audit", e);
    return false;
  }
};

export const listenToOrgAudits = (orgId: string, callback: (audits: Audit[]) => void) => {
  const q = query(
    collection(db, "audits"), 
    where("orgId", "==", orgId), 
    orderBy("timestamp", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const audits: Audit[] = [];
    snapshot.forEach(doc => {
      audits.push({ id: doc.id, ...doc.data() } as Audit);
    });
    callback(audits);
  });
};

// --- EXISTING QUOTE LOGIC ---

export const fetchUserQuotes = async (userId: string): Promise<QuoteData[]> => {
  try {
    const q = query(
      collection(db, "quotes"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const quotes: QuoteData[] = [];
    querySnapshot.forEach((doc) => {
      quotes.push({ id: doc.id, ...doc.data() } as QuoteData);
    });
    return quotes;
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return [];
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
      transitTime: quoteData.transitTime || 'N/A',
      pdfBase64,
      geminiRaw,
      createdAt: Date.now(),
      reliabilityScore: Math.floor(Math.random() * (99 - 70 + 1) + 70), // Mock score until API V3
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

export const fetchUserSettings = async (userId: string) => {
  try {
    const snap = await getDoc(doc(db, "settings", userId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const updateUserSettings = async (userId: string, settings: any) => {
  try {
    await updateDoc(doc(db, "settings", userId), settings);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const updateUserProfileData = async (userId: string, data: Partial<UserProfile>) => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, data);
};

export const logAnalyticsEvent = (name: string, params: any) => {
  console.log(`[Analytics] ${name}`, params);
};
