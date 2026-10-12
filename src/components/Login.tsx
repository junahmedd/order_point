/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User, 
  Store, 
  Phone, 
  Receipt, 
  ChefHat, 
  Package, 
  ShieldCheck, 
  ArrowRight, 
  AlertTriangle, 
  Layers, 
  RefreshCw,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  linkWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
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

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'link-accounts';

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
  const [acceptTerms, setAcceptTerms] = useState(true);

  // Account linking states
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingCred, setPendingCred] = useState<any>(null);
  const [pendingPassword, setPendingPassword] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Auth diagnostic modal for domain whitelist errors
  const [authErrorType, setAuthErrorType] = useState<string | null>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  const successCallbackRef = useRef(onLoginSuccess);
  useEffect(() => {
    successCallbackRef.current = onLoginSuccess;
  }, [onLoginSuccess]);

  // Auth state listener: immediately forward authenticated users
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        successCallbackRef.current(currentUser);
      }
    });
    return unsub;
  }, []);

  // Handle Google redirect sign-in results if any
  useEffect(() => {
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
              const defaultStoreId = calculateStoreId(user.email || 'owner@restaurant.com', `${user.displayName || 'My'}'s Bistro`);
              await setDoc(userDocRef, {
                uid: user.uid,
                fullName: user.displayName || 'Restaurant Owner',
                restaurantName: `${user.displayName || 'My'}'s Bistro`,
                businessName: `${user.displayName || 'My'}'s Bistro`,
                email: user.email || '',
                phone: user.phoneNumber || '',
                role: 'RestaurantOwner',
                restaurantId: defaultStoreId,
                createdAt: new Date().toISOString(),
                emailVerified: true,
                subscriptionPlan: 'pro'
              });

              await setDoc(doc(db, 'stores', defaultStoreId), {
                storeId: defaultStoreId,
                ownerEmail: (user.email || '').toLowerCase().trim(),
                ownerId: user.uid,
                storeName: `${user.displayName || 'My'}'s Bistro`,
                storeNameNormalized: `${user.displayName || 'My'}'s Bistro`.toLowerCase(),
                createdAt: Date.now()
              });
            }
            onLoginSuccess(user);
          } catch (err) {
            console.error('Error creating Google user record:', err);
            onLoginSuccess(user);
          }
        }
      })
      .catch((error: any) => {
        console.error('Error with Google sign-in redirect:', error);
        if (error.code === 'auth/unauthorized-domain') {
          setAuthErrorType('unauthorized-domain');
          setShowDiagnosticModal(true);
        }
      });
  }, [onLoginSuccess]);

  // Validation helpers
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

  // =========================================================================
  // LOGIN SUBMISSION (Fast login without blocking email verification link)
  // =========================================================================
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
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Update lastLogin timestamp asynchronously without blocking
      const userDocRef = doc(db, 'users', user.uid);
      updateDoc(userDocRef, {
        lastLogin: new Date().toISOString()
      }).catch(() => {});

      toast.success('Signed in successfully!');
      onLoginSuccess(user);
    } catch (e: any) {
      console.error('Login error:', e);
      let errMsg = 'Invalid email or password. Please try again.';
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        errMsg = 'Incorrect email or password. Please verify and retry.';
      } else if (e.code === 'auth/too-many-requests') {
        errMsg = 'Account temporarily locked due to multiple failed attempts. Try again later.';
      } else if (e.code === 'auth/network-request-failed') {
        errMsg = 'Network connection problem. Please check your internet connection.';
      }
      toast.error(errMsg);
      setErrors({ form: errMsg });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // SIGN UP SUBMISSION (Direct onboarding with immediate dashboard redirect)
  // =========================================================================
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.fullName = 'Full Name is required (minimum 2 characters)';
    }

    if (!businessName.trim() || businessName.trim().length < 2) {
      newErrors.businessName = 'Restaurant / Business Name is required';
    }

    const emailErr = validateEmail(email);
    if (emailErr) newErrors.email = emailErr;

    const phoneErr = validatePhone(phone);
    if (phoneErr) newErrors.phone = phoneErr;

    if (!password || password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms of service';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the errors in the form.');
      return;
    }

    setLoading(true);
    try {
      const storeId = calculateStoreId(email, businessName);

      // Attempt creating new user directly
      let user: any = null;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        user = userCredential.user;

        // Case 1: Brand new email + new store
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          fullName: fullName.trim(),
          restaurantName: businessName.trim(),
          businessName: businessName.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          role: 'RestaurantOwner',
          restaurantId: storeId,
          createdAt: new Date().toISOString(),
          emailVerified: true,
          subscriptionPlan: 'pro',
          trialEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        // Create store registry document
        await setDoc(doc(db, 'stores', storeId), {
          storeId,
          ownerEmail: email.toLowerCase().trim(),
          ownerId: user.uid,
          storeName: businessName.trim(),
          storeNameNormalized: businessName.trim().toLowerCase(),
          createdAt: Date.now()
        });

        // Initialize default store settings
        const settingsDocRef = doc(db, 'settings', storeId);
        await setDoc(settingsDocRef, {
          restaurantInfo: {
            name: businessName.trim(),
            owner: fullName.trim(),
            phone: phone.trim(),
            email: email.toLowerCase().trim(),
            address: '',
            regNumber: ''
          },
          branding: { logoUrl: '', faviconUrl: '' },
          gstTax: { gstNumber: '', gstRate: 0, taxEnabled: false },
          payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
          whatsapp: { number: '', businessName: businessName.trim(), autoSendBills: false },
          qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
          notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
          security: { adminName: fullName.trim(), twoFactor: false, sessionTimeout: '30m' },
          preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });

        toast.success(`Welcome to OrderPoint Pro, ${fullName.trim()}!`);
        onLoginSuccess(user);
        return;
      } catch (createErr: any) {
        // If email already exists, verify credentials and resolve multi-store mapping
        if (createErr.code === 'auth/email-already-in-use') {
          try {
            const loginCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            user = loginCredential.user;

            const storeDocRef = doc(db, 'stores', storeId);
            const storeDocSnap = await getDoc(storeDocRef);

            if (storeDocSnap.exists()) {
              // Case 2: Same email + same store name -> open existing store
              toast.success(`Opening existing store "${businessName}"...`);
              const userDocRef = doc(db, 'users', user.uid);
              await updateDoc(userDocRef, {
                restaurantId: storeId,
                lastLogin: new Date().toISOString()
              }).catch(() => {});

              onLoginSuccess(user);
              return;
            } else {
              // Case 3: Same email + different store name -> provision new outlet
              toast.success(`Creating new store "${businessName}" under your account...`);

              await setDoc(storeDocRef, {
                storeId,
                ownerEmail: email.toLowerCase().trim(),
                ownerId: user.uid,
                storeName: businessName.trim(),
                storeNameNormalized: businessName.trim().toLowerCase(),
                createdAt: Date.now()
              });

              const settingsDocRef = doc(db, 'settings', storeId);
              await setDoc(settingsDocRef, {
                restaurantInfo: {
                  name: businessName.trim(),
                  owner: fullName.trim() || user.displayName || 'Owner',
                  phone: phone.trim(),
                  email: email.toLowerCase().trim(),
                  address: '',
                  regNumber: ''
                },
                branding: { logoUrl: '', faviconUrl: '' },
                gstTax: { gstNumber: '', gstRate: 0, taxEnabled: false },
                payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
                whatsapp: { number: '', businessName: businessName.trim(), autoSendBills: false },
                qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
                notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
                security: { adminName: fullName.trim() || user.displayName || 'Owner', twoFactor: false, sessionTimeout: '30m' },
                preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
                createdAt: Date.now(),
                updatedAt: Date.now()
              });

              const userDocRef = doc(db, 'users', user.uid);
              await updateDoc(userDocRef, {
                restaurantId: storeId,
                lastLogin: new Date().toISOString()
              }).catch(() => {});

              onLoginSuccess(user);
              return;
            }
          } catch (signInErr: any) {
            console.error('Password check failed on existing email:', signInErr);
            const conflictMsg = 'This email is already registered. Please enter your existing password or use a different email.';
            toast.error(conflictMsg);
            setErrors({ email: conflictMsg });
            setLoading(false);
            return;
          }
        } else {
          throw createErr;
        }
      }
    } catch (e: any) {
      console.error('Registration failed:', e);
      let errMsg = e.message || 'Failed to create account. Please try again.';
      if (e.code === 'auth/weak-password') {
        errMsg = 'Password is too weak. Please use at least 6 characters with mixed symbols.';
      }
      toast.error(errMsg);
      setErrors({ form: errMsg });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // FORGOT PASSWORD SUBMISSION
  // =========================================================================
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
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Password reset link sent! Check your email inbox or spam folder.');
      setMode('login');
    } catch (e: any) {
      console.error('Password reset error:', e);
      let errMsg = 'Failed to send password reset email. Please try again.';
      if (e.code === 'auth/user-not-found') {
        errMsg = 'No registered account found with that email.';
        setErrors({ email: errMsg });
      }
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Account linking for Google OAuth fallback
  const handleLinkAccountsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPassword) {
      setErrors({ linkPassword: 'Password is required' });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, pendingEmail, pendingPassword);
      const user = userCredential.user;

      if (pendingCred) {
        await linkWithCredential(user, pendingCred);
      }

      toast.success('Successfully linked accounts and signed in!');
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Failed to link account:', err);
      toast.error('Incorrect password for the existing account. Please retry.');
      setErrors({ linkPassword: 'Incorrect password for this account.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      id="auth_container" 
      className="min-h-screen bg-gradient-to-br from-[#020B1D] via-[#06183B] to-[#010814] flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white relative overflow-x-hidden"
    >
      {/* Ambient Rich Blue Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-15%,rgba(30,64,175,0.35),rgba(255,255,255,0))] pointer-events-none" />

      {/* Main Split Screen Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14 relative z-10">
        
        {/* ================================================================= */}
        {/* LEFT SECTION: BRANDING & 4 RESTAURANT FEATURE CARDS (Deep Dark Blue) */}
        {/* ================================================================= */}
        <div className="w-full lg:w-[56%] text-white space-y-7 lg:space-y-9 order-2 lg:order-1">
          
          {/* Logo & Platform Tag (Desktop) */}
          <div className="hidden lg:flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-xl shadow-blue-600/35 ring-2 ring-blue-400/30">
              <Layers size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="font-black text-xl tracking-tight text-white leading-none uppercase drop-shadow-sm">
                ORDERPOINT PRO
              </div>
              <div className="text-[10px] font-extrabold text-blue-300 tracking-widest uppercase mt-1 opacity-90">
                RESTAURANT OPERATING SYSTEM
              </div>
            </div>
          </div>

          {/* Live Status Pill (Desktop) */}
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[11px] font-black tracking-wider uppercase select-none shadow-sm shadow-blue-950/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE RESTAURANT POS • REAL-TIME FIREBASE SYNC</span>
            </div>
          </div>

          {/* Main Headline & Description */}
          <div className="space-y-3.5 text-center lg:text-left">
            <h1 className="text-2xl sm:text-4xl lg:text-[46px] font-[900] text-white tracking-tight leading-[1.12] drop-shadow-md">
              {mode === 'signup' ? 'Start Managing Smarter.' : 'The Modern Operating System for Restaurants.'}
            </h1>
            <p className="text-blue-100/85 text-xs sm:text-base leading-relaxed max-w-xl mx-auto lg:mx-0 font-normal">
              Connect POS Billing, Live Kitchen Orders, Real-Time Inventory Control, and Automated Invoicing in one unified, real-time command center.
            </p>
          </div>

          {/* 4 Feature Cards (2x2 Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            
            {/* Card 1: Smart POS & Billing */}
            <div className="bg-[#091C3E]/60 hover:bg-[#0D244F]/80 border border-blue-500/25 hover:border-blue-400/55 rounded-2xl p-4 sm:p-5 transition-all duration-200 backdrop-blur-md shadow-lg shadow-blue-950/50 text-left">
              <div className="w-9 h-9 rounded-xl bg-blue-500/25 text-blue-300 flex items-center justify-center mb-3 border border-blue-400/35">
                <Receipt size={18} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Smart POS &amp; Invoicing</h3>
              <p className="text-xs text-blue-100/70 leading-relaxed font-normal">
                Fast checkout with instant UPI QR, split tender, and automated WhatsApp receipts.
              </p>
            </div>

            {/* Card 2: Live Kitchen Queue */}
            <div className="bg-[#091C3E]/60 hover:bg-[#0D244F]/80 border border-blue-500/25 hover:border-cyan-400/55 rounded-2xl p-4 sm:p-5 transition-all duration-200 backdrop-blur-md shadow-lg shadow-blue-950/50 text-left">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/25 text-cyan-300 flex items-center justify-center mb-3 border border-cyan-400/35">
                <ChefHat size={18} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Live Kitchen Queue (KDS)</h3>
              <p className="text-xs text-blue-100/70 leading-relaxed font-normal">
                Real-time ticket routing with preparation timers and 1-click order dispatch.
              </p>
            </div>

            {/* Card 3: Inventory & Recipe Control */}
            <div className="bg-[#091C3E]/60 hover:bg-[#0D244F]/80 border border-blue-500/25 hover:border-emerald-400/55 rounded-2xl p-4 sm:p-5 transition-all duration-200 backdrop-blur-md shadow-lg shadow-blue-950/50 text-left">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/25 text-emerald-300 flex items-center justify-center mb-3 border border-emerald-400/35">
                <Package size={18} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Inventory Control</h3>
              <p className="text-xs text-blue-100/70 leading-relaxed font-normal">
                Track ingredients, automated consumption logs &amp; low-stock alerts.
              </p>
            </div>

            {/* Card 4: Strict Tenant Isolation */}
            <div className="bg-[#091C3E]/60 hover:bg-[#0D244F]/80 border border-blue-500/25 hover:border-indigo-400/55 rounded-2xl p-4 sm:p-5 transition-all duration-200 backdrop-blur-md shadow-lg shadow-blue-950/50 text-left">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/25 text-indigo-300 flex items-center justify-center mb-3 border border-indigo-400/35">
                <ShieldCheck size={18} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Strict Tenant Isolation</h3>
              <p className="text-xs text-blue-100/70 leading-relaxed font-normal">
                Multi-outlet restaurant mapping with deny-by-default Firestore Security Rules.
              </p>
            </div>

          </div>

        </div>

        {/* ================================================================= */}
        {/* RIGHT SECTION: FLOATING AUTHENTICATION CARD (Clean White)         */}
        {/* ================================================================= */}
        <div className="w-full lg:w-[44%] max-w-[460px] mx-auto order-1 lg:order-2">
          
          {/* Mobile-Only Prominent Brand Header */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-xl shadow-blue-600/35 ring-2 ring-blue-400/30">
              <Layers size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="font-black text-2xl tracking-tight text-white uppercase drop-shadow-md">
                ORDERPOINT PRO
              </div>
              <div className="text-[10px] font-extrabold text-blue-300 tracking-widest uppercase mt-0.5">
                RESTAURANT OPERATING SYSTEM
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[10px] font-black tracking-wider uppercase select-none shadow-sm shadow-blue-950/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE RESTAURANT POS • FIREBASE SYNC</span>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 sm:p-9 shadow-2xl border border-white/20 text-slate-900 relative">
            
            <AnimatePresence mode="wait">
              
              {/* ------------------------------------------------------------- */}
              {/* 1. LOGIN MODE                                                 */}
              {/* ------------------------------------------------------------- */}
              {mode === 'login' && (
                <motion.div
                  key="login_card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Welcome back
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Sign in to access your restaurant system.
                    </p>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    {errors.form && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-medium">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>{errors.form}</span>
                      </div>
                    )}

                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                        Email
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Mail size={17} />
                        </span>
                        <input
                          id="login_email"
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors({ ...errors, email: '' });
                          }}
                          placeholder="owner@restaurant.com"
                          className={`w-full h-11.5 pl-10 pr-4 bg-slate-50 border ${
                            errors.email ? 'border-rose-400' : 'border-slate-200 focus:border-blue-600'
                          } rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all`}
                          disabled={loading}
                          required
                        />
                      </div>
                      {errors.email && (
                        <p className="text-rose-500 text-xs font-medium mt-1">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setMode('forgot-password')}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors bg-transparent border-none cursor-pointer p-0"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Lock size={17} />
                        </span>
                        <input
                          id="login_password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) setErrors({ ...errors, password: '' });
                          }}
                          placeholder="••••••••••••"
                          className="w-full h-11.5 pl-10 pr-10 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                          disabled={loading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none bg-transparent border-none cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember me Checkbox */}
                    <div className="flex items-center justify-between pt-0.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-600">Remember me</span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11.5 bg-[#091E42] hover:bg-[#071735] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer mt-2 disabled:opacity-70"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <>
                          <span>Sign in →</span>
                        </>
                      )}
                    </button>

                    {/* Toggle to Sign up */}
                    <div className="text-center pt-3 text-xs text-slate-600 font-medium">
                      <span>Need an account? </span>
                      <button
                        type="button"
                        onClick={() => {
                          setErrors({});
                          setMode('signup');
                        }}
                        className="font-bold text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0 underline-offset-2 hover:underline"
                      >
                        Create an account →
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* 2. SIGN UP MODE                                               */}
              {/* ------------------------------------------------------------- */}
              {mode === 'signup' && (
                <motion.div
                  key="signup_card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-5">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Create Your Account
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Set up your OrderPoint Pro workspace in 60 seconds.
                    </p>
                  </div>

                  <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                    {errors.form && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-medium">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>{errors.form}</span>
                      </div>
                    )}

                    {/* Full Name */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                        Full Name
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <User size={16} />
                        </span>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Mohammed Zaid"
                          className="w-full h-10.5 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>

                    {/* Restaurant / Business Name */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                        Restaurant / Business Name
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Store size={16} />
                        </span>
                        <input
                          type="text"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="Bistro Grand Central"
                          className="w-full h-10.5 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                        Business Email
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Mail size={16} />
                        </span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="owner@restaurant.com"
                          className="w-full h-10.5 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                        Phone Number
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Phone size={16} />
                        </span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full h-10.5 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>

                    {/* Passwords (2 Columns) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-10.5 px-3 pr-8 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none transition-all"
                            disabled={loading}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0"
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                          Confirm
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-10.5 px-3 pr-8 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none transition-all"
                            disabled={loading}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0"
                          >
                            {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Terms Checkbox */}
                    <div className="pt-1">
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={acceptTerms}
                          onChange={(e) => setAcceptTerms(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span className="text-[11px] text-slate-600 leading-tight">
                          I agree to OrderPoint Pro's Terms of Service &amp; Restaurant Data Privacy Policy.
                        </span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11.5 bg-[#091E42] hover:bg-[#071735] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer mt-2 disabled:opacity-70"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <span>Create Account →</span>
                      )}
                    </button>

                    {/* Toggle to Login */}
                    <div className="text-center pt-2 text-xs text-slate-600 font-medium">
                      <span>Already have an account? </span>
                      <button
                        type="button"
                        onClick={() => {
                          setErrors({});
                          setMode('login');
                        }}
                        className="font-bold text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0 underline-offset-2 hover:underline"
                      >
                        Sign in →
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* 3. FORGOT PASSWORD MODE                                       */}
              {/* ------------------------------------------------------------- */}
              {mode === 'forgot-password' && (
                <motion.div
                  key="forgot_card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Reset Password
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Enter your email address and we'll send you recovery instructions.
                    </p>
                  </div>

                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                        Registered Email
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Mail size={17} />
                        </span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="owner@restaurant.com"
                          className="w-full h-11.5 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-all"
                          disabled={loading}
                          required
                        />
                      </div>
                      {errors.email && (
                        <p className="text-rose-500 text-xs font-medium mt-1">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11.5 bg-[#091E42] hover:bg-[#071735] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-70"
                    >
                      {loading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <span>Send Reset Link →</span>
                      )}
                    </button>

                    {/* Back to Login */}
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-transparent border-none cursor-pointer"
                      >
                        ← Back to Sign in
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* 4. LINK ACCOUNTS MODE (OAuth conflict fallback)               */}
              {/* ------------------------------------------------------------- */}
              {mode === 'link-accounts' && (
                <motion.div
                  key="link_card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Link Existing Account
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Enter your password for <strong className="text-slate-800">{pendingEmail}</strong> to link Google Sign-In.
                    </p>
                  </div>

                  <form onSubmit={handleLinkAccountsSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block">
                        Account Password
                      </label>
                      <input
                        type="password"
                        value={pendingPassword}
                        onChange={(e) => setPendingPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full h-11.5 px-4 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none transition-all"
                        disabled={loading}
                        required
                      />
                      {errors.linkPassword && (
                        <p className="text-rose-500 text-xs font-medium mt-1">
                          {errors.linkPassword}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11.5 bg-[#091E42] hover:bg-[#071735] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                      {loading ? <RefreshCw size={16} className="animate-spin" /> : <span>Confirm &amp; Sign In →</span>}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-transparent border-none cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>

          </div>

          {/* Micro Footer Under Card */}
          <div className="text-center mt-5 text-[11px] font-medium text-blue-200/60 select-none">
            © 2026 OrderPoint Pro • Enterprise Restaurant &amp; POS Operating System
          </div>

        </div>

      </main>

      {/* AUTH ERROR DIAGNOSTIC MODAL */}
      <AnimatePresence>
        {showDiagnosticModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col font-sans"
            >
              <div className="p-6 bg-gradient-to-r from-rose-500 to-rose-600 text-white flex items-center gap-3">
                <AlertTriangle size={24} className="shrink-0 text-rose-100" />
                <div>
                  <h3 className="font-bold text-lg tracking-tight">Domain Authorization Required</h3>
                  <p className="text-xs text-rose-100 mt-0.5">Firebase Google Authentication Whitelist</p>
                </div>
              </div>

              <div className="p-6 space-y-4 text-sm text-slate-600">
                <p>
                  Google Sign-In requires your current domain to be whitelisted in Firebase Console.
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">Domain to Add:</span>
                  <code className="block p-1 px-2 bg-white border border-slate-200 rounded text-xs font-mono text-slate-800 select-all">
                    {window.location.hostname}
                  </code>
                </div>
              </div>

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
