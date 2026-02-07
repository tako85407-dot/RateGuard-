
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
  arrayUnion,
  runTransaction
} from "firebase/firestore";
import { UserProfile, QuoteData, LiveRate, Audit, Organization } from "../types";

// Helper for Robust Env Vars
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[`VITE_${key}`] || 
           process.env[`NEXT_PUBLIC_${key}`] || 
           process.env[key] || 
           '';
  }
  return '';
};

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: getEnv("FIREBASE_API_KEY") || "AIzaSyAP_fpKfZ4gANhlNzUBhJbFKHWRauEF7hc",
  authDomain: getEnv("FIREBASE_AUTH_DOMAIN") || "rateguard-3d8b9.firebaseapp.com",
  projectId: getEnv("FIREBASE_PROJECT_ID") || "rateguard-3d8b9",
  storageBucket: getEnv("FIREBASE_STORAGE_BUCKET") || "rateguard-3d8b9.firebasestorage.app",
  messagingSenderId: getEnv("FIREBASE_MESSAGING_SENDER_ID") || "811913626284",
  appId: getEnv("FIREBASE_APP_ID") || "1:811913626284:web:db6d49f5d8ce3ad12c1509"
};

// --- INITIALIZATION ---
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };

// --- CORE: SYNC LOGIC ---
export const syncUserAndOrg = async (user: FirebaseUser): Promise<{ userProfile: UserProfile, orgProfile: Organization | null }> => {
  try {
    const userRef = doc(db, "users", user.uid);
    let userSnap = await getDoc(userRef);

    // Define Default Schema
    const defaultProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Agent',
        role: 'member',
        credits: 5,
        hasSeenIntro: false,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        companyName: '',
        country: '',
        taxID: ''
    };

    // 1. AUTO-CREATE IF MISSING
    if (!userSnap.exists()) {
      const firestoreData = JSON.parse(JSON.stringify(defaultProfile));
      await setDoc(userRef, firestoreData);
      
      await setDoc(doc(db, "settings", user.uid), {
        profitThreshold: 2.0,
        autoAudit: true,
        notifications: { email: true }
      });
      
      userSnap = await getDoc(userRef);
    }

    // 2. AUTO-REPAIR
    const currentData = userSnap.data();
    const updates: any = {};
    let isDirty = false;

    if (!currentData.uid) { updates.uid = user.uid; isDirty = true; }
    if (currentData.credits === undefined) { updates.credits = 5; isDirty = true; }
    if (!currentData.role) { updates.role = 'member'; isDirty = true; }
    if (currentData.hasSeenIntro === undefined) { updates.hasSeenIntro = false; isDirty = true; }
    
    const settingsRef = doc(db, "settings", user.uid);
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
        await setDoc(settingsRef, {
            profitThreshold: 2.0,
            autoAudit: true,
            notifications: { email: true }
        });
    }

    if (isDirty) {
        await updateDoc(userRef, updates);
        userSnap = await getDoc(userRef); 
    }

    const userData = { ...defaultProfile, ...userSnap.data() } as UserProfile;

    // 3. ORG SYNC & REPAIR
    if (userData.orgId) {
       const orgSnap = await getDoc(doc(db, "organizations", userData.orgId));
       if (orgSnap.exists()) {
         await updateDoc(userRef, { lastSeen: Date.now() });
         const orgData = orgSnap.data() as Organization;
         
         if (orgData.members && !orgData.members.includes(user.uid)) {
             await updateDoc(doc(db, "organizations", userData.orgId), {
                 members: arrayUnion(user.uid)
             });
         }

         return {
           userProfile: userData,
           orgProfile: { id: orgSnap.id, ...orgData } as Organization
         };
       } else {
         console.warn("Orphaned Org ID detected. Repairing user profile...");
         await updateDoc(userRef, { orgId: null });
         userData.orgId = undefined; 
       }
    }

    return { userProfile: userData, orgProfile: null };

  } catch (error) {
    console.error("Critical Sync Error:", error);
    return { 
        userProfile: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Offline User',
            role: 'member',
            credits: 0,
            hasSeenIntro: false,
            createdAt: Date.now()
        }, 
        orgProfile: null 
    };
  }
};

// --- ORG MANAGEMENT HELPERS ---
export const createOrganization = async (userId: string, orgData: Partial<Organization>) => {
  const newOrgData = {
    name: orgData.name || 'New Organization',
    adminId: userId,
    members: [userId],
    plan: 'free',
    maxSeats: 5,
    createdAt: Date.now()
  };

  const orgRef = await addDoc(collection(db, "organizations"), newOrgData);
  await updateDoc(doc(db, "users", userId), { orgId: orgRef.id, role: 'admin' });
  return orgRef.id;
};

