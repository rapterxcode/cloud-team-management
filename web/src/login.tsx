import { useState } from 'react';
import { Cloud } from 'lucide-react';
import { api, post } from '@/lib/api';
import type { Me } from '@/lib/types';

export default function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await post('/auth/login', { email: data.get('email'), password: data.get('password') });
      onLogin(await api<Me>('/auth/me'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card create-form" onSubmit={submit}>
        <div className="brand"><span className="brand-icon"><Cloud size={25} /></span> cloudteam<span className="brand-dot">.</span></div>
        <h1>Sign in</h1>
        <label>Email<input name="email" type="email" required autoComplete="username" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
