import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  connectionCode: string;
  partnerId: string | null;
  togetherSince?: number;
  lastActive?: number;
}

// Generate a random 6-character alphanumeric code
const generateConnectionCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const createUserProfile = async (user: User, displayName: string) => {
  const userRef = doc(db, 'users', user.uid);
  const code = generateConnectionCode();
  
  const userProfile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName,
    connectionCode: code,
    partnerId: null
  };

  await setDoc(userRef, userProfile);
  return userProfile;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
};

export const connectPartnerByCode = async (currentUid: string, partnerCode: string) => {
  // Find partner by code
  const q = query(collection(db, 'users'), where('connectionCode', '==', partnerCode));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    throw new Error('Invalid connection code.');
  }

  const partnerDoc = querySnapshot.docs[0];
  const partnerData = partnerDoc.data() as UserProfile;

  if (partnerData.uid === currentUid) {
    throw new Error('You cannot connect with yourself.');
  }

  const now = Date.now();

  // Update current user
  const currentUserRef = doc(db, 'users', currentUid);
  await updateDoc(currentUserRef, {
    partnerId: partnerData.uid,
    togetherSince: now
  });

  // Update partner
  const partnerRef = doc(db, 'users', partnerData.uid);
  await updateDoc(partnerRef, {
    partnerId: currentUid,
    togetherSince: now
  });

  return partnerData;
};

export const disconnectPartner = async (currentUid: string, partnerUid: string) => {
  // Update current user
  const currentUserRef = doc(db, 'users', currentUid);
  await updateDoc(currentUserRef, {
    partnerId: null
  });

  // Update partner
  const partnerRef = doc(db, 'users', partnerUid);
  await updateDoc(partnerRef, {
    partnerId: null
  });
};

