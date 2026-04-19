/* eslint-disable @typescript-eslint/no-unsafe-assignment */

const EMULATOR_FIRESTORE = 'http://127.0.0.1:8080';
const PROJECT_ID = (Cypress.env('FIREBASE_PROJECT_ID') as string) || 'demo-heliotrope';

const TEST_EMAIL = 'settingstest@example.com';
const TEST_PASSWORD = 'testpass123';

function writeFirestoreDoc(path: string, fields: Record<string, unknown>) {
  return cy.request({
    method: 'PATCH',
    url: `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    headers: { Authorization: 'Bearer owner' },
    body: { fields },
  });
}

function deleteFirestoreDoc(path: string) {
  return cy.request({
    method: 'DELETE',
    url: `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    headers: { Authorization: 'Bearer owner' },
    failOnStatusCode: false,
  });
}

function fs(value: string) {
  return { stringValue: value };
}

function fi(value: number) {
  return { integerValue: value.toString() };
}

function fb(value: boolean) {
  return { booleanValue: value };
}

function fts() {
  return {
    mapValue: {
      fields: { seconds: fi(1700000000), nanoseconds: fi(0) },
    },
  };
}

function fnull() {
  return { nullValue: null };
}

function fmap(fields: Record<string, unknown>) {
  return { mapValue: { fields } };
}

