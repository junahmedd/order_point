import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

let firebaseConfig: any = {};
try {
  const configPath = join(process.cwd(), 'firebase-applet-config.json');
  firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('Error reading firebase-applet-config.json:', err);
}

const app = getApps().length === 0 ? initializeApp({
  projectId: firebaseConfig.projectId
}) : getApps()[0];

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
