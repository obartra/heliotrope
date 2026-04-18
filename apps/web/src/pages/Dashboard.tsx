import { signOut } from '../lib/auth';

export function Dashboard() {
  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <h1>Dashboard</h1>
      <p>Welcome to Heliotrope.</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
