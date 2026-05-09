import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, getUserProfile } from '../services/UserService';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  partnerName: string | null;
  partnerProfile: UserProfile | null;
  userId: string | null;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  partnerName: null,
  partnerProfile: null,
  userId: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setUserProfile(null);
        setPartnerName(null);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Listen to current user document
    const unsubscribeDoc = onSnapshot(doc(db, 'users', currentUser.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data() as UserProfile;
        setUserProfile(profileData);
      } else {
        // Auto-create profile for existing users who don't have one
        import('../services/UserService').then(({ createUserProfile }) => {
          createUserProfile(currentUser, currentUser.displayName || 'User');
        });
      }
      setLoading(false);
    });

    return unsubscribeDoc;
  }, [currentUser]);

  useEffect(() => {
    if (!userProfile?.partnerId) {
      setPartnerProfile(null);
      setPartnerName(null);
      return;
    }

    const unsubscribePartner = onSnapshot(
      doc(db, 'users', userProfile.partnerId),
      (docSnap) => {
        if (docSnap.exists()) {
          const pData = docSnap.data() as UserProfile;
          setPartnerProfile(pData);
          setPartnerName(pData.displayName);
        } else {
          setPartnerProfile(null);
          setPartnerName('Partner');
        }
      },
      (error) => {
        console.error('Error listening to partner profile:', error);
        setPartnerProfile(null);
        setPartnerName('Partner');
      }
    );

    return unsubscribePartner;
  }, [userProfile?.partnerId]);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, partnerName, partnerProfile, userId: currentUser?.uid || null }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
