/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  User, 
  Building, 
  Phone, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  Clock,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Layers,
  Zap,
  Cloud,
  Activity,
  Receipt,
  Package,
  Utensils,
  BarChart3,
  GitBranch,
  Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  sendEmailVerification, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile,
  onAuthStateChanged,
  signOut,
  EmailAuthProvider,
  linkWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';
import { setGmailAccessToken } from '../lib/gmailService';

export function calculateStoreId(email: string, storeName: string): string {
  const emailClean = email.trim().toLowerCase();
  const nameClean = storeName.trim().toLowerCase();
  const storeKey = `${emailClean}:${nameClean}`;
  return 'store_' + btoa(unescape(encodeURIComponent(storeKey))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'verification' | 'link-accounts';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Account linking states
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingCred, setPendingCred] = useState<any>(null);
  const [pendingPassword, setPendingPassword] = useState('');

  // Email verification custom states
  const [verificationCode, setVerificationCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [simulatedCode, setSimulatedCode] = useState(''); // Stores OTP if SMTP is not active

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Auth diagnostic and custom errors
  const [authErrorType, setAuthErrorType] = useState<string | null>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  // Password strength states
  const [pwdStrength, setPwdStrength] = useState({
    score: 0,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false,
    hasMinLen: false
  });

  // Track password strength on change
  useEffect(() => {
    if (!password) {
      setPwdStrength({ score: 0, hasUpper: false, hasLower: false, hasNumber: false, hasSpecial: false, hasMinLen: false });
      return;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const hasMinLen = password.length >= 8;

    let score = 0;
    if (hasMinLen) score += 1;
    if (hasUpper) score += 1;
    if (hasLower) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;

    setPwdStrength({ score, hasUpper, hasLower, hasNumber, hasSpecial, hasMinLen });
  }, [password]);

  // Listen for URL verification success/failure redirects
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verified = urlParams.get('verified');
    const error = urlParams.get('error');

    if (verified === 'true') {
      toast.success('Your email has been verified! You can now sign in below.');
      setMode('login');
      // Clear URL parameters
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (verified === 'false') {
      let msg = 'Email verification link was invalid or has expired.';
      if (error === 'token_expired') {
        msg = 'Your verification link has expired. Please request a new one.';
      } else if (error === 'token_not_found') {
        msg = 'Verification token not found. Please try again.';
      }
      toast.error(msg);
      // Clear URL parameters
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Handle countdown timer for resending OTP codes
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Monitor auth state changes specifically to handle verification flow
  const successCallbackRef = React.useRef(onLoginSuccess);
  useEffect(() => {
    successCallbackRef.current = onLoginSuccess;
  }, [onLoginSuccess]);

  useEffect(() => {
    // 1. Handle incoming redirect results from Google Sign-In fallback
    getRedirectResult(auth)
      .then(async (result) => {
        if (result) {
          const user = result.user;
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setGmailAccessToken(credential.accessToken, 3600);
          }
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
              await setDoc(userDocRef, {
                uid: user.uid,
                fullName: user.displayName || 'Google Owner',
                restaurantName: `${user.displayName || 'My'}'s Bistro`,
                businessName: `${user.displayName || 'My'}'s Bistro`,
                email: user.email || '',
                phone: user.phoneNumber || '',
                role: 'RestaurantOwner',
                createdAt: new Date().toISOString(),
                emailVerified: true,
                subscriptionPlan: 'trial',
                trialEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
              });

              // Default settings
              const settingsDocRef = doc(db, 'settings', user.uid);
              await setDoc(settingsDocRef, {
                restaurantInfo: {
                  name: `${user.displayName || 'My'}'s Bistro`,
                  owner: user.displayName || 'Google Owner',
                  phone: user.phoneNumber || '',
                  email: user.email || '',
                  address: '',
                  regNumber: ''
                },
                branding: { logoUrl: '', faviconUrl: '' },
                gstTax: { gstNumber: '', gstRate: 0, taxEnabled: false },
                payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
                whatsapp: { number: '', businessName: `${user.displayName || 'My'}'s Bistro`, autoSendBills: false },
                qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
                notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
                security: { adminName: user.displayName || 'Google Owner', twoFactor: false, sessionTimeout: '30m' },
                preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
            } else {
              await updateDoc(userDocRef, {
                lastLogin: new Date().toISOString(),
                emailVerified: true
              }).catch(() => {});
            }

            toast.success(`Welcome back, ${user.displayName || 'partner'}!`);
            successCallbackRef.current(user);
          } catch (syncErr: any) {
            console.error("Redirect sync error:", syncErr);
            toast.error("Failed to synchronize your account with Firestore.");
          }
        }
      })
      .catch((error: any) => {
        console.error("Error with Google sign-in redirect result:", error);
        const errType = getFriendlyErrorMessageType(error);
        setAuthErrorType(errType);
        if (errType === 'unauthorized-domain') {
          setShowDiagnosticModal(true);
        }
      });

    // 2. Auth State Change Listener
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (currentUser.emailVerified) {
          successCallbackRef.current(currentUser);
        } else {
          setEmail(currentUser.email || '');
          setMode('verification');
        }
      }
    });
    return unsub;
  }, []);

  // Form validators
  const validateEmail = (val: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val) return 'Email address is required';
    if (!regex.test(val)) return 'Please enter a valid email address';
    return '';
  };

  const validatePhone = (val: string) => {
    const regex = /^\+?[0-9]{10,14}$/;
    if (!val) return 'Phone number is required';
    if (!regex.test(val.replace(/[\s()-]/g, ''))) return 'Please enter a valid phone number (min 10 digits)';
    return '';
  };

  const validatePasswordStrength = () => {
    if (pwdStrength.score < 4) {
      return 'Password is not strong enough. Please satisfy at least 4 criteria.';
    }
    return '';
  };

  const getFriendlyErrorMessageType = (error: any) => {
    const code = error?.code || '';
    const message = error?.message || '';

    if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
      return 'unauthorized-domain';
    }
    if (code === 'auth/popup-blocked' || message.includes('popup-blocked')) {
      return 'popup-blocked';
    }
    if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
      return 'popup-closed-by-user';
    }
    if (code === 'auth/network-request-failed' || message.includes('network-request-failed')) {
      return 'network-request-failed';
    }
    if (code === 'auth/account-exists-with-different-credential' || message.includes('account-exists-with-different-credential')) {
      return 'account-exists-with-different-credential';
    }
    if (code === 'auth/invalid-api-key' || message.includes('invalid-api-key')) {
      return 'invalid-api-key';
    }
    if (code === 'auth/invalid-auth-domain' || message.includes('invalid-auth-domain')) {
      return 'invalid-auth-domain';
    }
    if (code === 'auth/user-disabled' || message.includes('user-disabled')) {
      return 'user-disabled';
    }
    return 'generic';
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthErrorType(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    provider.addScope('email');
    provider.addScope('profile');
    provider.addScope('https://mail.google.com/');
    provider.addScope('https://www.googleapis.com/auth/gmail.send');
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    provider.addScope('https://www.googleapis.com/auth/gmail.modify');

    try {
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupError: any) {
        console.warn("Popup blocked or failed, attempting redirect fallback:", popupError);
        const errType = getFriendlyErrorMessageType(popupError);
        
        if (errType === 'popup-blocked' || popupError.code === 'auth/popup-blocked') {
          toast.loading('Popup blocked. Redirecting to Google Sign-In...');
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupError;
      }

      const user = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGmailAccessToken(credential.accessToken, 3600);
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          fullName: user.displayName || 'Google Owner',
          restaurantName: `${user.displayName || 'My'}'s Bistro`,
          businessName: `${user.displayName || 'My'}'s Bistro`,
          email: user.email || '',
          phone: user.phoneNumber || '',
          role: 'RestaurantOwner',
          createdAt: new Date().toISOString(),
          emailVerified: true,
          subscriptionPlan: 'trial',
          trialEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        });

        // Default settings
        const settingsDocRef = doc(db, 'settings', user.uid);
        await setDoc(settingsDocRef, {
          restaurantInfo: {
            name: `${user.displayName || 'My'}'s Bistro`,
            owner: user.displayName || 'Google Owner',
            phone: user.phoneNumber || '',
            email: user.email || '',
            address: '',
            regNumber: ''
          },
          branding: { logoUrl: '', faviconUrl: '' },
          gstTax: { gstNumber: '', gstRate: 0, taxEnabled: false },
          payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
          whatsapp: { number: '', businessName: `${user.displayName || 'My'}'s Bistro`, autoSendBills: false },
          qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
          notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
          security: { adminName: user.displayName || 'Google Owner', twoFactor: false, sessionTimeout: '30m' },
          preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } else {
        await updateDoc(userDocRef, {
          lastLogin: new Date().toISOString(),
          emailVerified: true
        }).catch(() => {});
      }

      toast.success(`Welcome back, ${user.displayName || 'partner'}!`);
      onLoginSuccess(user);
    } catch (e: any) {
      console.error("Google login failed:", e);
      if (e.code === 'auth/account-exists-with-different-credential' || e.message?.includes('account-exists-with-different-credential')) {
        const conflictEmail = e.customData?.email || e.email;
        const credential = GoogleAuthProvider.credentialFromError(e);
        if (conflictEmail && credential) {
          setPendingEmail(conflictEmail);
          setPendingCred(credential);
          setMode('link-accounts');
          toast('Linking Google to your existing email/password account. Please enter your password to confirm.', { icon: 'ℹ️' });
          return;
        }
      }

      const errType = getFriendlyErrorMessageType(e);
      setAuthErrorType(errType);

      let userMsg = 'Failed to sign in with Google. Please try again.';
      if (errType === 'unauthorized-domain') {
        userMsg = 'This domain is not authorized in Firebase Console.';
        setShowDiagnosticModal(true);
      } else if (errType === 'popup-blocked') {
        userMsg = 'Google Sign-In popup was blocked by your browser.';
      } else if (errType === 'popup-closed-by-user') {
        userMsg = 'Sign-in cancelled. The Google window was closed.';
      } else if (errType === 'network-request-failed') {
        userMsg = 'Network error. Please check your internet connection.';
      } else if (errType === 'account-exists-with-different-credential') {
        userMsg = 'An account with this email already exists using a different sign-in method.';
      } else if (errType === 'user-disabled') {
        userMsg = 'This account has been disabled by an administrator.';
      }

      toast.error(userMsg);
      setErrors({ form: userMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrors({ email: emailErr });
      return;
    }

    if (!password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    setLoading(true);
    try {
      // 1. Verify if user exists in Firebase Auth via backend check
      try {
        const checkRes = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const checkJson = await checkRes.json();
        if (checkJson.success && !checkJson.exists) {
          const errMsg = 'No OrderPoint Pro account was found with this email. Please create an account first.';
          setErrors({ email: errMsg });
          toast.error(errMsg);
          setLoading(false);
          return;
        }
      } catch (checkErr) {
        console.warn('Backend check-email connection failed, skipping:', checkErr);
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 1. Double check verified claim in Firebase Auth profile
      if (user.emailVerified === false) {
        toast.error('Please verify your email address to log in.');
        setMode('verification');
        setLoading(false);
        return;
      }

      // Update lastLogin in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        lastLogin: new Date().toISOString()
      }).catch(() => {});

      toast.success('Successfully logged in!');
      onLoginSuccess(user);
    } catch (e: any) {
      console.error(e);
      let errMsg = 'Invalid email or password. Please try again.';
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        errMsg = 'Incorrect login credentials. Please check and retry.';
      } else if (e.code === 'auth/too-many-requests') {
        errMsg = 'Account temporarily locked due to too many failed login attempts. Try again later.';
      }
      toast.error(errMsg);
      setErrors({ form: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate fields
    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim() || fullName.length < 2) {
      newErrors.fullName = 'Full Name is required (minimum 2 characters)';
    }

    if (!businessName.trim() || businessName.length < 3) {
      newErrors.businessName = 'Restaurant / Business Name is required (minimum 3 characters)';
    }

    const emailErr = validateEmail(email);
    if (emailErr) newErrors.email = emailErr;

    const phoneErr = validatePhone(phone);
    if (phoneErr) newErrors.phone = phoneErr;

    const pwdStrengthErr = validatePasswordStrength();
    if (pwdStrengthErr) newErrors.password = pwdStrengthErr;

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      newErrors.acceptTerms = 'You must accept the Terms of Service & Privacy Policy';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the validation errors in the form.');
      return;
    }

    setLoading(true);
    try {
      const storeId = calculateStoreId(email, businessName);

      // Check if email already exists via backend API
      let emailExists = false;
      try {
        const checkRes = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const checkJson = await checkRes.json();
        if (checkJson.success && checkJson.exists) {
          emailExists = true;
        }
      } catch (checkErr) {
        console.warn('Backend check-email failed, falling back to Firebase Auth error catch:', checkErr);
      }

      if (emailExists) {
        // Attempt to sign in with password to verify ownership
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // Double check email verification
          if (user.emailVerified === false) {
            toast.error('Please verify your email address to log in.');
            setMode('verification');
            setLoading(false);
            return;
          }

          // Check if the store already exists
          const storeDocRef = doc(db, 'stores', storeId);
          const storeDocSnap = await getDoc(storeDocRef);

          if (storeDocSnap.exists()) {
            // Case 2: Same email + same store name -> open existing store
            toast.success(`Store "${businessName}" already exists. Opening...`);
            
            // Update active store ID in user document
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
              restaurantId: storeId,
              lastLogin: new Date().toISOString()
            }).catch(() => {});

            onLoginSuccess(user);
            return;
          } else {
            // Case 3: Same email + different store name -> create new store
            toast.success(`Creating new store "${businessName}" under your account...`);

            // Create store doc
            await setDoc(storeDocRef, {
              storeId,
              ownerEmail: email.toLowerCase().trim(),
              ownerId: user.uid,
              storeName: businessName,
              storeNameNormalized: businessName.trim().toLowerCase(),
              createdAt: Date.now()
            });

            // Create default settings for this store
            const settingsDocRef = doc(db, 'settings', storeId);
            await setDoc(settingsDocRef, {
              restaurantInfo: {
                name: businessName,
                owner: fullName || user.displayName || 'Owner',
                phone: phone,
                email: email,
                address: '',
                regNumber: ''
              },
              branding: { logoUrl: '', faviconUrl: '' },
              gstTax: { gstNumber: '', gstRate: 0, taxEnabled: false },
              payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
              whatsapp: { number: '', businessName: businessName, autoSendBills: false },
              qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
              notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
              security: { adminName: fullName || user.displayName || 'Owner', twoFactor: false, sessionTimeout: '30m' },
              preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
              createdAt: Date.now(),
              updatedAt: Date.now()
            });

            // Update user profile active store
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
              restaurantId: storeId,
              lastLogin: new Date().toISOString()
            }).catch(() => {});

            onLoginSuccess(user);
            return;
          }
        } catch (signInErr: any) {
          console.error('Auto login check failed:', signInErr);
          const wrongCredMsg = 'This email is already registered. Please check your password or use a different email.';
          toast.error(wrongCredMsg);
          setErrors({ email: wrongCredMsg });
          setLoading(false);
          return;
        }
      }

      // Case 1: Brand new email + brand new store
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await sendEmailVerification(user);

      // Create user profile doc
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        fullName,
        restaurantName: businessName,
        businessName,
        email,
        phone,
        role: 'RestaurantOwner',
        restaurantId: storeId, // Set primary store ID
        createdAt: new Date().toISOString(),
        emailVerified: false,
        subscriptionPlan: 'trial',
        trialEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });

      // Create store registry document
      await setDoc(doc(db, 'stores', storeId), {
        storeId,
        ownerEmail: email.toLowerCase().trim(),
        ownerId: user.uid,
        storeName: businessName,
        storeNameNormalized: businessName.trim().toLowerCase(),
        createdAt: Date.now()
      });

      // Initialize default settings
      const settingsDocRef = doc(db, 'settings', storeId);
      await setDoc(settingsDocRef, {
        restaurantInfo: {
          name: businessName,
          owner: fullName,
          phone: phone,
          email: email,
          address: '',
          regNumber: ''
        },
        branding: { logoUrl: '', faviconUrl: '' },
        gstTax: { gstNumber: '', gstRate: 0, taxEnabled: false },
        payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
        whatsapp: { number: '', businessName: businessName, autoSendBills: false },
        qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
        notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
        security: { adminName: fullName, twoFactor: false, sessionTimeout: '30m' },
        preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      toast.success('Account registered successfully! A verification email has been sent.');
      setSimulatedCode('');
      setMode('verification');
    } catch (e: any) {
      console.error(e);
      let errMsg = e.message || 'Failed to register account. Please try again.';
      if (e.code === 'auth/email-already-in-use') {
        errMsg = 'This email address is already in use by another restaurant owner.';
      } else if (e.code === 'auth/weak-password') {
        errMsg = 'Password is too weak. Please use a stronger password.';
      }
      toast.error(errMsg);
      setErrors({ form: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrors({ email: emailErr });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent! Check your spam or inbox.');
      setMode('login');
    } catch (e: any) {
      console.error(e);
      let errMsg = 'Failed to send password reset email. Please try again.';
      if (e.code === 'auth/user-not-found') {
        errMsg = 'We could not find a registered account with that email.';
        setErrors({ email: errMsg });
      }
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userDocRef, {
            isVerified: true,
            emailVerified: true
          }).catch(() => {});

          toast.success('Your email is now verified! Welcome aboard!');
          onLoginSuccess(auth.currentUser);
        } else {
          toast.error("Your email is not verified yet. Please click the link in the email and try again.");
        }
      } else {
        toast.error("No active session found. Please try logging in.");
        setMode('login');
      }
    } catch (e: any) {
      console.error('Verification error:', e);
      toast.error(e.message || 'Failed to verify. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAccountsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPassword) {
      setErrors({ linkPassword: 'Password is required' });
      return;
    }

    setLoading(true);
    try {
      // 1. Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(auth, pendingEmail, pendingPassword);
      const user = userCredential.user;

      // 2. Link Google credential
      if (pendingCred) {
        await linkWithCredential(user, pendingCred);
      }

      // 3. Update Firestore profile to ensure provider info is updated
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        provider: 'google-linked',
        lastLogin: new Date().toISOString()
      }).catch(() => {});

      toast.success('Successfully linked accounts and signed in!');
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Failed to link Google account:', err);
      let msg = 'Failed to link Google account. Incorrect password or connection issue.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Incorrect password for the existing email account. Please check and retry.';
      }
      toast.error(msg);
      setErrors({ linkPassword: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast.success('Verification email resent! Check your inbox.');
        setResendTimer(60);
      } else {
        toast.error("No active session found. Please log in first.");
        setMode('login');
      }
    } catch (e: any) {
      console.error('Resend error:', e);
      toast.error(e.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMode('login');
      toast.success('Signed out securely.');
    } catch (e) {
      console.error(e);
    }
  };

  const getStrengthColor = (score: number) => {
    switch (score) {
      case 0: return 'bg-gray-200';
      case 1: return 'bg-rose-500';
      case 2: return 'bg-orange-500';
      case 3: return 'bg-amber-500';
      case 4: return 'bg-emerald-500';
      case 5: return 'bg-teal-500';
      default: return 'bg-gray-200';
    }
  };

  const getStrengthText = (score: number) => {
    switch (score) {
      case 0: return 'Very Weak';
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Strong';
      case 5: return 'Exceptional';
      default: return '';
    }
  };

  return (
    <div id="auth_container" className="min-h-screen bg-gradient-to-br from-[#064E3B] via-[#043427] to-[#022018] flex flex-col items-center justify-center px-4 py-6 sm:p-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] font-sans selection:bg-emerald-500 selection:text-white relative overflow-x-hidden overflow-y-auto">
      
      {/* Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.18),transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md my-auto relative z-10">
        
        {/* Simple Centered Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-5 sm:mb-6 space-y-2">
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] text-white flex items-center justify-center shadow-2xl shadow-emerald-950/60 ring-4 ring-emerald-500/20">
            <Layers size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-[900] tracking-tight text-white font-sans uppercase leading-none drop-shadow-sm">
              ORDERPOINT PRO
            </h1>
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mt-1.5 opacity-90">
              POS &amp; Restaurant OS
            </p>
          </div>
        </div>

        {/* Core Glassmorphic Card Container */}
        <div className="bg-white rounded-3xl sm:rounded-[28px] p-5 sm:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.3)] border border-emerald-500/20 relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            {/* LOGIN SCREEN */}
            {mode === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-6 text-center">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
                    Sign In
                  </h2>
                  <p className="text-slate-500 text-xs font-medium">
                    Enter your email and password to access the portal
                  </p>
                </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-5">
                    {errors.form && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>{errors.form}</span>
                      </div>
                    )}

                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 tracking-wider uppercase block">
                        Business Email Address
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <Mail size={18} />
                        </span>
                        <input
                          id="login_email"
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors({ ...errors, email: '' });
                          }}
                          placeholder="manager@restaurant.com"
                          className={`w-full h-12 pl-12 pr-4 bg-slate-50 border ${errors.email ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all font-sans`}
                          disabled={loading}
                          required
                        />
                      </div>
                      {errors.email && (
                        <p className="text-rose-500 text-xs font-medium flex items-center gap-1 mt-1">
                          <AlertTriangle size={12} /> {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-600 tracking-wider uppercase block">
                          Security Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setMode('forgot-password')}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <Lock size={18} />
                        </span>
                        <input
                          id="login_password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) setErrors({ ...errors, password: '' });
                          }}
                          placeholder="••••••••"
                          className="w-full h-12 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all font-sans"
                          disabled={loading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember me & Persistent Session */}
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 focus:ring-offset-0 transition-all"
                        />
                        <span className="text-xs font-semibold text-slate-600">Keep me logged in</span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      id="btn_login_submit"
                      type="submit"
                      disabled={loading}
                      className="w-full h-13 bg-slate-900 text-white rounded-xl font-bold tracking-wide text-xs hover:bg-slate-800 active:scale-[0.985] transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-slate-200 cursor-pointer"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin text-emerald-400" />
                      ) : (
                        <>
                          SIGN IN TO DASHBOARD
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="text-center mt-6">
                    <p className="text-xs text-slate-500 font-medium">
                      New to OrderPoint Pro?{' '}
                      <button
                        type="button"
                        onClick={() => setMode('signup')}
                        className="text-emerald-600 font-bold hover:underline"
                      >
                        Create an Owner Account
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}

              {/* SIGN UP SCREEN */}
              {mode === 'signup' && (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-6">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold mb-4"
                    >
                      <ArrowLeft size={14} /> BACK TO LOGIN
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                      Register Restaurant
                    </h1>
                    <p className="text-slate-500 text-sm">
                      Create your enterprise owner account to activate trial
                    </p>
                  </div>

                  <form onSubmit={handleSignUpSubmit} className="space-y-4">
                    
                    {/* Google OAuth Button */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full h-11 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 active:scale-[0.985] transition-all flex items-center justify-center gap-3 shadow-sm cursor-pointer mb-2"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4">
                        <path
                          fill="#EA4335"
                          d="M12 5.04c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 1.72 14.97 1 12 1 7.35 1 3.37 3.65 1.39 7.56l3.85 3C6.18 7.56 8.84 5.04 12 5.04z"
                        />
                        <path
                          fill="#4285F4"
                          d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46C18.18 15.71 17 17.22 15.4 18.28l3.75 2.91c2.19-2.02 3.46-5 3.46-8.92z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.24 10.56a6.85 6.85 0 010-4.32l-3.85-3A11.96 11.96 0 000 12c0 2.45.74 4.73 2 6.64l3.85-3.08a6.85 6.85 0 01-.61-5z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.75-2.91c-1.12.75-2.55 1.2-4.21 1.2-3.16 0-5.82-2.52-6.76-5.52l-3.85 3C3.37 20.35 7.35 23 12 23z"
                        />
                      </svg>
                      Quick Signup with Google
                    </button>

                    <div className="relative border-t border-slate-100 text-center my-4">
                      <span className="absolute left-1/2 -translate-y-1/2 -translate-x-1/2 px-3 bg-white text-[9px] font-bold text-slate-400 tracking-wider uppercase">
                        Or Complete Registration Form
                      </span>
                    </div>

                    {/* Double Columns fields on Desktop */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase block">
                          Full Name
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <User size={16} />
                          </span>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => {
                              setFullName(e.target.value);
                              if (errors.fullName) setErrors({ ...errors, fullName: '' });
                            }}
                            placeholder="John Doe"
                            className="w-full h-11 pl-10 pr-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                            disabled={loading}
                            required
                          />
                        </div>
                        {errors.fullName && <p className="text-rose-500 text-[10px] font-medium">{errors.fullName}</p>}
                      </div>

                      {/* Business Name */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase block">
                          Restaurant Name
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Building size={16} />
                          </span>
                          <input
                            type="text"
                            value={businessName}
                            onChange={(e) => {
                              setBusinessName(e.target.value);
                              if (errors.businessName) setErrors({ ...errors, businessName: '' });
                            }}
                            placeholder="My Pizza Bistro"
                            className="w-full h-11 pl-10 pr-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                            disabled={loading}
                            required
                          />
                        </div>
                        {errors.businessName && <p className="text-rose-500 text-[10px] font-medium">{errors.businessName}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Email Address */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase block">
                          Work Email
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Mail size={16} />
                          </span>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (errors.email) setErrors({ ...errors, email: '' });
                            }}
                            placeholder="owner@mybistro.com"
                            className="w-full h-11 pl-10 pr-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                            disabled={loading}
                            required
                          />
                        </div>
                        {errors.email && <p className="text-rose-500 text-[10px] font-medium">{errors.email}</p>}
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase block">
                          Phone Number
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Phone size={16} />
                          </span>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                              setPhone(e.target.value);
                              if (errors.phone) setErrors({ ...errors, phone: '' });
                            }}
                            placeholder="9876543210"
                            className="w-full h-11 pl-10 pr-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                            disabled={loading}
                            required
                          />
                        </div>
                        {errors.phone && <p className="text-rose-500 text-[10px] font-medium">{errors.phone}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Password */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase block">
                          Choose Password
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Lock size={16} />
                          </span>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (errors.password) setErrors({ ...errors, password: '' });
                            }}
                            placeholder="••••••••"
                            className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all font-sans"
                            disabled={loading}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 tracking-wider uppercase block">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Lock size={16} />
                          </span>
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                            }}
                            placeholder="••••••••"
                            className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all font-sans"
                            disabled={loading}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {errors.confirmPassword && <p className="text-rose-500 text-[10px] font-medium">{errors.confirmPassword}</p>}
                      </div>
                    </div>

                    {/* Password Strength Meter */}
                    {password && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <span>Password Strength</span>
                          <span className="text-slate-700">{getStrengthText(pwdStrength.score)}</span>
                        </div>
                        
                        {/* Progress bars */}
                        <div className="grid grid-cols-5 gap-1">
                          {[1, 2, 3, 4, 5].map((idx) => (
                            <div 
                              key={idx} 
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx <= pwdStrength.score ? getStrengthColor(pwdStrength.score) : 'bg-slate-200'
                              }`} 
                            />
                          ))}
                        </div>

                        {/* Criteria Grid */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1.5 text-[9px] font-semibold text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle size={10} className={pwdStrength.hasMinLen ? 'text-emerald-500' : 'text-slate-300'} />
                            <span>At least 8 chars</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle size={10} className={pwdStrength.hasUpper ? 'text-emerald-500' : 'text-slate-300'} />
                            <span>Uppercase letter</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle size={10} className={pwdStrength.hasLower ? 'text-emerald-500' : 'text-slate-300'} />
                            <span>Lowercase letter</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle size={10} className={pwdStrength.hasNumber ? 'text-emerald-500' : 'text-slate-300'} />
                            <span>Contains numbers</span>
                          </div>
                          <div className="flex items-center gap-1.5 col-span-2">
                            <CheckCircle size={10} className={pwdStrength.hasSpecial ? 'text-emerald-500' : 'text-slate-300'} />
                            <span>Special character (!@#$%^&*)</span>
                          </div>
                        </div>
                        {errors.password && <p className="text-rose-500 text-[10px] font-bold mt-1.5">{errors.password}</p>}
                      </div>
                    )}

                    {/* Terms Checkbox */}
                    <div className="space-y-1">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={acceptTerms}
                          onChange={(e) => {
                            setAcceptTerms(e.target.checked);
                            if (errors.acceptTerms) setErrors({ ...errors, acceptTerms: '' });
                          }}
                          className="w-4 h-4 rounded mt-0.5 text-emerald-600 border-slate-300 focus:ring-emerald-500 focus:ring-offset-0 transition-all"
                        />
                        <span className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                          I accept the <a href="#" className="text-emerald-600 hover:underline">Terms of Service</a> & <a href="#" className="text-emerald-600 hover:underline">Privacy Policy</a> of OrderPoint Pro.
                        </span>
                      </label>
                      {errors.acceptTerms && <p className="text-rose-500 text-[10px] font-medium">{errors.acceptTerms}</p>}
                    </div>

                    {/* Create Account Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-[#10B981] text-white rounded-xl font-bold tracking-wide text-xs hover:bg-[#059669] active:scale-[0.985] transition-all flex items-center justify-center gap-2 mt-4 shadow-md shadow-emerald-100 cursor-pointer"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin text-white" />
                      ) : (
                        <>
                          CREATE OWNER ACCOUNT
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="text-center mt-5">
                    <p className="text-xs text-slate-500 font-medium">
                      Already registered?{' '}
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="text-emerald-600 font-bold hover:underline"
                      >
                        Sign In Instead
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}

              {/* FORGOT PASSWORD SCREEN */}
              {mode === 'forgot-password' && (
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-8">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold mb-4"
                    >
                      <ArrowLeft size={14} /> BACK TO LOGIN
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                      Reset Password
                    </h1>
                    <p className="text-slate-500 text-sm">
                      We'll send you a secure password reset link to your registered email
                    </p>
                  </div>

                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 tracking-wider uppercase block">
                        Registered Email Address
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <Mail size={18} />
                        </span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors({ ...errors, email: '' });
                          }}
                          placeholder="manager@restaurant.com"
                          className={`w-full h-12 pl-12 pr-4 bg-slate-50 border ${errors.email ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all font-sans`}
                          disabled={loading}
                          required
                        />
                      </div>
                      {errors.email && (
                        <p className="text-rose-500 text-xs font-medium flex items-center gap-1 mt-1">
                          <AlertTriangle size={12} /> {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold tracking-wide text-xs hover:bg-slate-800 active:scale-[0.985] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin text-emerald-400" />
                      ) : (
                        'SEND PASSWORD RESET LINK'
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* LINK ACCOUNTS SCREEN */}
              {mode === 'link-accounts' && (
                <motion.div
                  key="link-accounts"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-8">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setPendingEmail('');
                        setPendingCred(null);
                        setPendingPassword('');
                      }}
                      className="text-slate-400 hover:text-slate-655 hover:text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold mb-4 bg-transparent border-none cursor-pointer"
                    >
                      <ArrowLeft size={14} /> CANCEL LINKING
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                      Link Google Account
                    </h1>
                    <p className="text-slate-550 text-slate-500 text-sm">
                      An email-password account already exists for <strong className="text-slate-800">{pendingEmail}</strong>. Enter your password to link Google Sign-In to this profile.
                    </p>
                  </div>

                  <form onSubmit={handleLinkAccountsSubmit} className="space-y-6">
                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 tracking-wider uppercase block">
                        Account Password
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <Lock size={18} />
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={pendingPassword}
                          onChange={(e) => {
                            setPendingPassword(e.target.value);
                            if (errors.linkPassword) setErrors({ ...errors, linkPassword: '' });
                          }}
                          placeholder="••••••••"
                          className={`w-full h-12 pl-12 pr-12 bg-slate-50 border ${errors.linkPassword ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-purple-500'} rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all font-sans`}
                          disabled={loading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none bg-transparent border-none cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.linkPassword && (
                        <p className="text-rose-500 text-xs font-medium flex items-center gap-1 mt-1">
                          <AlertTriangle size={12} /> {errors.linkPassword}
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-purple-600 text-white rounded-xl font-bold tracking-wide text-xs hover:bg-purple-700 active:scale-[0.985] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer border-none"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin text-white" />
                      ) : (
                        'LINK & SIGN IN'
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* EMAIL VERIFICATION SCREEN */}
              {mode === 'verification' && (
                <motion.div
                  key="verification"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#10B981] mx-auto mb-6 shadow-sm">
                    <Mail size={32} className="animate-bounce" />
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                    Verify Your Email
                  </h1>
                  
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    We've sent a secure verification link to <span className="font-bold text-slate-900">{email}</span>. Please click the link in your email to verify your account, then click the button below.
                  </div>

                  <form onSubmit={handleVerifySubmit} className="space-y-4 max-w-xs mx-auto mb-6">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold tracking-wide text-xs hover:bg-slate-800 active:scale-[0.985] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin text-emerald-400" />
                      ) : (
                        "I HAVE VERIFIED MY EMAIL"
                      )}
                    </button>
                  </form>

                  <div className="space-y-3 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={loading || resendTimer > 0}
                      className="w-full h-12 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 active:scale-[0.985] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendTimer > 0 ? (
                        `RESEND LINK IN ${resendTimer}s`
                      ) : (
                        "RESEND VERIFICATION LINK"
                      )}
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-5 mt-8 flex items-center justify-between text-xs font-semibold max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Use a different email
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1"
                    >
                      Secure Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
          </div>

          {/* Quick instructions / Help Footer */}
          <div className="text-center mt-8 text-emerald-200/80 text-xs font-medium space-y-1.5">
            <p>Need support or custom integrations?</p>
            <p className="text-emerald-300 font-semibold hover:text-white hover:underline cursor-pointer transition-colors">Contact OrderPoint Pro Enterprise Team</p>
          </div>

        </div>

      {/* AUTH ERROR DIAGNOSTIC MODAL */}
      <AnimatePresence>
        {showDiagnosticModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col font-sans"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-rose-500 to-rose-600 text-white flex items-center gap-3">
                <AlertTriangle size={24} className="shrink-0 text-rose-100" />
                <div>
                  <h3 className="font-bold text-lg tracking-tight">Domain Authorization Required</h3>
                  <p className="text-xs text-rose-100 mt-0.5">Firebase Google Authentication Safeguard</p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[80vh]">
                <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
                  <p>
                    Google Sign-In failed because this application's current domain is not yet whitelisted in your Firebase project configuration.
                  </p>
                  <p className="flex items-center gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-xs">
                    <span className="font-bold text-slate-500">Current Domain:</span>
                    <span className="text-emerald-600 font-extrabold">{window.location.hostname}</span>
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider">How to Fix in 30 Seconds</h4>
                  <div className="space-y-3">
                    {/* Step 1 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 mt-0.5">1</div>
                      <div className="text-xs text-slate-600">
                        <p className="font-bold text-slate-800">Open Firebase Console</p>
                        <p className="mt-0.5">Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-semibold hover:underline">console.firebase.google.com</a> and select your project.</p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 mt-0.5">2</div>
                      <div className="text-xs text-slate-600">
                        <p className="font-bold text-slate-800">Navigate to Auth Settings</p>
                        <p className="mt-0.5">Click <strong className="text-slate-700">Authentication</strong> in the left sidebar, select the <strong className="text-slate-700">Settings</strong> tab, then choose <strong className="text-slate-700">Authorized domains</strong>.</p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 mt-0.5">3</div>
                      <div className="text-xs text-slate-600">
                        <p className="font-bold text-slate-800">Add Whitelist Domains</p>
                        <p className="mt-0.5">Click <strong className="text-slate-700">Add domain</strong> and whitelist these exactly:</p>
                        <div className="mt-1.5 space-y-1">
                          <code className="block p-1 px-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 font-mono w-fit select-all">{window.location.hostname}</code>
                          <code className="block p-1 px-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 font-mono w-fit select-all">localhost</code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDiagnosticModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  DISMISS
                </button>
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  OPEN CONSOLE <ArrowRight size={14} />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