describe('Settings', () => {
  let uid: string;

  before(() => {
    cy.task('createFirebaseUser', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      projectId: PROJECT_ID,
    }).then((result) => {
      uid = result as string;
    });
  });

  function signIn() {
    cy.visit('/');
    cy.contains('h1', /Sign in|Dashboard/, { timeout: 10000 });
    cy.url().then((url) => {
      if (url.includes('/dashboard')) {
        return;
      }
      cy.get('#email').type(TEST_EMAIL);
      cy.get('#password').type(TEST_PASSWORD);
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/dashboard', { timeout: 10000 });
    });
  }

  function seedProfile() {
    writeFirestoreDoc(`users/${uid}/profile/singleton`, {
      displayName: fs('Test User'),
      email: fs(TEST_EMAIL),
      slack: fmap({
        connected: fb(false),
        teamId: fnull(),
        userId: fnull(),
        teamName: fnull(),
        lastValidatedAt: fnull(),
      }),
      scheduler: fmap({
        intervalMinutes: fi(15),
        minSecondsBetweenSlackUploads: fi(300),
      }),
      defaultImageId: fnull(),
      iosShortcutBearer: fnull(),
      createdAt: fts(),
    });
  }

  function cleanup() {
    deleteFirestoreDoc(`users/${uid}/profile/singleton`);
    deleteFirestoreDoc(`users/${uid}/secrets/slack`);
    deleteFirestoreDoc(`users/${uid}/secrets/iosShortcutBearer`);
  }

  describe('Slack token management', () => {
    beforeEach(() => {
      signIn();
      seedProfile();
    });

    afterEach(() => {
      cleanup();
    });

    it('connects with a valid Slack token', () => {
      // Intercept the Cloud Function call
      cy.intercept('POST', '**/setSlackToken', {
        statusCode: 200,
        body: { ok: true, slackTeamId: 'T123', slackUserId: 'U456' },
      }).as('setSlackToken');

      cy.visit('/settings');
      cy.contains('Slack Connection').should('be.visible');

      // Enter token and connect
      cy.get('#slack-token').type('xoxp-fake-token-for-testing');
      cy.contains('button', 'Connect').click();

      cy.wait('@setSlackToken');

      // After the function call, seed the updated profile to simulate the server update
      writeFirestoreDoc(`users/${uid}/profile/singleton`, {
        displayName: fs('Test User'),
        email: fs(TEST_EMAIL),
        slack: fmap({
          connected: fb(true),
          teamId: fs('T123'),
          userId: fs('U456'),
          teamName: fs('Test Workspace'),
          lastValidatedAt: fts(),
        }),
        scheduler: fmap({
          intervalMinutes: fi(15),
          minSecondsBetweenSlackUploads: fi(300),
        }),
        defaultImageId: fnull(),
        iosShortcutBearer: fnull(),
        createdAt: fts(),
      });

      // Verify connected state
      cy.contains('Test Workspace').should('be.visible');
      cy.contains('U456').should('be.visible');
      cy.contains('button', 'Reconnect').should('be.visible');
    });

    it('shows error for invalid token', () => {
      cy.intercept('POST', '**/setSlackToken', {
        statusCode: 200,
        body: { ok: false, error: 'invalid_auth' },
      }).as('setSlackToken');

      cy.visit('/settings');
      cy.get('#slack-token').type('bad-token');
      cy.contains('button', 'Connect').click();

      cy.wait('@setSlackToken');
      cy.contains('Could not verify this token').should('be.visible');
    });

    it('reconnects with a new token', () => {
      // Start with a connected profile
      writeFirestoreDoc(`users/${uid}/profile/singleton`, {
        displayName: fs('Test User'),
        email: fs(TEST_EMAIL),
        slack: fmap({
          connected: fb(true),
          teamId: fs('T-OLD'),
          userId: fs('U-OLD'),
          teamName: fs('Old Workspace'),
          lastValidatedAt: fts(),
        }),
        scheduler: fmap({
          intervalMinutes: fi(15),
          minSecondsBetweenSlackUploads: fi(300),
        }),
        defaultImageId: fnull(),
        iosShortcutBearer: fnull(),
        createdAt: fts(),
      });

      cy.intercept('POST', '**/setSlackToken', {
        statusCode: 200,
        body: { ok: true, slackTeamId: 'T-NEW', slackUserId: 'U-NEW' },
      }).as('setSlackToken');

      cy.visit('/settings');
      cy.contains('Old Workspace').should('be.visible');
      cy.contains('button', 'Reconnect').click();

      cy.get('#slack-token').type('xoxp-new-token');
      cy.contains('button', 'Connect').click();
      cy.wait('@setSlackToken');

      // Simulate server update
      writeFirestoreDoc(`users/${uid}/profile/singleton`, {
        displayName: fs('Test User'),
        email: fs(TEST_EMAIL),
        slack: fmap({
          connected: fb(true),
          teamId: fs('T-NEW'),
          userId: fs('U-NEW'),
          teamName: fs('New Workspace'),
          lastValidatedAt: fts(),
        }),
        scheduler: fmap({
          intervalMinutes: fi(15),
          minSecondsBetweenSlackUploads: fi(300),
        }),
        defaultImageId: fnull(),
        iosShortcutBearer: fnull(),
        createdAt: fts(),
      });

      cy.contains('New Workspace').should('be.visible');
    });
  });

  describe('Bearer token generation', () => {
    beforeEach(() => {
      signIn();
      seedProfile();
    });

    afterEach(() => {
      cleanup();
    });

    it('generates a bearer token and displays it once', () => {
      cy.intercept('POST', '**/generateIosShortcutBearer', {
        statusCode: 200,
        body: { ok: true, bearer: 'test-uid:abcdef123456' },
      }).as('generateBearer');

      cy.visit('/settings');
      cy.contains('iOS Shortcut Bearer').should('be.visible');
      cy.contains('button', 'Generate Bearer').click();

      cy.wait('@generateBearer');
      cy.contains('This will not be shown again').should('be.visible');
      cy.get('input[readonly]').should('have.value', 'test-uid:abcdef123456');
    });

    it('shows previously generated state on revisit', () => {
      // Seed profile with bearer info
      writeFirestoreDoc(`users/${uid}/profile/singleton`, {
        displayName: fs('Test User'),
        email: fs(TEST_EMAIL),
        slack: fmap({
          connected: fb(false),
          teamId: fnull(),
          userId: fnull(),
          teamName: fnull(),
          lastValidatedAt: fnull(),
        }),
        scheduler: fmap({
          intervalMinutes: fi(15),
          minSecondsBetweenSlackUploads: fi(300),
        }),
        defaultImageId: fnull(),
        iosShortcutBearer: fmap({
          createdAt: fts(),
          lastUsedAt: fnull(),
        }),
        createdAt: fts(),
      });

      cy.visit('/settings');
      cy.contains('A bearer token was previously generated').should('be.visible');
      cy.contains('button', 'Generate New Bearer').should('be.visible');
      // The bearer value should NOT be visible
      cy.get('input[readonly]').should('not.exist');
    });
  });
});