export const joinOrganization = async (userId: string, orgId: string) => {
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

      if (orgData.plan === 'free' && orgData.members.length >= orgData.maxSeats) {
        throw new Error("Organization is full (Free Tier Limit).");
      }

      transaction.update(orgRef, { members: arrayUnion(userId) });
      transaction.update(userRef, { orgId: orgId, role: 'member' });
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

export const markIntroSeen = async (userId: string) => {
  try {
    await updateDoc(doc(db, "users", userId), { hasSeenIntro: true });
    return true;
  } catch (e) { return false; }
};

// --- AUTH HANDLERS ---
export const handleGoogleSignIn = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

export const handleEmailSignUp = async (email: string, pass: string, name: string) => {
  const res = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(res.user, { displayName: name });
  await sendEmailVerification(res.user);
  await firebaseSignOut(auth);
};

export const handleEmailSignIn = async (email: string, pass: string) => {
  const res = await signInWithEmailAndPassword(auth, email, pass);
  if (!res.user.emailVerified) {
    await firebaseSignOut(auth);
    throw new Error("Email not verified.");
  }
  return res.user;
};

export const signOut = async () => { await firebaseSignOut(auth); };
export const onAuthStateChanged = (cb: (user: FirebaseUser | null) => void) => onFirebaseAuthStateChanged(auth, cb);

// --- DATA OPERATIONS ---
export const fetchOrgQuotes = async (orgId: string): Promise<QuoteData[]> => {
  try {
    const q = query(
      collection(db, "quotes"),
      where("orgId", "==", orgId),
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

export const saveQuoteToFirestore = async (userId: string, orgId: string, quoteData: Partial<QuoteData>, pdfBase64: string, geminiRaw: any): Promise<{success: true, id: string, [key: string]: any} | {success: false, error: any}> => {
  try {
    if (!userId) throw new Error("User ID is missing.");
    if (!orgId) throw new Error("Organization ID is missing.");

    const quoteSize = new Blob([pdfBase64]).size;
    if (quoteSize > 1048487) throw new Error("File too large (< 1MB only).");

    const amount = Number(quoteData.amount) || 0;
    
    const markupCost = quoteData.markupCost !== undefined 
        ? Number(quoteData.markupCost) 
        : amount * 0.022;
    
    const newQuote = {
      userId,
      orgId,
      status: markupCost > 200 ? 'flagged' : 'analyzed',
      workflowStatus: 'uploaded',
      bank: quoteData.bank || 'Unknown Bank',
      pair: quoteData.pair || 'USD/EUR',
      amount: amount,
      exchangeRate: Number(quoteData.exchangeRate) || 1.0,
      midMarketRate: Number(quoteData.midMarketRate) || 0,
      markupCost: markupCost,
      totalCost: Number(quoteData.totalCost) || 0,
      fees: quoteData.fees || [],
      valueDate: quoteData.valueDate || new Date().toISOString().split('T')[0],
      disputeDrafted: !!quoteData.disputeDrafted,
      pdfBase64,
      geminiRaw,
      createdAt: Date.now(),
      reliabilityScore: 85,
      notes: []
    };

    const sanitizedQuote = JSON.parse(JSON.stringify(newQuote));

    const docRef = await addDoc(collection(db, "quotes"), sanitizedQuote);
    await updateDoc(doc(db, "users", userId), { credits: increment(-1) });

    return { success: true, id: docRef.id, ...newQuote };
  } catch (error: any) {
    console.error("Save Quote Error:", error);
    return { success: false, error: error.message };
  }
};

// --- BILLING & ORG UPDATES ---
export const processEnterpriseUpgrade = async (userId: string, orgId: string, paypalId: string) => {
  try {
    await setDoc(doc(db, "transactions", paypalId), {
      userId,
      orgId,
      amount: 231.00,
      status: "COMPLETED",
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "organizations", orgId), { plan: "enterprise", maxSeats: 999 });
    return true;
  } catch (error) { return false; }
};

// --- REST OF HELPERS ---
export const updateComplianceProfile = async (userId: string, data: any) => updateDoc(doc(db, "users", userId), data);
export const fetchUserSettings = async (userId: string) => {
  const snap = await getDoc(doc(db, "settings", userId));
  return snap.exists() ? snap.data() : null;
};
export const updateUserSettings = async (userId: string, settings: any) => updateDoc(doc(db, "settings", userId), settings);
export const updateUserProfileData = async (userId: string, data: Partial<UserProfile>) => updateDoc(doc(db, "users", userId), data);
export const addTeammateByUID = async (ownerUid: string, colleagueUid: string) => {
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

export const listenToRates = (cb: (rates: LiveRate[]) => void) => onSnapshot(collection(db, "rates"), (snap) => cb(snap.docs.map(d => ({id: d.id, ...d.data()} as LiveRate))));
export const updateLiveRates = async () => {};
export const listenToOrgAudits = (orgId: string, cb: (audits: Audit[]) => void) => {
  if (!orgId) return () => {};
  const q = query(collection(db, "audits"), where("orgId", "==", orgId), orderBy("timestamp", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({id: d.id, ...d.data()} as Audit))));
};
export const saveAudit = async (data: any) => addDoc(collection(db, "audits"), { ...data, timestamp: Date.now() });
export const logAnalyticsEvent = (name: string, data: any) => console.log(name, data);
