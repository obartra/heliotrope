import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp } from '../lib/auth';

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong. Try again.';
  const msg = error.message;

  if (msg.includes('not allowed to sign up')) {
    return 'This email is not allowed to sign up.';
  }
  if (
    msg.includes('auth/invalid-credential') ||
    msg.includes('auth/wrong-password') ||
    msg.includes('auth/user-not-found')
  ) {
    return 'Invalid email or password.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters.';
  }

  return 'Something went wrong. Try again.';
}

export function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      void navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h1>{mode === 'signin' ? 'Sign in' : 'Sign up'}</h1>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: 4 }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 4 }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>
        {error && (
          <p role="alert" style={{ color: 'crimson', margin: '0 0 12px' }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        {mode === 'signin' ? (
          <>
            No account?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'royalblue',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'royalblue',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
