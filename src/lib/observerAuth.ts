import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { User } from '../types';

export const PRIMARY_ADMIN_EMAIL = 'ajibadebasit40@gmail.com';

/**
 * Verifies whether a user logging in via Google Auth is on the imported observer roster or is an admin.
 * If authorized, binds or creates their User profile.
 * If unauthorized, throws an explicit error and signs out.
 */
export async function authenticateAndAuthorizeUser(fUser: FirebaseUser): Promise<User> {
  if (!fUser || !fUser.email) {
    await signOut(auth);
    throw new Error('Authentication failed: No valid email address associated with your Google account.');
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

  // 2. Primary Admin check
  if (userEmail === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    const adminUser: User = {
      uid: fUser.uid,
      displayName: fUser.displayName || 'System Administrator',
      email: fUser.email,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(userRef, { ...adminUser, updatedAt: serverTimestamp() });
    } catch (e) {
      console.warn('Could not write admin profile to Firestore:', e);
    }
    return adminUser;
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

  // 6. Bind imported record to this user's Google UID in `users/{fUser.uid}`
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
    });
  } catch (err) {
    console.warn('Error saving linked observer profile:', err);
  }

  return newUserProfile;
}
