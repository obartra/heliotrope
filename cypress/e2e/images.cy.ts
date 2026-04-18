/* eslint-disable @typescript-eslint/no-unsafe-assignment */

const EMULATOR_FIRESTORE = 'http://127.0.0.1:8080';
const EMULATOR_STORAGE = 'http://127.0.0.1:9199';

const PROJECT_ID = (Cypress.env('FIREBASE_PROJECT_ID') as string) || 'demo-heliotrope';
const STORAGE_BUCKET = `${PROJECT_ID}.appspot.com`;

const TEST_EMAIL = 'imagetest@example.com';
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

function uploadStorageFile(storagePath: string) {
  return cy.request({
    method: 'POST',
    url: `${EMULATOR_STORAGE}/v0/b/${STORAGE_BUCKET}/o?name=${encodeURIComponent(storagePath)}`,
    headers: { 'Content-Type': 'image/png', Authorization: 'Bearer owner' },
    body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    encoding: 'binary',
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

function fa(values: Array<Record<string, unknown>>) {
  if (values.length === 0) return { arrayValue: {} };
  return { arrayValue: { values } };
}

const IMAGE_ID_1 = '550e8400-e29b-41d4-a716-446655440011';
const IMAGE_ID_2 = '550e8400-e29b-41d4-a716-446655440012';
const RULE_ID = '550e8400-e29b-41d4-a716-446655440099';

describe('Image Library', () => {
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
    // Auth state is async; route wrappers render nothing while loading.
    // Wait for either page's h1 to confirm auth has resolved.
    cy.contains('h1', /Sign in|Dashboard/, { timeout: 10000 });
    cy.url().then((url) => {
      if (url.includes('/dashboard')) {
        return; // already signed in
      }
      cy.get('#email').type(TEST_EMAIL);
      cy.get('#password').type(TEST_PASSWORD);
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/dashboard', { timeout: 10000 });
    });
  }

  describe('Upload flow', () => {
    it('uploads a valid image and shows it in the library', () => {
      signIn();
      cy.visit('/images');

      cy.fixture('test-avatar.png', 'base64').then((base64: string) => {
        const blob = Cypress.Blob.base64StringToBlob(base64, 'image/png');
        const file = new File([blob], 'test-avatar.png', { type: 'image/png' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        cy.get('[data-testid="image-file-input"]').then((input) => {
          const el = input[0] as HTMLInputElement;
          el.files = dataTransfer.files;
          cy.wrap(input).trigger('change', { force: true });
        });
      });

      cy.contains('test-avatar', { timeout: 15000 }).should('be.visible');
    });
  });

  describe('Delete flow with rule reference', () => {
    beforeEach(() => {
      signIn();

      uploadStorageFile(`users/${uid}/avatars/${IMAGE_ID_1}.png`);
      uploadStorageFile(`users/${uid}/avatars/${IMAGE_ID_2}.png`);

      writeFirestoreDoc(`users/${uid}/images/${IMAGE_ID_1}`, {
        id: fs(IMAGE_ID_1),
        filename: fs('deleteme.png'),
        displayName: fs('Delete Me'),
        storagePath: fs(`users/${uid}/avatars/${IMAGE_ID_1}.png`),
        contentType: fs('image/png'),
        bytes: fi(1024),
        width: fi(256),
        height: fi(256),
        tags: fa([]),
        createdAt: fts(),
        updatedAt: fts(),
      });

      writeFirestoreDoc(`users/${uid}/images/${IMAGE_ID_2}`, {
        id: fs(IMAGE_ID_2),
        filename: fs('keepme.png'),
        displayName: fs('Keep Me'),
        storagePath: fs(`users/${uid}/avatars/${IMAGE_ID_2}.png`),
        contentType: fs('image/png'),
        bytes: fi(2048),
        width: fi(512),
        height: fi(512),
        tags: fa([]),
        createdAt: fts(),
        updatedAt: fts(),
      });

      writeFirestoreDoc(`users/${uid}/rules/${RULE_ID}`, {
        id: fs(RULE_ID),
        name: fs('Test Rule'),
        enabled: fb(true),
        priority: fi(100),
        imageId: fs(IMAGE_ID_1),
        conditions: fa([]),
        createdAt: fts(),
        updatedAt: fts(),
      });
    });

    afterEach(() => {
      deleteFirestoreDoc(`users/${uid}/images/${IMAGE_ID_1}`);
      deleteFirestoreDoc(`users/${uid}/images/${IMAGE_ID_2}`);
      deleteFirestoreDoc(`users/${uid}/rules/${RULE_ID}`);
    });

    it('shows rule-reference warning dialog and deletes image with rules', () => {
      cy.visit('/images');

      cy.get(`[data-testid="image-card-${IMAGE_ID_1}"]`, { timeout: 10000 }).within(() => {
        cy.get('[data-testid="delete-image-btn"]').click();
      });

      cy.get('[data-testid="delete-image-dialog"]').should('be.visible');
      cy.get('[data-testid="referencing-rules-list"]').should('contain', 'Test Rule');

      cy.get('[data-testid="delete-with-rules-btn"]').click();

      cy.get(`[data-testid="image-card-${IMAGE_ID_1}"]`).should('not.exist');
    });

    it('reassigns rules to another image before deleting', () => {
      cy.visit('/images');

      cy.get(`[data-testid="image-card-${IMAGE_ID_1}"]`, { timeout: 10000 }).within(() => {
        cy.get('[data-testid="delete-image-btn"]').click();
      });

      cy.get('[data-testid="delete-image-dialog"]').should('be.visible');
      cy.get('[data-testid="reassign-image-select"]').select('Keep Me');
      cy.get('[data-testid="reassign-and-delete-btn"]').click();

      cy.get(`[data-testid="image-card-${IMAGE_ID_1}"]`).should('not.exist');
      cy.get(`[data-testid="image-card-${IMAGE_ID_2}"]`).should('be.visible');
    });
  });
});
