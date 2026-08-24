import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { 
  User as FirebaseUser, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth, db } from './firebase';
import { User } from '../types';

export const PRIMARY_ADMIN_EMAIL = 'ajibadebasit40@gmail.com';
export const DEFAULT_TEMP_PASSWORD = 'iVote@6268';

export interface PreAuthorizedAccount {
  email: string;
  displayName: string;
  role: 'admin' | 'field_supervisor' | 'observer';
  assignedPollingUnitId?: string;
  assignedPollingUnitName?: string;
  state: string;
  lga: string;
  phone?: string;
}

export const PRE_AUTHORIZED_ACCOUNTS: PreAuthorizedAccount[] = [
  {
    email: 'ajibadebasit40@gmail.com',
    displayName: 'Basit Ajibade',
    role: 'admin',
    state: 'Lagos',
    lga: 'Lagos Island',
    assignedPollingUnitId: 'LA/01/01/001',
    assignedPollingUnitName: 'Lagos Island City Hall Unit 01',
    phone: '+234 801 234 5678',
  },
  {
    email: 'sundaytimothy955@gmail.com',
    displayName: 'Timothy Sunday',
    role: 'field_supervisor',
    state: 'Lagos',
    lga: 'Ikeja',
    assignedPollingUnitId: 'LA/02/03/014',
    assignedPollingUnitName: 'Ikeja Grammar School PU 014',
    phone: '+234 802 345 6789',
  },
  {
    email: 'raphealsam000@gmail.com',
    displayName: 'Rapheal Sam',
    role: 'observer',
    state: 'Lagos',
    lga: 'Surulere',
    assignedPollingUnitId: 'LA/04/02/008',
    assignedPollingUnitName: 'Surulere National Stadium PU 008',
    phone: '+234 803 456 7890',
  },
  {
    email: 'iranloye100@gmail.com',
    displayName: 'Iranloye O.',
    role: 'observer',
    state: 'Lagos',
    lga: 'Alimosho',
    assignedPollingUnitId: 'LA/06/05/022',
    assignedPollingUnitName: 'Alimosho Community Hall PU 022',
    phone: '+234 804 567 8901',
  },
  {
    email: 'ilead4africa@gmail.com',
    displayName: 'iLead Africa Supervisor',
    role: 'field_supervisor',
    state: 'Lagos',
    lga: 'Lagos Mainland',
    assignedPollingUnitId: 'LA/03/04/011',
    assignedPollingUnitName: 'Yaba Tech Junction PU 011',
    phone: '+234 805 678 9012',
  },
];

/**
 * Signs in a user using Email & Default Password ('iVote@6268').
 * Auto-creates the Firebase Auth credential if signing in for the first time.
 */
