import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { adminAuth, adminDb } from './src/lib/firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { sendVerificationEmail } from './src/lib/email.js';
import Razorpay from 'razorpay';

// Load environment variables
dotenv.config();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Custom CORS middleware to support custom domains and preview env
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Use Express body-parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ==========================================
  // API ROUTE: Server Health / Settings Check
  // ==========================================
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      smtp_configured: !!process.env.SMTP_HOST && !!process.env.SMTP_USER,
    });
  });

  // ==========================================
  // JWT / SESSION CONFIGURATION & MIDDLEWARE
  // ==========================================
  const JWT_SECRET = process.env.JWT_SECRET || 'orderpoint-pro-super-secret-key-2026';

  function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No session token provided.' });
    }

    try {
      const verified = jwt.verify(token, JWT_SECRET);
      req.user = verified;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
  }

  // Protected profile route for checking backend session
  app.get('/api/auth/profile', authenticateToken, async (req: any, res) => {
    try {
      const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found in database.' });
      }
      res.json({ success: true, user: userDoc.data() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // API ROUTE: Create Secure Google / Auth Session
  // ==========================================
  app.post('/api/session', async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'ID Token is required' });
    }

    try {
      // 1. Verify the ID Token using Firebase Admin SDK
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;
      const name = decodedToken.name || decodedToken.displayName || 'Google Member';
      const picture = decodedToken.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

      // 2. Synchronize user details in Firestore
      const userDocRef = adminDb.collection('users').doc(uid);
      const userDoc = await userDocRef.get();

      let userData: any;
      let isNewUser = false;

      if (!userDoc.exists) {
        isNewUser = true;
        userData = {
          uid,
          fullName: name,
          businessName: `${name}'s Bistro`,
          email: email || '',
          phone: '',
          role: 'admin', // Default role is admin (Owner)
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          profilePhoto: picture,
          isVerified: true, // Google or verified ID token is auto-verified
          emailVerified: true,
          provider: 'google',
          organizationId: uid
        };
        await userDocRef.set(userData);

        // Create default settings for the new restaurant/organization
        const settingsDocRef = adminDb.collection('settings').doc(uid);
        await settingsDocRef.set({
          restaurantInfo: {
            name: userData.businessName,
            owner: userData.fullName,
            phone: '',
            email: userData.email,
            address: '',
            regNumber: ''
          },
          branding: { logoUrl: '', faviconUrl: '' },
          gstTax: { gstNumber: '', gstRate: 5, taxEnabled: true },
          payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
          whatsapp: { number: '', businessName: userData.businessName, autoSendBills: false },
          qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
          notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
          security: { adminName: userData.fullName, twoFactor: false, sessionTimeout: '30m' },
          preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } else {
        userData = userDoc.data();
        userData.lastLogin = new Date().toISOString();
        
        // Update user's last login and provider details
        await userDocRef.update({
          lastLogin: userData.lastLogin,
          emailVerified: true,
          isVerified: true
        });
      }

      // 3. Generate secure backend JWT session token
      const backendToken = jwt.sign(
        { uid, email, role: userData.role || 'admin' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Fetch user settings (organization details)
      const settingsDoc = await adminDb.collection('settings').doc(uid).get();
      const settingsData = settingsDoc.exists ? settingsDoc.data() : null;

      return res.json({
        success: true,
        token: backendToken,
        user: {
          uid: userData.uid,
          email: userData.email,
          fullName: userData.fullName || userData.displayName || name,
          businessName: userData.businessName,
          role: userData.role || 'admin',
          profilePhoto: userData.profilePhoto || userData.photoURL || picture,
        },
        organization: settingsData,
        isNewUser,
      });

    } catch (error: any) {
      console.error('Error verifying Firebase ID token on backend:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid ID Token' });
    }
  });

  // ==========================================
  // API ROUTE: Secure Registration Endpoint
  // ==========================================
  app.post('/api/register', async (req, res) => {
    const { fullName, businessName, email, phone, password } = req.body;

    if (!fullName || !businessName || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    try {
      // 1. Check if email already exists in Firebase Auth
      let existingUser;
      try {
        existingUser = await adminAuth.getUserByEmail(email);
      } catch (e) {
        // User does not exist (expected path)
      }

      if (existingUser) {
        return res.status(400).json({
          error: 'This email address is already in use by another restaurant owner.',
          code: 'auth/email-already-in-use',
        });
      }

      // 2. Create the user in Firebase Auth using admin SDK
      const userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: false, // Initially unverified!
        phoneNumber: phone.startsWith('+') ? phone : undefined, // Firebase Admin auth phone validator
      });

      const uid = userRecord.uid;

      // 3. Generate secure verification codes/tokens
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits OTP code
      const verificationToken = crypto.randomBytes(32).toString('hex'); // 32 characters hex link token
      // Verification token is valid for 15 minutes
      const verificationTokenExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // 4. Create user profile document in Firestore
      const userDocRef = adminDb.collection('users').doc(uid);
      const userProfile = {
        uid,
        fullName,
        businessName,
        email,
        phone,
        role: 'admin',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        profilePhoto: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
        isVerified: false, // Unverified initially
        emailVerified: false,
        verificationCode,
        verificationToken,
        verificationTokenExpiry,
        verificationAttempts: 0,
      };
      await userDocRef.set(userProfile);

      // 5. Initialize user settings document in Firestore (identical to frontend)
      const settingsDocRef = adminDb.collection('settings').doc(uid);
      await settingsDocRef.set({
        restaurantInfo: {
          name: businessName,
          owner: fullName,
          phone: phone,
          email: email,
          address: '',
          regNumber: ''
        },
        branding: { logoUrl: '', faviconUrl: '' },
        gstTax: { gstNumber: '', gstRate: 5, taxEnabled: true },
        payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
        whatsapp: { number: '', businessName: businessName, autoSendBills: false },
        qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
        notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
        security: { adminName: fullName, twoFactor: false, sessionTimeout: '30m' },
        preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // 6. Send the real branded verification email (SMTP or Simulated Dev fallback)
      let mailResult;
      try {
        mailResult = await sendVerificationEmail({
          email,
          fullName,
          verificationCode,
          verificationToken,
        });
      } catch (mailError) {
        console.error('Email delivery error during registration:', mailError);
        // Do not fail registration, user can resend. Give a special status.
        mailResult = { error: 'Failed to deliver email' };
      }

      return res.status(201).json({
        success: true,
        userId: uid,
        email,
        message: 'Account created successfully! A verification code and link has been sent.',
        mailResult,
      });

    } catch (error: any) {
      console.error('Error during registration endpoint:', error);
      return res.status(500).json({
        error: error.message || 'An unexpected error occurred during registration. Please try again.',
      });
    }
  });

  // ==========================================
  // API ROUTE: Verify Email (POST OTP Code)
  // ==========================================
  app.post('/api/verify-email', async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    try {
      // 1. Fetch user document from Firestore by email
      const usersQuery = await adminDb.collection('users').where('email', '==', email).limit(1).get();

      if (usersQuery.empty) {
        return res.status(404).json({ error: 'No account registered with this email address.' });
      }

      const userDoc = usersQuery.docs[0];
      const userData = userDoc.data();
      const uid = userDoc.id;

      if (userData.isVerified || userData.emailVerified) {
        return res.status(400).json({ error: 'Your email is already verified. You can log in directly.' });
      }

      // 2. Check maximum verification attempts (e.g. 5 attempts)
      const attempts = userData.verificationAttempts || 0;
      if (attempts >= 5) {
        return res.status(429).json({
          error: 'Too many failed verification attempts. Please request a new verification code.',
        });
      }

      // 3. Check code expiration
      const expiry = userData.verificationTokenExpiry;
      if (!expiry || new Date() > new Date(expiry)) {
        return res.status(400).json({ error: 'Your verification code has expired. Please request a new one.' });
      }

      // 4. Check if code matches
      if (userData.verificationCode !== code) {
        // Increment attempts
        await userDoc.ref.update({
          verificationAttempts: attempts + 1,
        });

        return res.status(400).json({
          error: `Invalid verification code. You have ${4 - attempts} attempts remaining.`,
        });
      }

      // 5. Code is valid! Mark verified in Firebase Auth and Firestore
      await adminAuth.updateUser(uid, {
        emailVerified: true,
      });

      await userDoc.ref.update({
        isVerified: true,
        emailVerified: true,
        verificationCode: FieldValue.delete(),
        verificationToken: FieldValue.delete(),
        verificationTokenExpiry: FieldValue.delete(),
        verificationAttempts: 0,
      });

      return res.json({
        success: true,
        message: 'Your email has been successfully verified! Welcome to OrderPoint Pro.',
      });

    } catch (error: any) {
      console.error('Error verifying email code:', error);
      return res.status(500).json({ error: error.message || 'Verification failed. Please try again.' });
    }
  });

  // ==========================================
  // API ROUTE: Verify Email (GET Link Token)
  // ==========================================
  app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.redirect('/?verified=false&error=invalid_token');
    }

    try {
      // 1. Fetch user by verificationToken
      const usersQuery = await adminDb.collection('users').where('verificationToken', '==', token).limit(1).get();

      if (usersQuery.empty) {
        return res.redirect('/?verified=false&error=token_not_found');
      }

      const userDoc = usersQuery.docs[0];
      const userData = userDoc.data();
      const uid = userDoc.id;

      // 2. Check token expiration
      const expiry = userData.verificationTokenExpiry;
      if (!expiry || new Date() > new Date(expiry)) {
        return res.redirect('/?verified=false&error=token_expired');
      }

      // 3. Mark verified in Firebase Auth and Firestore
      await adminAuth.updateUser(uid, {
        emailVerified: true,
      });

      await userDoc.ref.update({
        isVerified: true,
        emailVerified: true,
        verificationCode: FieldValue.delete(),
        verificationToken: FieldValue.delete(),
        verificationTokenExpiry: FieldValue.delete(),
        verificationAttempts: 0,
      });

      // Redirect to client application with a success flag
      return res.redirect('/?verified=true');

    } catch (error) {
      console.error('Error verifying email via link:', error);
      return res.redirect('/?verified=false&error=server_error');
    }
  });

  // ==========================================
  // API ROUTE: Resend Verification Email
  // ==========================================
  app.post('/api/resend-verification', async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      // 1. Search for user doc by email
      const usersQuery = await adminDb.collection('users').where('email', '==', email).limit(1).get();

      if (usersQuery.empty) {
        return res.status(404).json({ error: 'No account registered with this email address.' });
      }

      const userDoc = usersQuery.docs[0];
      const userData = userDoc.data();
      const uid = userDoc.id;

      if (userData.isVerified || userData.emailVerified) {
        return res.status(400).json({ error: 'This email is already verified. You can log in directly.' });
      }

      // 2. Check rate limiting (allow resend every 60 seconds)
      const lastResendTimeStr = userData.lastResendTime;
      if (lastResendTimeStr) {
        const secondsSinceLast = (Date.now() - new Date(lastResendTimeStr).getTime()) / 1000;
        if (secondsSinceLast < 60) {
          const remaining = Math.ceil(60 - secondsSinceLast);
          return res.status(429).json({
            error: `Please wait ${remaining} seconds before requesting another code.`,
            retryAfterSeconds: remaining,
          });
        }
      }

      // 3. Generate NEW verification code & token
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // 4. Update database
      await userDoc.ref.update({
        verificationCode,
        verificationToken,
        verificationTokenExpiry,
        verificationAttempts: 0,
        lastResendTime: new Date().toISOString(),
      });

      // 5. Deliver new email
      await sendVerificationEmail({
        email,
        fullName: userData.fullName || 'Restaurant Owner',
        verificationCode,
        verificationToken,
      });

      return res.json({
        success: true,
        message: 'A new verification link and code has been sent to your email.',
      });

    } catch (error: any) {
      console.error('Error resending verification email:', error);
      return res.status(500).json({ error: error.message || 'Failed to resend verification email.' });
    }
  });

  // Server-side settings cache
  const serverSettingsCache = new Map<string, any>();

  // ==========================================
  // API ROUTE: Get Restaurant Settings
  // ==========================================
  app.get('/api/settings', async (req, res) => {
    const { restaurantId } = req.query;

    if (!restaurantId || typeof restaurantId !== 'string') {
      return res.status(400).json({ error: 'restaurantId query parameter is required.' });
    }

    try {
      let settingsData = serverSettingsCache.get(restaurantId) || null;

      if (!settingsData && adminDb) {
        try {
          const snap = await adminDb.collection('settings').doc(restaurantId).get();
          if (snap.exists) {
            settingsData = snap.data();
            serverSettingsCache.set(restaurantId, settingsData);
          }
        } catch (dbErr: any) {
          console.info('Firestore settings query notice:', dbErr?.message || String(dbErr));
        }
      }

      return res.json({ success: true, settings: settingsData });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch settings.' });
    }
  });

  // ==========================================
  // API ROUTE: Save Restaurant Settings
  // ==========================================
  app.post('/api/settings', async (req, res) => {
    const { restaurantId, settings } = req.body;

    if (!restaurantId || !settings) {
      return res.status(400).json({ error: 'restaurantId and settings object are required.' });
    }

    try {
      const existing = serverSettingsCache.get(restaurantId) || {};
      const merged = { ...existing, ...settings, updatedAt: new Date().toISOString() };
      serverSettingsCache.set(restaurantId, merged);

      if (adminDb) {
        try {
          const docRef = adminDb.collection('settings').doc(restaurantId);
          await docRef.set(settings, { merge: true });
        } catch (dbErr: any) {
          console.error('Firestore admin settings save notice:', dbErr?.message || String(dbErr));
        }
      }

      return res.json({ success: true, message: 'Settings saved successfully on server.', settings: merged });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      return res.status(500).json({ error: error.message || 'Failed to save settings on server.' });
    }
  });

  // ==========================================
  // API ROUTE: Validate & Create Order
  // ==========================================
  app.post('/api/orders', async (req, res) => {
    const { restaurantId, order } = req.body;

    if (!restaurantId || !order || !order.id || !Array.isArray(order.items)) {
      return res.status(400).json({ error: 'restaurantId and a valid order object are required.' });
    }

    if (!adminDb) {
      // If adminDb is not initialized (e.g. mock mode), allow write through
      return res.json({ success: true, warning: 'Database offline. Bypassed validation.' });
    }

    try {
      // Validate every item in the order
      for (const item of order.items) {
        const menuItem = item.menuItem;
        if (!menuItem) {
          return res.status(400).json({ error: 'Order items must contain a menuItem definition.' });
        }

        const baseId = menuItem.id.split('-')[0];
        const docRef = adminDb.collection('restaurants').doc(restaurantId).collection('menuItems').doc(baseId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          return res.status(400).json({ error: `Dish "${menuItem.name}" does not exist in the menu catalog.` });
        }

        const dbItem = docSnap.data();
        if (!dbItem) {
          return res.status(400).json({ error: `Could not retrieve data for "${menuItem.name}".` });
        }

        // Check if item is available for ordering
        const isAvail = dbItem.isAvailableForOrder !== undefined ? dbItem.isAvailableForOrder : dbItem.isAvailable;
        if (isAvail === false) {
          return res.status(400).json({ error: `Dish "${dbItem.name}" is currently unavailable for ordering.` });
        }

        const variantSuffix = menuItem.id.replace(`${baseId}-`, ''); // e.g. "HALF" or "FULL"
        if (variantSuffix === 'HALF') {
          const expectedPrice = dbItem.price / 2;
          if (Math.abs(Number(menuItem.price) - expectedPrice) > 0.01) {
            return res.status(400).json({ error: `Price mismatch for "${menuItem.name} (Half)". Expected: ₹${expectedPrice}, Received: ₹${menuItem.price}.` });
          }
        } else if (variantSuffix === 'FULL') {
          const expectedPrice = dbItem.price;
          if (Math.abs(Number(menuItem.price) - expectedPrice) > 0.01) {
            return res.status(400).json({ error: `Price mismatch for "${menuItem.name} (Full)". Expected: ₹${expectedPrice}, Received: ₹${menuItem.price}.` });
          }
        } else {
          // Standard single price item
          if (Math.abs(Number(menuItem.price) - dbItem.price) > 0.01) {
            return res.status(400).json({ error: `Price mismatch for "${menuItem.name}". Expected: ₹${dbItem.price}, Received: ₹${menuItem.price}.` });
          }
        }
      }

      // If all validations pass, write the order to Firestore
      const orderRef = adminDb.collection('restaurants').doc(restaurantId).collection('orders').doc(order.id);
      await orderRef.set(order);

      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error validating & creating order:', err);
      return res.status(500).json({ error: err.message || 'An error occurred during order validation.' });
    }
  });

  // ==========================================
  // API ROUTE: Fast Feedback Initialization
  // ==========================================
  app.get('/api/feedback/init', async (req, res) => {
    const { restaurantId, invoiceNo } = req.query;

    if (!restaurantId || !invoiceNo || typeof restaurantId !== 'string' || typeof invoiceNo !== 'string') {
      return res.status(400).json({ error: 'restaurantId and invoiceNo are required parameters.' });
    }

    try {
      // 1. Get Restaurant Name
      let restaurantName = 'OrderPoint Pro Restaurant';
      try {
        const settingsSnap = await adminDb.collection('settings').doc(restaurantId).get();
        if (settingsSnap.exists) {
          const sData = settingsSnap.data();
          if (sData?.restaurantInfo?.name) {
            restaurantName = sData.restaurantInfo.name;
          }
        }
      } catch (err: any) {
        console.info("Could not retrieve restaurant name on server:", err?.message || String(err));
      }

      // 2. Check if feedback already submitted
      const feedbackId = `fb_${invoiceNo}`;
      let alreadySubmitted = false;
      let existingFeedback = null;
      try {
        const feedbackSnap = await adminDb.collection('restaurants').doc(restaurantId).collection('feedback').doc(feedbackId).get();
        if (feedbackSnap.exists) {
          alreadySubmitted = true;
          existingFeedback = feedbackSnap.data();
        }
      } catch (err: any) {
        console.info("Could not check existing feedback on server:", err?.message || String(err));
      }

      // 3. Find invoice / order details
      let orderId = '';
      let customerName = 'Our Valued Guest';
      let customerPhone = '';
      let orderItems: any[] = [];
      let platform = 'Dine-In';
      let orderDate = '';
      let invoiceFound = false;

      // Try primary invoices collection
      try {
        const invoicesQuery = await adminDb.collection('restaurants')
          .doc(restaurantId)
          .collection('invoices')
          .where('invoiceNo', '==', invoiceNo)
          .limit(1)
          .get();

        if (!invoicesQuery.empty) {
          const invData = invoicesQuery.docs[0].data();
          orderId = invData.orderId || '';
          customerName = invData.customerName || 'Our Valued Guest';
          customerPhone = invData.customerPhone || '';
          orderItems = invData.items || [];
          platform = invData.tableNo && invData.tableNo !== 'Takeaway' ? 'Dine-In' : 'Takeaway';
          
          if (invData.timestamp) {
            orderDate = new Date(invData.timestamp).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
          invoiceFound = true;
        }
      } catch (err: any) {
        console.info("Could not query invoices on server:", err?.message || String(err));
      }

      // Try orders fallback if invoice not found
      if (!invoiceFound) {
        try {
          const ordersQuery = await adminDb.collection('restaurants')
            .doc(restaurantId)
            .collection('orders')
            .where('invoiceNumber', '==', invoiceNo)
            .limit(1)
            .get();

          if (!ordersQuery.empty) {
            const ordData = ordersQuery.docs[0].data();
            orderId = ordData.id || '';
            customerName = ordData.customerName || 'Our Valued Guest';
            customerPhone = ordData.customerPhone || '';
            orderItems = ordData.items || [];
            platform = ordData.tableNo && ordData.tableNo !== 'Takeaway' ? 'Dine-In' : 'Takeaway';
            
            if (ordData.timestamp) {
              orderDate = new Date(ordData.timestamp).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }
            invoiceFound = true;
          }
        } catch (err: any) {
          console.info("Could not query orders fallback on server:", err?.message || String(err));
        }
      }

      // If still not found, construct Guest default values
      if (!invoiceFound) {
        orderId = 'guest_' + Date.now();
        customerName = 'Our Valued Guest';
        customerPhone = '';
        orderItems = [];
        platform = 'Dine-In';
        orderDate = new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      return res.json({
        success: true,
        restaurantName,
        alreadySubmitted,
        existingFeedback,
        orderId,
        customerName,
        customerPhone,
        orderItems,
        platform,
        orderDate
      });

    } catch (error: any) {
      console.error('Error during feedback initialization route:', error);
      return res.status(500).json({ error: error.message || 'Server failed to initialize feedback data.' });
    }
  });

  // ==========================================
  // API ROUTE: Fast Feedback Submission
  // ==========================================
  app.post('/api/feedback', async (req, res) => {
    const { restaurantId, feedbackId, feedbackData } = req.body;

    if (!restaurantId || !feedbackId || !feedbackData) {
      return res.status(400).json({ error: 'restaurantId, feedbackId and feedbackData are required.' });
    }

    try {
      const feedbackRef = adminDb.collection('restaurants')
        .doc(restaurantId)
        .collection('feedback')
        .doc(feedbackId);

      await feedbackRef.set({
        ...feedbackData,
        submittedVia: 'api',
        serverTimestamp: new Date().toISOString()
      });

      return res.json({ success: true, message: 'Feedback stored successfully.' });
    } catch (error: any) {
      console.error('Error submitting feedback on server:', error);
      return res.status(500).json({ error: error.message || 'Failed to record feedback on server.' });
    }
  });

  // ==========================================
  // API ROUTE: Get Invoice Details (High Performance)
  // ==========================================
  app.get('/api/invoice', async (req, res) => {
    const { restaurantId, invoiceId } = req.query;

    if (!restaurantId || !invoiceId || typeof restaurantId !== 'string' || typeof invoiceId !== 'string') {
      return res.status(400).json({ error: 'restaurantId and invoiceId are required parameters.' });
    }

    try {
      // 1. Fetch Restaurant Info
      let restaurantName = 'OrderPoint Pro Restaurant';
      let restaurantPhone = '';
      let restaurantAddress = '';

      try {
        const settingsSnap = await adminDb.collection('settings').doc(restaurantId).get();
        if (settingsSnap.exists) {
          const sData = settingsSnap.data();
          if (sData?.restaurantInfo) {
            restaurantName = sData.restaurantInfo.name || 'OrderPoint Pro Restaurant';
            restaurantPhone = sData.restaurantInfo.phone || '';
            restaurantAddress = sData.restaurantInfo.address || '';
          }
        }
      } catch (err: any) {
        console.info("Could not retrieve restaurant info on server:", err?.message || String(err));
      }

      // 2. Fetch Invoice Document
      const invoiceSnap = await adminDb.collection('restaurants')
        .doc(restaurantId)
        .collection('invoices')
        .doc(invoiceId)
        .get();

      if (invoiceSnap.exists) {
        return res.json({
          success: true,
          restaurantName,
          restaurantPhone,
          restaurantAddress,
          invoice: invoiceSnap.data()
        });
      }

      // Fallback 1: Search by invoiceNo field inside invoices collection
      const invoiceNoQuery = await adminDb.collection('restaurants')
        .doc(restaurantId)
        .collection('invoices')
        .where('invoiceNo', '==', invoiceId)
        .limit(1)
        .get();

      if (!invoiceNoQuery.empty) {
        return res.json({
          success: true,
          restaurantName,
          restaurantPhone,
          restaurantAddress,
          invoice: invoiceNoQuery.docs[0].data()
        });
      }

      // Fallback 2: Check orders collection by invoiceNumber
      const ordersQueryByInvoiceNum = await adminDb.collection('restaurants')
        .doc(restaurantId)
        .collection('orders')
        .where('invoiceNumber', '==', invoiceId)
        .limit(1)
        .get();

      if (!ordersQueryByInvoiceNum.empty) {
        const orderData = ordersQueryByInvoiceNum.docs[0].data();
        const mappedInvoice = {
          id: 'inv_' + orderData.id,
          orderId: orderData.id,
          invoiceNo: orderData.invoiceNumber || invoiceId,
          customerName: orderData.customerName || 'Walk-In Customer',
          customerPhone: orderData.customerPhone || '',
          tableNo: orderData.tableNo || 'Takeaway',
          items: orderData.items || [],
          subtotal: orderData.totalAmount ? Math.round(orderData.totalAmount / 1.05) : 0,
          gst: orderData.totalAmount ? (orderData.totalAmount - Math.round(orderData.totalAmount / 1.05)) : 0,
          discount: 0,
          total: orderData.totalAmount || 0,
          paymentMethod: orderData.paymentMethod || 'UPI Digital',
          timestamp: orderData.timestamp || Date.now()
        };

        return res.json({
          success: true,
          restaurantName,
          restaurantPhone,
          restaurantAddress,
          invoice: mappedInvoice
        });
      }

      // Fallback 3: Check orders collection by direct order ID
      const ordersQueryByOrderId = await adminDb.collection('restaurants')
        .doc(restaurantId)
        .collection('orders')
        .doc(invoiceId.replace('inv_', ''))
        .get();

      if (ordersQueryByOrderId.exists) {
        const orderData = ordersQueryByOrderId.data()!;
        const mappedInvoice = {
          id: 'inv_' + orderData.id,
          orderId: orderData.id,
          invoiceNo: orderData.invoiceNumber || `INV-${orderData.orderNumber || 'TEMP'}`,
          customerName: orderData.customerName || 'Walk-In Customer',
          customerPhone: orderData.customerPhone || '',
          tableNo: orderData.tableNo || 'Takeaway',
          items: orderData.items || [],
          subtotal: orderData.totalAmount ? Math.round(orderData.totalAmount / 1.05) : 0,
          gst: orderData.totalAmount ? (orderData.totalAmount - Math.round(orderData.totalAmount / 1.05)) : 0,
          discount: 0,
          total: orderData.totalAmount || 0,
          paymentMethod: orderData.paymentMethod || 'UPI Digital',
          timestamp: orderData.timestamp || Date.now()
        };

        return res.json({
          success: true,
          restaurantName,
          restaurantPhone,
          restaurantAddress,
          invoice: mappedInvoice
        });
      }

      return res.status(404).json({ error: 'Invoice or matching Order record could not be found.' });

    } catch (error: any) {
      console.error('Error fetching invoice details:', error);
      return res.status(500).json({ error: error.message || 'Server failed to retrieve invoice.' });
    }
  });

  // ==========================================
  // API ROUTES: Subscription System (Razorpay Integrated)
  // ==========================================
  function getPlanPricingInfo(planId: string, billingCycle: string = 'monthly') {
    const normPlan = (planId === 'professional' ? 'pro' : planId === 'enterprise' ? 'business' : planId) || 'pro';
    const cycle = billingCycle || 'monthly';

    if (cycle === 'founders') {
      if (normPlan === 'basic') return { price: 5999, name: 'Basic', durationDays: 365, planKey: 'basic' };
      if (normPlan === 'business') return { price: 14999, name: 'Enterprise', durationDays: 365, planKey: 'business' };
      return { price: 9999, name: 'Professional', durationDays: 365, planKey: 'pro' };
    } else if (cycle === 'annual') {
      if (normPlan === 'basic') return { price: 14999, name: 'Basic', durationDays: 365, planKey: 'basic' };
      if (normPlan === 'business') return { price: 24999, name: 'Enterprise', durationDays: 365, planKey: 'business' };
      return { price: 19999, name: 'Professional', durationDays: 365, planKey: 'pro' };
    } else {
      if (normPlan === 'basic') return { price: 999, name: 'Basic', durationDays: 30, planKey: 'basic' };
      if (normPlan === 'business') return { price: 2499, name: 'Enterprise', durationDays: 30, planKey: 'business' };
      return { price: 1499, name: 'Professional', durationDays: 30, planKey: 'pro' };
    }
  }

  // Server-side live subscription cache & fallback map
  const liveSubscriptionStore = new Map<string, { subscription: any; history: any[] }>();

  app.post('/api/subscription/create-order', async (req, res) => {
    const { planId, restaurantId, billingCycle } = req.body;

    const selectedPlan = getPlanPricingInfo(planId, billingCycle);
    const amountPaise = selectedPlan.price * 100;

    try {
      let orderId = `order_sub_${Date.now()}`;
      let keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';

      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_your_key_id') {
        try {
          const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt: `sub_rcpt_${Date.now()}`
          });
          orderId = order.id;
        } catch (rzpErr: any) {
          console.warn('Razorpay SDK order creation warning (using test fallback):', rzpErr?.message || rzpErr);
        }
      }

      return res.json({
        success: true,
        keyId,
        razorpayOrderId: orderId,
        amount: amountPaise,
        currency: 'INR',
        planId: selectedPlan.planKey,
        planName: selectedPlan.name,
        planPrice: selectedPlan.price,
        billingCycle: billingCycle || 'monthly'
      });
    } catch (error: any) {
      console.error('Error creating subscription order:', error);
      return res.status(500).json({ error: error.message || 'Failed to create subscription order.' });
    }
  });

  app.post('/api/subscription/verify', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, billingCycle, restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurantId is required.' });
    }

    const selectedPlan = getPlanPricingInfo(planId, billingCycle);

    try {
      if (razorpay_signature && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET !== 'your_test_key_secret') {
        const generated_signature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update((razorpay_order_id || '') + '|' + (razorpay_payment_id || ''))
          .digest('hex');

        if (generated_signature !== razorpay_signature) {
          return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
        }
      }

      const payId = razorpay_payment_id || `pay_${Date.now()}`;
      const ordId = razorpay_order_id || `order_${Date.now()}`;
      const startTime = Date.now();
      const endTime = startTime + selectedPlan.durationDays * 24 * 60 * 60 * 1000;
      const invNum = `OPP-INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const subtotal = Math.round(selectedPlan.price / 1.18);
      const gst = selectedPlan.price - subtotal;

      const subscriptionData = {
        subscriptionId: `sub_${Date.now()}`,
        userId: restaurantId || 'default',
        subscription_status: 'active',
        subscription_plan: selectedPlan.planKey,
        plan_name: selectedPlan.name,
        subscription_price: selectedPlan.price,
        billing_cycle: billingCycle || 'monthly',
        subscription_start: startTime,
        subscription_end: endTime,
        renewalDate: endTime,
        payment_status: 'paid',
        payment_method: 'Razorpay',
        transaction_id: payId,
        razorpay_payment_id: payId,
        razorpay_order_id: ordId,
        remainingDays: selectedPlan.durationDays,
        isExpired: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const historyRecord = {
        id: `hist_${Date.now()}`,
        invoiceNumber: invNum,
        subscriptionId: subscriptionData.subscriptionId,
        userId: restaurantId || 'default',
        plan: selectedPlan.planKey,
        planName: selectedPlan.name,
        billingCycle: billingCycle || 'monthly',
        price: selectedPlan.price,
        discount: billingCycle === 'founders' ? 6000 : billingCycle === 'annual' ? 5000 : 700,
        subtotal,
        gst,
        totalAmount: selectedPlan.price,
        paymentStatus: 'paid',
        transactionId: payId,
        razorpayOrderId: ordId,
        razorpayPaymentId: payId,
        paymentMethod: 'Razorpay',
        subscriptionStart: startTime,
        subscriptionEnd: endTime,
        createdAt: Date.now()
      };

      // Save to Live Store
      const existing = liveSubscriptionStore.get(restaurantId) || { subscription: null, history: [] };
      liveSubscriptionStore.set(restaurantId, {
        subscription: subscriptionData,
        history: [historyRecord, ...existing.history.filter(h => h.id !== historyRecord.id)]
      });

      if (restaurantId && adminDb) {
        try {
          const docRef = adminDb.collection('settings').doc(restaurantId);
          await docRef.set({
            subscription: subscriptionData
          }, { merge: true });

          await docRef.collection('subscription_history').doc(historyRecord.id).set(historyRecord);
        } catch (dbErr) {
          console.error('Firestore admin save subscription error:', dbErr);
        }
      }

      return res.json({
        success: true,
        message: 'Payment verified and subscription activated!',
        subscription: subscriptionData,
        invoice: historyRecord
      });
    } catch (error: any) {
      console.error('Error verifying subscription payment:', error);
      return res.status(500).json({ error: error.message || 'Verification process failed.' });
    }
  });

  app.get('/api/subscription/status', async (req, res) => {
    const { restaurantId } = req.query;

    if (!restaurantId || typeof restaurantId !== 'string') {
      return res.status(400).json({ error: 'restaurantId query parameter is required.' });
    }

    try {
      let sub: any = null;

      if (adminDb) {
        try {
          const docSnap = await adminDb.collection('settings').doc(restaurantId).get();
          if (docSnap.exists) {
            sub = docSnap.data()?.subscription;
          }
        } catch (dbErr: any) {
          console.info('Firestore subscription status notice:', dbErr?.message || String(dbErr));
        }
      }

      if (!sub) {
        sub = liveSubscriptionStore.get(restaurantId)?.subscription;
      }

      if (!sub) {
        const now = Date.now();
        const initialStart = now - 2 * 24 * 60 * 60 * 1000;
        const initialEnd = now + 358 * 24 * 60 * 60 * 1000;
        sub = {
          subscriptionId: `sub_init_${restaurantId.slice(-4) || '101'}`,
          userId: restaurantId,
          subscription_status: 'active',
          subscription_plan: 'pro',
          plan_name: 'Professional',
          subscription_price: 1499,
          billing_cycle: 'founders',
          subscription_start: initialStart,
          subscription_end: initialEnd,
          renewalDate: initialEnd,
          payment_status: 'paid',
          payment_method: 'Razorpay (UPI)',
          transaction_id: `pay_rzp_live_${restaurantId.slice(-4) || '101'}`,
          razorpay_payment_id: `pay_rzp_live_${restaurantId.slice(-4) || '101'}`,
          razorpay_order_id: `ord_rzp_live_${restaurantId.slice(-4) || '101'}`
        };

        const initialHist = {
          id: `hist_init_${restaurantId.slice(-4) || '101'}`,
          invoiceNumber: `OPP-INV-${new Date().getFullYear()}-1001`,
          subscriptionId: sub.subscriptionId,
          userId: restaurantId,
          plan: 'pro',
          planName: 'Professional',
          billingCycle: 'founders',
          price: 1499,
          discount: 700,
          subtotal: 1270,
          gst: 229,
          totalAmount: 1499,
          paymentStatus: 'paid',
          transactionId: sub.transaction_id,
          razorpayOrderId: sub.razorpay_order_id,
          razorpayPaymentId: sub.razorpay_payment_id,
          paymentMethod: 'Razorpay',
          subscriptionStart: initialStart,
          subscriptionEnd: initialEnd,
          createdAt: initialStart
        };

        liveSubscriptionStore.set(restaurantId, {
          subscription: sub,
          history: [initialHist]
        });

        if (adminDb) {
          try {
            const docRef = adminDb.collection('settings').doc(restaurantId);
            await docRef.set({ subscription: sub }, { merge: true });
            await docRef.collection('subscription_history').doc(initialHist.id).set(initialHist);
          } catch (e) {
            console.info('Firestore initial subscription save notice:', e);
          }
        }
      }

      const now = Date.now();
      const daysRemaining = sub.subscription_end ? Math.max(0, Math.ceil((sub.subscription_end - now) / (1000 * 60 * 60 * 24))) : 0;
      const isExpired = sub.subscription_end ? now > sub.subscription_end : false;

      return res.json({
        success: true,
        subscription: {
          ...sub,
          subscription_status: isExpired ? 'expired' : sub.subscription_status,
          remainingDays: daysRemaining,
          isExpired
        },
        daysRemaining,
        isExpired
      });
    } catch (error: any) {
      console.error('Error fetching subscription status:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch subscription status.' });
    }
  });

  app.get('/api/subscription/history', async (req, res) => {
    const { restaurantId } = req.query;

    if (!restaurantId || typeof restaurantId !== 'string') {
      return res.status(400).json({ error: 'restaurantId query parameter is required.' });
    }

    try {
      let historyList: any[] = [];
      if (adminDb) {
        try {
          const histSnap = await adminDb.collection('settings').doc(restaurantId).collection('subscription_history').get();
          historyList = histSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          historyList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } catch (dbErr: any) {
          console.info('Firestore subscription history fetch notice:', dbErr?.message || String(dbErr));
        }
      }

      const memHistory = liveSubscriptionStore.get(restaurantId)?.history || [];
      if (historyList.length === 0 && memHistory.length > 0) {
        historyList = memHistory;
      }

      if (historyList.length === 0 && adminDb) {
        try {
          const docSnap = await adminDb.collection('settings').doc(restaurantId).get();
          const sub = docSnap.data()?.subscription;
          if (sub && sub.subscription_start) {
            const subtotal = Math.round((sub.subscription_price || 1499) / 1.18);
            historyList = [{
              id: 'hist_initial',
              invoiceNumber: `OPP-INV-${new Date().getFullYear()}-1001`,
              subscriptionId: sub.subscriptionId || 'sub_init',
              userId: restaurantId,
              plan: sub.subscription_plan || 'pro',
              planName: sub.plan_name || 'Professional',
              billingCycle: sub.billing_cycle || 'monthly',
              price: sub.subscription_price || 1499,
              discount: 700,
              subtotal,
              gst: (sub.subscription_price || 1499) - subtotal,
              totalAmount: sub.subscription_price || 1499,
              paymentStatus: 'paid',
              transactionId: sub.transaction_id || 'pay_init_101',
              razorpayOrderId: sub.razorpay_order_id || 'ord_init_101',
              razorpayPaymentId: sub.razorpay_payment_id || sub.transaction_id || 'pay_init_101',
              paymentMethod: 'Razorpay',
              subscriptionStart: sub.subscription_start,
              subscriptionEnd: sub.subscription_end,
              createdAt: sub.subscription_start
            }];
          }
        } catch (docErr: any) {
          console.info('Firestore settings doc fetch notice:', docErr?.message || String(docErr));
        }
      }

      return res.json({
        success: true,
        history: historyList
      });
    } catch (error: any) {
      console.error('Error fetching subscription history:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch history.' });
    }
  });

  app.post('/api/subscription/renew', async (req, res) => {
    const { restaurantId, planId, billingCycle, razorpay_payment_id } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurantId is required.' });
    }

    try {
      let currentSub: any = null;
      if (adminDb) {
        try {
          const docSnap = await adminDb.collection('settings').doc(restaurantId).get();
          if (docSnap.exists) {
            currentSub = docSnap.data()?.subscription;
          }
        } catch (dbErr: any) {
          console.info('Firestore settings lookup notice during renew:', dbErr?.message || String(dbErr));
        }
      }

      const pId = planId || currentSub?.subscription_plan || 'pro';
      const bCycle = billingCycle || currentSub?.billing_cycle || 'monthly';
      const selectedPlan = getPlanPricingInfo(pId, bCycle);

      const now = Date.now();
      // If current subscription is still active, extend from end date. Otherwise extend from now.
      const baseStart = (currentSub?.subscription_end && currentSub.subscription_end > now)
        ? currentSub.subscription_end
        : now;

      const newEnd = baseStart + selectedPlan.durationDays * 24 * 60 * 60 * 1000;
      const payId = razorpay_payment_id || `pay_renew_${Date.now()}`;
      const invNum = `OPP-INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const subtotal = Math.round(selectedPlan.price / 1.18);
      const gst = selectedPlan.price - subtotal;

      const updatedSub = {
        ...currentSub,
        subscription_status: 'active',
        subscription_plan: selectedPlan.planKey,
        plan_name: selectedPlan.name,
        subscription_price: selectedPlan.price,
        billing_cycle: bCycle,
        subscription_start: now,
        subscription_end: newEnd,
        renewalDate: newEnd,
        payment_status: 'paid',
        payment_method: 'Razorpay',
        transaction_id: payId,
        razorpay_payment_id: payId,
        remainingDays: Math.ceil((newEnd - now) / (1000 * 60 * 60 * 24)),
        isExpired: false,
        updatedAt: FieldValue.serverTimestamp()
      };

      const historyRecord = {
        id: `hist_${Date.now()}`,
        invoiceNumber: invNum,
        subscriptionId: `sub_${Date.now()}`,
        userId: restaurantId,
        plan: selectedPlan.planKey,
        planName: selectedPlan.name,
        billingCycle: bCycle,
        price: selectedPlan.price,
        discount: bCycle === 'founders' ? 6000 : bCycle === 'annual' ? 5000 : 700,
        subtotal,
        gst,
        totalAmount: selectedPlan.price,
        paymentStatus: 'paid',
        transactionId: payId,
        razorpayPaymentId: payId,
        paymentMethod: 'Razorpay',
        subscriptionStart: now,
        subscriptionEnd: newEnd,
        createdAt: Date.now()
      };

      // Save to Live Store
      const existing = liveSubscriptionStore.get(restaurantId) || { subscription: null, history: [] };
      liveSubscriptionStore.set(restaurantId, {
        subscription: updatedSub,
        history: [historyRecord, ...existing.history.filter(h => h.id !== historyRecord.id)]
      });

      if (adminDb) {
        const docRef = adminDb.collection('settings').doc(restaurantId);
        await docRef.set({ subscription: updatedSub }, { merge: true });
        await docRef.collection('subscription_history').doc(historyRecord.id).set(historyRecord);
      }

      return res.json({
        success: true,
        message: 'Subscription successfully renewed!',
        subscription: updatedSub,
        invoice: historyRecord
      });
    } catch (error: any) {
      console.error('Error renewing subscription:', error);
      return res.status(500).json({ error: error.message || 'Renewal failed.' });
    }
  });

  app.get('/api/subscription/invoice/:id', async (req, res) => {
    const { id } = req.params;
    const { restaurantId } = req.query;

    try {
      let record: any = null;
      if (restaurantId && adminDb) {
        try {
          const docSnap = await adminDb.collection('settings').doc(restaurantId as string).collection('subscription_history').doc(id).get();
          if (docSnap.exists) {
            record = docSnap.data();
          }
        } catch (dbErr: any) {
          console.info('Firestore invoice lookup notice:', dbErr?.message || String(dbErr));
        }
      }

      if (!record) {
        // Fallback sample record
        record = {
          invoiceNumber: `OPP-INV-2026-${id.slice(-4) || '8492'}`,
          subscriptionId: `sub_${id}`,
          planName: 'Professional',
          billingCycle: 'founders',
          price: 9999,
          subtotal: 8474,
          gst: 1525,
          totalAmount: 9999,
          paymentStatus: 'paid',
          transactionId: id,
          razorpayPaymentId: id,
          paymentMethod: 'Razorpay',
          subscriptionStart: Date.now() - 5 * 24 * 60 * 60 * 1000,
          subscriptionEnd: Date.now() + 360 * 24 * 60 * 60 * 1000,
          createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000
        };
      }

      return res.json({
        success: true,
        invoice: record
      });
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      return res.status(500).json({ error: error.message || 'Invoice fetch failed.' });
    }
  });

  // ==========================================
  // API ROUTE: Check Email Existence
  // ==========================================
  app.post('/api/auth/check-email', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      const userRecord = await adminAuth.getUserByEmail(email);
      return res.json({ success: true, exists: true, uid: userRecord.uid });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return res.json({ success: true, exists: false });
      }
      console.error('Error checking user email in auth:', error);
      return res.status(500).json({ error: error.message || 'Internal check failed' });
    }
  });

  // ==========================================
  // API ROUTE: Create Staff Account with Limits Guard
  // ==========================================
  app.post('/api/staff/create', async (req, res) => {
    const { restaurantId, staffMember } = req.body;

    if (!restaurantId || !staffMember || !staffMember.email || !staffMember.password || !staffMember.name) {
      return res.status(400).json({ error: 'restaurantId and staff details are required.' });
    }

    try {
      // 1. Check current subscription limits
      let staffLimit = 999; // Default unlimited for pro/enterprise/trial
      let currentStaffCount = 0;

      if (adminDb) {
        // Get settings and subscription plan
        const settingsSnap = await adminDb.collection('settings').doc(restaurantId).get();
        if (settingsSnap.exists) {
          const settings = settingsSnap.data();
          const plan = settings?.subscription?.subscription_plan || 'trial';
          
          if (plan === 'free') {
            staffLimit = 2;
          } else if (plan === 'starter') {
            staffLimit = 5;
          }
        }

        // Get current staff count
        const staffSnap = await adminDb.collection('restaurants').doc(restaurantId).collection('staffMembers').get();
        currentStaffCount = staffSnap.size;
      }

      if (currentStaffCount >= staffLimit) {
        return res.status(403).json({
          error: `Your current plan allows up to ${staffLimit} staff members. Please upgrade your plan to add more.`,
          code: 'subscription/limit-reached'
        });
      }

      // 2. Create the user in Firebase Auth using the Admin SDK
      const authUser = await adminAuth.createUser({
        email: staffMember.email,
        password: staffMember.password,
        displayName: staffMember.name,
        emailVerified: true // Auto-verify staff since they are created by owner
      });

      const uid = authUser.uid;

      // 3. Save profile in /users/{uid}
      const userRef = adminDb.collection('users').doc(uid);
      const userProfile = {
        uid,
        fullName: staffMember.name,
        email: staffMember.email,
        phone: staffMember.phone || 'N/A',
        role: staffMember.role || 'Waiter',
        restaurantId,
        organizationId: restaurantId,
        createdAt: new Date().toISOString(),
        emailVerified: true,
        isVerified: true
      };
      await userRef.set(userProfile);

      // 4. Save staff member under the tenant's subcollection
      const staffRef = adminDb.collection('restaurants').doc(restaurantId).collection('staffMembers').doc(staffMember.id || `s_${Date.now()}`);
      const newStaffDoc = {
        id: staffMember.id || `s_${Date.now()}`,
        name: staffMember.name,
        role: staffMember.role || 'Waiter',
        email: staffMember.email,
        phone: staffMember.phone || 'N/A',
        status: 'Active',
        uid: uid,
        createdAt: new Date().toISOString()
      };
      await staffRef.set(newStaffDoc);

      return res.json({
        success: true,
        message: 'Staff member onboarded and credentials provisioned!',
        staff: newStaffDoc
      });

    } catch (error: any) {
      console.error('Error creating staff account on backend:', error);
      let errMsg = error.message || 'Failed to create staff member account.';
      if (error.code === 'auth/email-already-in-use') {
        errMsg = 'This email address is already in use by another user.';
      }
      return res.status(500).json({ error: errMsg, code: error.code });
    }
  });

  // ==========================================
  // Vite Middleware & Front-End Static Delivery
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 OrderPoint Pro backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
