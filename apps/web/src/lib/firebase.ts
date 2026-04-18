import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const firebaseConfig: Record<string, string> = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) ?? 'fake-api-key',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) ?? 'localhost',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) ?? 'demo-heliotrope',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099', {
    disableWarnings: true,
  });
}

export { app, auth };