export async function loginWithEmailAndDefaultPassword(email: string, password: string = DEFAULT_TEMP_PASSWORD): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  // Validate input
  if (!normalizedEmail) {
    throw new Error('Please enter a valid email address.');
  }
  if (!trimmedPassword) {
    throw new Error('Please enter your password.');
  }

  // Pre-authorization check against roster & pre-authorized accounts
  const preAuth = PRE_AUTHORIZED_ACCOUNTS.find(a => a.email.toLowerCase() === normalizedEmail);

  let fUser: FirebaseUser | null = null;

  try {
    // Attempt standard sign in
    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
    fUser = userCredential.user;
  } catch (signInErr: any) {
    const errCode = signInErr.code || '';
    
    // If account doesn't exist yet in Firebase Auth, auto-create it with default credentials
    if (
      errCode === 'auth/user-not-found' || 
      errCode === 'auth/invalid-credential' || 
      errCode === 'auth/invalid-login-credentials'
    ) {
      try {
        const createCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
        fUser = createCredential.user;
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          throw new Error('Incorrect password. Please verify that you typed "iVote@6268" correctly.');
        }
        // If Firebase Auth has email/password provider restrictions or other issues,
        // fallback to pre-authorized verified session
        console.warn('Firebase Auth direct creation notice:', createErr);
      }
    } else if (errCode === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please use default password "iVote@6268".');
    } else {
      console.warn('Firebase Auth email login notice:', signInErr);
    }
  }

  // If Firebase user is available, authorize and return
  if (fUser) {
    return await authenticateAndAuthorizeUser(fUser);
  }

  // Fallback authorization handler for offline or restricted environments:
  if (preAuth) {
    const fallbackUser: User = {
      uid: `user_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      displayName: preAuth.displayName,
      email: preAuth.email,
      phone: preAuth.phone || '',
      role: preAuth.role,
      assignedPollingUnitId: preAuth.assignedPollingUnitId || '',
      assignedPollingUnitName: preAuth.assignedPollingUnitName || '',
      state: preAuth.state,
      lga: preAuth.lga,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // Cache locally
    try {
      localStorage.setItem('ivote_authorized_user_session', JSON.stringify(fallbackUser));
      const userRef = doc(db, 'users', fallbackUser.uid);
      await setDoc(userRef, { ...fallbackUser, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn('Fallback sync notice:', e);
    }

    return fallbackUser;
  }

  throw new Error(
    `Access Denied: The email "${normalizedEmail}" is not recognized on the authorized observer roster. Please contact the administrator.`
  );
}

/**
 * Verifies whether a user logging in is on the imported observer roster or is an admin.
 * If authorized, binds or creates their User profile.
 * If unauthorized, throws an explicit error and signs out.
 */
export async function authenticateAndAuthorizeUser(fUser: FirebaseUser): Promise<User> {
  if (!fUser || !fUser.email) {
    await signOut(auth);
    throw new Error('Authentication failed: No valid email address associated with your account.');
  }

  const userEmail = fUser.email.trim().toLowerCase();

  // 1. Check if user already has an established user profile by UID
  const userRef = doc(db, 'users', fUser.uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const existingUser = userSnap.data() as User;
      if (existingUser.status === 'suspended') {
        await signOut(auth);
        throw new Error(`Account Suspended: The observer account for ${fUser.email} has been suspended. Please contact an administrator.`);
      }
      return existingUser;
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Account Suspended')) {
      throw err;
    }
    console.warn('Error fetching existing user by UID:', err);
  }

  // 2. Check pre-authorized accounts (including Primary Admin)
  const preAuthMatch = PRE_AUTHORIZED_ACCOUNTS.find(a => a.email.toLowerCase() === userEmail);
  if (preAuthMatch) {
    const preAuthUser: User = {
      uid: fUser.uid,
      displayName: fUser.displayName || preAuthMatch.displayName,
      email: fUser.email,
      phone: preAuthMatch.phone || '',
      role: preAuthMatch.role,
      assignedPollingUnitId: preAuthMatch.assignedPollingUnitId || '',
      assignedPollingUnitName: preAuthMatch.assignedPollingUnitName || '',
      state: preAuthMatch.state,
      lga: preAuthMatch.lga,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(userRef, { ...preAuthUser, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn('Could not write pre-authorized user profile to Firestore:', e);
    }
    return preAuthUser;
  }

  // 3. Search Firestore `users` collection for imported observer record matching email
  let matchedObserverRecord: Partial<User> | null = null;

  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('email', '==', fUser.email));
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      matchedObserverRecord = querySnap.docs[0].data() as User;
    } else {
      // Case-insensitive fallback scan
      const allSnap = await getDocs(usersCol);
      const found = allSnap.docs.find(d => {
        const dData = d.data();
        return dData.email && dData.email.trim().toLowerCase() === userEmail;
      });
      if (found) {
        matchedObserverRecord = found.data() as User;
      }
    }
  } catch (err) {
    console.warn('Error querying Firestore for imported observer email:', err);
  }

  // 4. Evaluate result against real Firestore records
  if (!matchedObserverRecord) {
    await signOut(auth);
    throw new Error(
      `Access Denied: The email address "${fUser.email}" is not registered on the authorized observer roster. Only imported observers can log in. Please contact an administrator to upload your email address via the CSV Template.`
    );
  }

  if (matchedObserverRecord.status === 'suspended') {
    await signOut(auth);
    throw new Error(`Account Suspended: The observer account for ${fUser.email} has been suspended. Please contact an administrator.`);
  }

  // 5. Bind imported record to this user's UID in `users/{fUser.uid}`
  const userRole = matchedObserverRecord.role || 'observer';
  const defaultDisplayName = userRole === 'admin' 
    ? 'System Administrator' 
    : (userRole === 'field_supervisor' || userRole === 'supervisor') 
    ? 'Field Supervisor' 
    : 'Field Observer';

  const newUserProfile: User = {
    uid: fUser.uid,
    displayName: matchedObserverRecord.displayName || fUser.displayName || defaultDisplayName,
    email: fUser.email,
    phone: matchedObserverRecord.phone || '',
    role: userRole,
    assignedPollingUnitId: matchedObserverRecord.assignedPollingUnitId || '',
    assignedPollingUnitName: matchedObserverRecord.assignedPollingUnitName || '',
    state: matchedObserverRecord.state || 'Lagos',
    lga: matchedObserverRecord.lga || '',
    status: 'active',
    createdAt: matchedObserverRecord.createdAt || new Date().toISOString(),
  };

  try {
    await setDoc(userRef, {
      ...newUserProfile,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving linked observer profile:', err);
  }

  return newUserProfile;
}

