import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  userName: string;
  isBiometricAuthenticated: boolean;
  isUnlocked: boolean;
  biometricsEnabled: boolean;
  authenticateWithBiometrics: () => Promise<boolean>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  unlockApp: () => Promise<boolean>;
  updateUserName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [isBiometricAuthenticated, setIsBiometricAuthenticated] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [biometricsEnabled, setBiometricsState] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const stored = await SecureStore.getItemAsync('biometricsEnabled');
      setBiometricsState(stored === 'true');
      return stored === 'true';
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      const isBioEnabled = await loadSettings();

      if (firebaseUser) {
        if (!isBioEnabled) {
          setIsUnlocked(true); // Auto unlock if biometrics not required
        } else {
          setIsUnlocked(false); // Require unlock screen
        }
        // Load user profile from Firestore
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserName(docSnap.data().name || '');
          }
        } catch (e) {
          // Firestore not yet configured or offline
          console.warn('Could not load user profile:', e);
        }
      } else {
        setUserName('');
        setIsBiometricAuthenticated(false);
        setIsUnlocked(false);
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const updateUserName = async (name: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { name }, { merge: true });
      setUserName(name);
    } catch (e) {
      console.error('Could not update user name:', e);
    }
  };

  const authenticateWithBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Autentique-se para acessar o app',
          fallbackLabel: 'Usar senha',
        });

        if (result.success) {
          setIsBiometricAuthenticated(true);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Biometric auth error', error);
      return false;
    }
  };

  const unlockApp = async () => {
    const success = await authenticateWithBiometrics();
    if (success) {
      setIsUnlocked(true);
    }
    return success;
  };

  const setBiometricsEnabled = async (enabled: boolean) => {
    await SecureStore.setItemAsync('biometricsEnabled', enabled ? 'true' : 'false');
    setBiometricsState(enabled);
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setIsBiometricAuthenticated(false);
      setIsUnlocked(false);
    } catch (error) {
      console.error('Sign out error', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        userName,
        isBiometricAuthenticated,
        isUnlocked,
        biometricsEnabled,
        authenticateWithBiometrics,
        setBiometricsEnabled,
        unlockApp,
        updateUserName,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
