import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents(on) {
      on('task', {
        async createFirebaseUser({
          email,
          password,
          projectId,
        }: {
          email: string;
          password: string;
          projectId: string;
        }) {
          const { initializeApp, deleteApp } = await import('firebase/app');
          const {
            getAuth,
            connectAuthEmulator,
            createUserWithEmailAndPassword,
            signInWithEmailAndPassword,
          } = await import('firebase/auth');

          const app = initializeApp({ apiKey: 'fake-api-key', projectId }, `cypress-${Date.now()}`);
          const auth = getAuth(app);
          connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
            disableWarnings: true,
          });

          let uid: string;
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            uid = cred.user.uid;
          } catch {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            uid = cred.user.uid;
          }
          await deleteApp(app);
          return uid;
        },
      });
    },
  },
});
