import { create } from "zustand";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (firebaseUser: FirebaseAuthTypes.User | null) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

const mapFirebaseUser = (
  firebaseUser: FirebaseAuthTypes.User | null
): User | null => {
  if (!firebaseUser) return null;

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
  };
};

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (firebaseUser) => {
    const user = mapFirebaseUser(firebaseUser);
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },

  clearUser: () => {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));
