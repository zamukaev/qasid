export const getFirebaseErrorMessage = (errorCode: string): string => {
  const errorMessages: { [key: string]: string } = {
    // Auth errors
    "auth/invalid-email": "Please enter a valid email address",
    "auth/user-disabled": "This account has been disabled",
    "auth/user-not-found": "No account found with this email",
    "auth/wrong-password": "Incorrect password. Please try again",
    "auth/email-already-in-use": "An account with this email already exists",
    "auth/weak-password": "Password should be at least 6 characters",
    "auth/operation-not-allowed": "This sign-in method is not enabled",
    "auth/invalid-credential": "Invalid email or password",
    "auth/too-many-requests": "Too many attempts. Please try again later",
    "auth/network-request-failed": "Network error. Check your connection",
    "auth/requires-recent-login": "Please sign in again to continue",
    "auth/missing-email": "Please enter your email address",
    "auth/missing-password": "Please enter your password",
    "auth/invalid-login-credentials": "Invalid email or password",

    // Google Sign-In errors
    "auth/popup-closed-by-user": "Sign-in was cancelled",
    "auth/cancelled-popup-request": "Sign-in was cancelled",
    "auth/popup-blocked": "Pop-up was blocked by your browser",

    // Default
    default: "An unexpected error occurred. Please try again",
  };

  return errorMessages[errorCode] || errorMessages.default;
};
