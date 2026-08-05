import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { User } from '../types';

// Default pre-authorized seed observers for demonstration & testing
export const DEFAULT_AUTHORIZED_OBSERVERS: Partial<User>[] = [
  {
    displayName: 'Amina Bello',
    email: 'amina.bello@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-LAG-014',
    assignedPollingUnitName: 'Ikeja Primary School, Ward 02',
    phone: '+234 802 345 6789',
    state: 'Lagos',
    lga: 'Ikeja',
    status: 'active'
  },
  {
    displayName: 'Chidi Okonkwo',
    email: 'chidi.okonkwo@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-FCT-042',
    assignedPollingUnitName: 'Garki Model Secondary, Area 11',
    phone: '+234 803 987 6543',
    state: 'FCT',
    lga: 'Abuja Municipal',
    status: 'active'
  },
  {
    displayName: 'Blessing Nwosu',
    email: 'blessing.nwosu@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-RV-089',
    assignedPollingUnitName: 'Port Harcourt Township Hall',
    phone: '+234 814 112 2334',
    state: 'Rivers',
    lga: 'Port Harcourt',
    status: 'active'
  },
  {
    displayName: 'Ibrahim Danlami',
    email: 'ibrahim.danlami@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-KN-102',
    assignedPollingUnitName: 'Kano Central Library, Ward 05',
    phone: '+234 805 443 3221',
    state: 'Kano',
    lga: 'Kano Municipal',
    status: 'inactive'
  },
  {
    displayName: 'Folake Adeleke',
    email: 'folake.adeleke@civicwatch.org',
    role: 'supervisor',
    assignedPollingUnitId: 'SUP-OYO-01',
    assignedPollingUnitName: 'Ibadan North Zonal Operations',
    phone: '+234 809 776 5544',
    state: 'Oyo',
    lga: 'Ibadan North',
    status: 'active'
  },
  {
    displayName: 'Kemi Adebayo',
    email: 'kemi.adebayo@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-LAG-016',
    assignedPollingUnitName: 'Gbagada Comprehensive High School',
    phone: '+234 803 111 2233',
    state: 'Lagos',
    lga: 'Kosofe',
    status: 'active'
  },
  {
    displayName: 'Farouk Usman',
    email: 'farouk.usman@civicwatch.org',
    role: 'supervisor',
    assignedPollingUnitId: 'SUP-KN-02',
    assignedPollingUnitName: 'Kano Central Zonal Hub',
    phone: '+234 802 999 8877',
    state: 'Kano',
    lga: 'Kano Municipal',
    status: 'active'
  },
  {
    displayName: 'David Okoh',
    email: 'david.okoh@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-RV-104',
    assignedPollingUnitName: 'Rumuokwuta Girls Secondary',
    phone: '+234 814 555 4433',
    state: 'Rivers',
    lga: 'Port Harcourt',
    status: 'active'
  }
];

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

  // 4. Fallback check against seed observers list
  if (!matchedObserverRecord) {
    const seedMatch = DEFAULT_AUTHORIZED_OBSERVERS.find(
      s => s.email && s.email.trim().toLowerCase() === userEmail
    );
    if (seedMatch) {
      matchedObserverRecord = seedMatch;
    }
  }

  // 5. Evaluate result
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
  const newUserProfile: User = {
    uid: fUser.uid,
    displayName: matchedObserverRecord.displayName || fUser.displayName || 'Field Observer',
    email: fUser.email,
    phone: matchedObserverRecord.phone || '',
    role: matchedObserverRecord.role || 'observer',
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
