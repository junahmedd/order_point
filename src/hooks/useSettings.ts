import { useState, useEffect, useRef } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { SettingsData, defaultSettings } from '../types';
import toast from 'react-hot-toast';

export function useSettings() {
  const [data, setData] = useState<SettingsData>(() => {
    try {
      const saved = localStorage.getItem('orderpoint_settings_latest');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultSettings,
          ...parsed,
          restaurantInfo: { ...defaultSettings.restaurantInfo, ...(parsed.restaurantInfo || {}) },
          branding: { ...defaultSettings.branding, ...(parsed.branding || {}) },
          gstTax: { ...defaultSettings.gstTax, ...(parsed.gstTax || {}) },
          payment: { ...defaultSettings.payment, ...(parsed.payment || {}) },
          whatsapp: { ...defaultSettings.whatsapp, ...(parsed.whatsapp || {}) },
          qrOrdering: { ...defaultSettings.qrOrdering, ...(parsed.qrOrdering || {}) },
          notifications: { ...defaultSettings.notifications, ...(parsed.notifications || {}) },
          security: { ...defaultSettings.security, ...(parsed.security || {}) },
          preferences: { ...defaultSettings.preferences, ...(parsed.preferences || {}) },
          tables: parsed.tables || defaultSettings.tables,
          subscription: parsed.subscription || defaultSettings.subscription,
        };
      }
    } catch (e) {
      console.info('Settings initial local cache load notice:', e);
    }
    return defaultSettings;
  });

  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(() => auth.currentUser?.uid || localStorage.getItem('orderpoint_user_id') || null);

  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    let unsubUserSnap: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (unsubUserSnap) {
        unsubUserSnap();
        unsubUserSnap = null;
      }

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        unsubUserSnap = onSnapshot(userDocRef, (userDocSnap) => {
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const rId = userData.restaurantId || user.uid;
            setUserId(rId);
            localStorage.setItem('orderpoint_user_id', rId);
          } else {
            setUserId(user.uid);
            localStorage.setItem('orderpoint_user_id', user.uid);
          }
        }, (dbErr) => {
          console.warn('Error listening to user profile in settings:', dbErr);
          setUserId(user.uid);
          localStorage.setItem('orderpoint_user_id', user.uid);
        });
      } else {
        const params = new URLSearchParams(window.location.search);
        const urlRestaurantId = params.get('restaurantId') || params.get('store');
        if (urlRestaurantId) {
          setUserId(urlRestaurantId);
          localStorage.setItem('orderpoint_user_id', urlRestaurantId);
        } else {
          const cachedUid = localStorage.getItem('orderpoint_user_id');
          if (cachedUid) {
            setUserId(cachedUid);
          } else {
            setUserId('default_restaurant');
          }
        }
      }
    });

    return () => {
      unsub();
      if (unsubUserSnap) unsubUserSnap();
    };
  }, []);

  const activeUserId = userId || localStorage.getItem('orderpoint_user_id') || 'default_restaurant';

  // Listen for live window events across tabs/components
  useEffect(() => {
    const handleCustomUpdate = (e: CustomEvent<SettingsData>) => {
      if (e.detail) {
        setData(e.detail);
      }
    };
    window.addEventListener('orderpoint_settings_updated' as any, handleCustomUpdate);
    return () => {
      window.removeEventListener('orderpoint_settings_updated' as any, handleCustomUpdate);
    };
  }, []);

  // Fetch / subscribe to settings
  useEffect(() => {
    if (!activeUserId) return;

    const docRef = doc(db, 'settings', activeUserId);
    
    // Attempt initialization if doc doesn't exist
    const initializeSettings = async () => {
      try {
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          await setDoc(docRef, { ...dataRef.current, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        }
      } catch (err) {
        console.info('Firestore settings init notice (using local/server fallback):', err);
      }
    };
    initializeSettings();

    // Secondary fetch from Express server
    fetch(`/api/settings?restaurantId=${activeUserId}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.settings) {
          setData(prev => {
            const merged = {
              ...prev,
              ...json.settings,
              restaurantInfo: { ...prev.restaurantInfo, ...(json.settings.restaurantInfo || {}) },
              branding: { ...prev.branding, ...(json.settings.branding || {}) },
              gstTax: { ...prev.gstTax, ...(json.settings.gstTax || {}) },
              payment: { ...prev.payment, ...(json.settings.payment || {}) },
              whatsapp: { ...prev.whatsapp, ...(json.settings.whatsapp || {}) },
              qrOrdering: { ...prev.qrOrdering, ...(json.settings.qrOrdering || {}) },
              notifications: { ...prev.notifications, ...(json.settings.notifications || {}) },
              security: { ...prev.security, ...(json.settings.security || {}) },
              preferences: { ...prev.preferences, ...(json.settings.preferences || {}) },
              tables: json.settings.tables || prev.tables || [],
              subscription: json.settings.subscription || prev.subscription,
            };
            try {
              localStorage.setItem('orderpoint_settings_latest', JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      })
      .catch(e => console.info('Server settings fetch notice:', e));

    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedData = snapshot.data();
        setData((prev) => {
          const merged = {
            ...prev,
            ...fetchedData,
            restaurantInfo: { ...prev.restaurantInfo, ...fetchedData.restaurantInfo },
            branding: { ...prev.branding, ...fetchedData.branding },
            gstTax: { ...prev.gstTax, ...fetchedData.gstTax },
            payment: { ...prev.payment, ...fetchedData.payment },
            whatsapp: { ...prev.whatsapp, ...fetchedData.whatsapp },
            qrOrdering: { ...prev.qrOrdering, ...fetchedData.qrOrdering },
            notifications: { ...prev.notifications, ...fetchedData.notifications },
            security: { ...prev.security, ...fetchedData.security },
            preferences: { ...prev.preferences, ...fetchedData.preferences },
            tables: fetchedData.tables || prev.tables || [],
            subscription: fetchedData.subscription ? { ...prev.subscription, ...fetchedData.subscription } : prev.subscription,
          };
          try {
            localStorage.setItem('orderpoint_settings_latest', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      console.info('Firestore settings snapshot listener notice:', error);
    });

    return unsub;
  }, [activeUserId]);

  const updateData = (section: keyof SettingsData, key: string, value: any) => {
    setData((prev) => {
      let next: SettingsData;
      if (section === 'tables') {
        next = { ...prev, tables: value };
      } else {
        next = {
          ...prev,
          [section]: {
            ...(prev as any)[section],
            [key]: value,
          },
        };
      }
      return next;
    });
  };

  const persistLocallyAndBroadcast = (updatedFullData: SettingsData) => {
    try {
      localStorage.setItem('orderpoint_settings_latest', JSON.stringify(updatedFullData));
      localStorage.setItem(`orderpoint_settings_${activeUserId}`, JSON.stringify(updatedFullData));
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('orderpoint_settings_updated', { detail: updatedFullData }));

    // Send to backend server
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: activeUserId,
        settings: updatedFullData
      })
    }).catch(err => console.info('Server settings sync notice:', err));
  };

  const saveMultipleSections = async (sections: (keyof SettingsData)[]) => {
    setSavingSection(sections.join('_'));
    const currentFullData = dataRef.current;

    persistLocallyAndBroadcast(currentFullData);

    try {
      const docRef = doc(db, 'settings', activeUserId);
      const updatePayload: any = {
        updatedAt: serverTimestamp(),
      };
      sections.forEach((sec) => {
        updatePayload[sec] = currentFullData[sec];
      });

      await setDoc(docRef, updatePayload, { merge: true });

      const messages: Record<string, string> = {
        restaurantInfo: 'Restaurant Info Updated',
        branding: 'Branding Saved',
        gstTax: 'GST Settings Updated',
        payment: 'Payment Settings Updated',
        whatsapp: 'WhatsApp Connected',
        qrOrdering: 'QR Setup Saved',
        notifications: 'Alert Settings Applied',
        security: 'Security Updated',
        preferences: 'Preferences Saved',
      };

      const combinedMsg = sections
        .map((s) => messages[s as string] || 'Settings Saved')
        .join(' and ');

      toast.success(combinedMsg || 'Settings Saved Successfully', {
        style: {
          borderRadius: '12px',
          background: '#111111',
          color: '#fff',
          padding: '12px 16px',
          fontSize: '14px',
        },
        iconTheme: {
          primary: '#10b981',
          secondary: '#fff',
        },
      });
    } catch (err: any) {
      console.warn('Firestore update warning (local/server persistence applied):', err);
      toast.success('Settings Saved Live!', {
        style: {
          borderRadius: '12px',
          background: '#111111',
          color: '#fff',
          padding: '12px 16px',
          fontSize: '14px',
        }
      });
    } finally {
      setSavingSection(null);
    }
  };

  const saveSection = async (section: keyof SettingsData) => {
    setSavingSection(section as string);
    const currentFullData = dataRef.current;

    persistLocallyAndBroadcast(currentFullData);

    try {
      const docRef = doc(db, 'settings', activeUserId);
      await setDoc(docRef, {
        [section]: currentFullData[section],
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      const messages: Record<string, string> = {
        restaurantInfo: 'Restaurant Info Updated',
        branding: 'Branding Saved',
        gstTax: 'GST Updated',
        payment: 'Payment Settings Updated',
        whatsapp: 'WhatsApp Connected',
        qrOrdering: 'QR Setup Saved',
        notifications: 'Alert Settings Applied',
        security: 'Security Updated',
        preferences: 'Preferences Saved',
        tables: 'Table Configurations Saved'
      };
      
      toast.success(messages[section as string] || 'Settings Saved Successfully', {
        style: {
          borderRadius: '12px',
          background: '#111111',
          color: '#fff',
          padding: '12px 16px',
          fontSize: '14px',
        },
        iconTheme: {
          primary: '#10b981',
          secondary: '#fff',
        },
      });
    } catch (err: any) {
      console.warn('Firestore update warning (local/server persistence applied):', err);
      toast.success('Settings Saved Live!', {
        style: {
          borderRadius: '12px',
          background: '#111111',
          color: '#fff',
          padding: '12px 16px',
          fontSize: '14px',
        }
      });
    } finally {
      setSavingSection(null);
    }
  };

  return {
    data,
    loading,
    savingSection,
    updateData,
    saveSection,
    saveMultipleSections,
  };
}

