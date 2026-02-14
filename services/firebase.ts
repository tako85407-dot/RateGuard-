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
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
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
  arrayUnion,
  runTransaction
} from "firebase/firestore";
import { UserProfile, QuoteData, Audit, Organization, TeamMember } from "../types";

// Helper for Robust Env Vars
const getEnv = (key: string) => {
  let value = '';
  if (import.meta && (import.meta as any).env) {
    value = (import.meta as any).env[`VITE_${key}`] || 
            (import.meta as any).env[`NEXT_PUBLIC_${key}`] || 
            (import.meta as any).env[key] || 
            '';
  }
  if (value) return value;
  if (typeof process !== 'undefined' && process.env) {
    value = process.env[`VITE_${key}`] || 
            process.env[`NEXT_PUBLIC_${key}`] || 
            process.env[key] || 
            '';
  }
  return value;
};

// --- CONFIGURATION ---
const rawConfig = {
  apiKey: getEnv("FIREBASE_API_KEY"),
  authDomain: getEnv("FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("FIREBASE_APP_ID")
};

// Validate Config
const isConfigValid = !!rawConfig.apiKey && !!rawConfig.authDomain;

if (!isConfigValid) {
  console.warn("RateGuard: Firebase API Keys missing. App running in Safety Mode (No Backend).");
}

// Initialize with real or dummy config to satisfy SDK imports without crashing
const firebaseConfig = isConfigValid ? rawConfig : {
  apiKey: "AIzaSy_DUMMY_KEY_FOR_SAFE_INIT",
  authDomain: "dummy.firebaseapp.com",
  projectId: "dummy-project",
  storageBucket: "dummy.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, isConfigValid };

// --- CORE: SYNC LOGIC ---
export const syncUserAndOrg = async (user: FirebaseUser): Promise<{ userProfile: UserProfile, orgProfile: Organization | null }> => {
  if (!isConfigValid) {
     return { 
        userProfile: { 
            uid: 'demo', 
            email: 'demo@example.com', 
            displayName: 'Demo User', 
            role: 'admin', 
            credits: 999,
            orgId: 'demo-org'
        }, 
        orgProfile: {
            id: 'demo-org',
            name: 'Demo Corp',
            adminId: 'demo',
            members: ['demo'],
            plan: 'enterprise',
            maxSeats: 10,
            credits: 100,
            createdAt: Date.now()
        } 
    };
  }

  try {
    const userRef = doc(db, "users", user.uid);
    let userSnap = await getDoc(userRef);

    const defaultProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Agent',
        role: 'member',
        credits: 5, // Legacy field
        hasSeenIntro: false,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        companyName: '',
        country: '',
        taxID: ''
    };

    if (!userSnap.exists()) {
      await setDoc(userRef, JSON.parse(JSON.stringify(defaultProfile)));
      await setDoc(doc(db, "settings", user.uid), { profitThreshold: 2.0, autoAudit: true });
      userSnap = await getDoc(userRef);
    } else {
        // Update last seen
        await updateDoc(userRef, { lastSeen: Date.now() });
    }

    const userData = { ...defaultProfile, ...userSnap.data() } as UserProfile;

    if (userData.orgId) {
       const orgSnap = await getDoc(doc(db, "organizations", userData.orgId));
       if (orgSnap.exists()) {
         return {
           userProfile: userData,
           orgProfile: { id: orgSnap.id, ...orgSnap.data() } as Organization
         };
       } else {
         await updateDoc(userRef, { orgId: null });
         userData.orgId = undefined; 
       }
    }
    return { userProfile: userData, orgProfile: null };
  } catch (error) {
    console.error("Critical Sync Error:", error);
    return { userProfile: { uid: user.uid, email: user.email, displayName: 'Offline', role: 'member', credits: 0 }, orgProfile: null };
  }
};

export const listenToOrg = (orgId: string, cb: (org: Organization) => void) => {
    if (!isConfigValid || !orgId) return () => {};
    return onSnapshot(doc(db, "organizations", orgId), (docSnap) => {
        if (docSnap.exists()) {
            cb({ id: docSnap.id, ...docSnap.data() } as Organization);
        }
    });
};

// --- ORG MANAGEMENT ---
export const createOrganization = async (userId: string, orgData: Partial<Organization>) => {
  if (!isConfigValid) return "demo-org-id";
  const newOrgData = {
    name: orgData.name || 'New Organization',
    adminId: userId,
    members: [userId],
    plan: 'free',
    maxSeats: 5,
    credits: 10, // Initial Shared Credits
    createdAt: Date.now()
  };
  const orgRef = await addDoc(collection(db, "organizations"), newOrgData);
  await updateDoc(doc(db, "users", userId), { orgId: orgRef.id, role: 'admin' });
  return orgRef.id;
};

export const joinOrganization = async (userId: string, orgId: string) => {
  if (!isConfigValid) return { success: true };
  try {
    const orgRef = doc(db, "organizations", orgId);
    const userRef = doc(db, "users", userId);
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error("User does not exist.");
      const userData = userDoc.data() as UserProfile;
      if (userData.orgId) throw new Error("Already in an organization.");
      const orgDoc = await transaction.get(orgRef);
      if (!orgDoc.exists()) throw new Error("Organization not found.");
      const orgData = orgDoc.data() as Organization;
      if (orgData.members.includes(userId)) return;
      transaction.update(orgRef, { members: arrayUnion(userId) });
      transaction.update(userRef, { orgId: orgId, role: 'member' });
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
};

export const markIntroSeen = async (userId: string) => {
  if (!isConfigValid) return true;
  try { await updateDoc(doc(db, "users", userId), { hasSeenIntro: true }); return true; } catch (e) { return false; }
};

export const fetchTeamMembers = async (orgId: string): Promise<TeamMember[]> => {
    if (!isConfigValid) return [];
    try {
        const q = query(collection(db, "users"), where("orgId", "==", orgId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data.displayName || 'Unknown Agent',
                role: data.role || 'member',
                status: 'Online', // Inference
                activity: `Last active ${new Date(data.lastSeen || Date.now()).toLocaleDateString()}`,
                email: data.email
            } as TeamMember;
        });
    } catch (e) {
        console.error("Failed to fetch team", e);
        return [];
    }
};

// --- AUTH WRAPPERS ---
export const handleGoogleSignIn = async () => {
  if (!isConfigValid) throw new Error("Missing Firebase Configuration");
  return (await signInWithPopup(auth, googleProvider)).user;
};

export const handleEmailSignUp = async (email: string, pass: string, name: string) => {
  if (!isConfigValid) throw new Error("Missing Firebase Configuration");
  const res = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(res.user, { displayName: name });
  await sendEmailVerification(res.user);
  await firebaseSignOut(auth);
};

export const handleEmailSignIn = async (email: string, pass: string) => {
  if (!isConfigValid) throw new Error("Missing Firebase Configuration");
  const res = await signInWithEmailAndPassword(auth, email, pass);
  if (!res.user.emailVerified) { await firebaseSignOut(auth); throw new Error("Email not verified."); }
  return res.user;
};

// --- MAGIC LINK AUTH ---
export const sendMagicLink = async (email: string) => {
  if (!isConfigValid) throw new Error("Missing Firebase Configuration");
  
  const actionCodeSettings = {
    // Redirect back to the current URL (usually the landing page or app root)
    url: window.location.href, 
    handleCodeInApp: true,
  };

  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem('emailForSignIn', email);
};

export const finishMagicLinkSignIn = async (currentUrl: string, email?: string | null) => {
  // If config is missing (Safety Mode), just return "notLink" so the app continues to standard auth check
  if (!isConfigValid) return { success: false, notLink: true };
  
  if (isSignInWithEmailLink(auth, currentUrl)) {
    let emailToUse = email;
    
    // Attempt to get from local storage if not provided
    if (!emailToUse) {
      emailToUse = window.localStorage.getItem('emailForSignIn');
    }

    // If still no email (user opened link on different device), return specific status
    if (!emailToUse) {
      return { success: false, needsEmail: true };
    }

    try {
      const result = await signInWithEmailLink(auth, emailToUse, currentUrl);
      window.localStorage.removeItem('emailForSignIn');
      return { success: true, user: result.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, notLink: true };
};

export const signOut = async () => { 
  if (!isConfigValid) return;
  await firebaseSignOut(auth); 
};

export const onAuthStateChanged = (cb: (user: FirebaseUser | null) => void) => {
  if (!isConfigValid) {
    // Return mock user immediately in demo mode
    cb({ uid: 'demo', email: 'demo@example.com', displayName: 'Demo User', emailVerified: true, providerData: [] } as any);
    return () => {};
  }
  return onFirebaseAuthStateChanged(auth, cb);
};

// --- DATA ---
export const fetchOrgQuotes = async (orgId: string): Promise<QuoteData[]> => {
  if (!isConfigValid) return [];
  try {
    const q = query(collection(db, "quotes"), where("orgId", "==", orgId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const quotes: QuoteData[] = [];
    querySnapshot.forEach((doc) => quotes.push({ id: doc.id, ...doc.data() } as QuoteData));
    return quotes;
  } catch (error) { console.error(error); return []; }
};

export const saveQuoteToFirestore = async (
  userId: string, 
  orgId: string, 
  quoteData: Partial<QuoteData>, 
  pdfBase64: string, 
  geminiRaw: any
): Promise<{success: true, id: string, [key: string]: any} | {success: false, error: any}> => {
  if (!isConfigValid) {
    // Return mock success in demo mode
    return { success: true, id: "demo-quote-" + Date.now(), ...quoteData };
  }

  try {
    if (!userId || !orgId) throw new Error("Missing ID.");

    // SAFETY CHECK: Firestore limit is 1MB. If file is close to limit, do NOT save base64.
    let safePdfBase64: string | null = pdfBase64;
    const sizeInBytes = (pdfBase64.length * 3) / 4; 
    if (sizeInBytes > 900000) { 
        console.warn("PDF too large for Firestore document. Saving metadata only.");
        safePdfBase64 = null; 
    }

    const newQuote = {
      ...quoteData,
      userId,
      orgId,
      status: (quoteData.dispute?.recommended) ? 'flagged' : 'optimal',
      workflowStatus: 'analyzed',
      pdfBase64: safePdfBase64,
      geminiRaw,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: []
    };

    // Remove undefined
    const sanitizedQuote = JSON.parse(JSON.stringify(newQuote));

    const docRef = await addDoc(collection(db, "quotes"), sanitizedQuote);
    
    // Create Audit Record
    await addDoc(collection(db, "audits"), {
        quoteId: docRef.id,
        orgId,
        userId,
        timestamp: Date.now(),
        leakageAmount: quoteData.totalHiddenCost,
        leakagePercentage: quoteData.totalHiddenPercentage,
        pair: quoteData.pair,
        bank: quoteData.bank
    });

    // UPDATED: Deduct credit from ORGANIZATION, not user
    try {
        await updateDoc(doc(db, "organizations", orgId), { credits: increment(-1) });
    } catch (creditError) {
        console.warn("Credit update failed (non-fatal):", creditError);
    }

    return { success: true, id: docRef.id, ...newQuote };
  } catch (error: any) {
    console.error("Save Quote Error:", error);
    return { success: false, error: error.message };
  }
};

// --- BILLING ---
export const processEnterpriseUpgrade = async (userId: string, orgId: string, paypalId: string) => {
  if (!isConfigValid) return true;
  try {
    await setDoc(doc(db, "transactions", paypalId), {
      userId, orgId, amount: 231.00, status: "COMPLETED", createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "organizations", orgId), { plan: "enterprise", maxSeats: 999 });
    return true;
  } catch (error) { return false; }
};

// --- UTILS ---
export const updateComplianceProfile = async (userId: string, data: any) => {
  if (!isConfigValid) return;
  updateDoc(doc(db, "users", userId), data);
};

export const fetchUserSettings = async (userId: string) => {
  if (!isConfigValid) return null;
  const snap = await getDoc(doc(db, "settings", userId));
  return snap.exists() ? snap.data() : null;
};

export const updateUserSettings = async (userId: string, settings: any) => {
  if (!isConfigValid) return;
  updateDoc(doc(db, "settings", userId), settings);
};

export const updateUserProfileData = async (userId: string, data: Partial<UserProfile>) => {
  if (!isConfigValid) return;
  updateDoc(doc(db, "users", userId), data);
};

export const addTeammateByUID = async (ownerUid: string, colleagueUid: string) => {
  if (!isConfigValid) return { success: true };
  try {
    if (ownerUid === colleagueUid) throw new Error("Cannot invite self.");
    const ownerSnap = await getDoc(doc(db, "users", ownerUid));
    const orgId = ownerSnap.data()?.orgId;
    if (!orgId) throw new Error("Owner has no Org.");
    const colRef = doc(db, "users", colleagueUid);
    const colSnap = await getDoc(colRef);
    if (!colSnap.exists()) throw new Error("User ID not found.");
    if (colSnap.data()?.orgId === orgId) throw new Error("Already in team.");
    const batch = writeBatch(db);
    batch.update(colRef, { orgId: orgId, role: 'member' });
    batch.update(doc(db, "organizations", orgId), { members: arrayUnion(colleagueUid) });
    await batch.commit();
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
};

export const listenToOrgAudits = (orgId: string, cb: (audits: Audit[]) => void) => {
  if (!isConfigValid || !orgId) return () => {};
  const q = query(collection(db, "audits"), where("orgId", "==", orgId), orderBy("timestamp", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({id: d.id, ...d.data()} as Audit))));
};

export const saveAudit = async (data: any) => {
  if (!isConfigValid) return;
  addDoc(collection(db, "audits"), { ...data, timestamp: Date.now() });
};

export const logAnalyticsEvent = (name: string, data: any) => console.log(name, data);
