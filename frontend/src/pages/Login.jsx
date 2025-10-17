import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { setToken, setMe, setGuest } = useAuth();

  const mapErrorMessage = (status, detail, fallbackMsg) => {
  const raw =
    (typeof detail === 'string' ? detail : detail?.[0]?.msg) ||
    fallbackMsg ||
    '';

  const lower = String(raw).toLowerCase();

  // 401 / neispravni kredencijali (pokriva i "Invalid credentials")
  if (
    status === 401 ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid') ||
    lower.includes('unauthorized') ||
    lower.includes('credentials') ||
    lower.includes('wrong password') ||
    lower.includes('login failed')
  ) {
    return 'Invalid email or password — proverite da li su email i lozinka tačni.';
  }

  // 429 - previše pokušaja
  if (status === 429 || lower.includes('too many')) {
    return 'Too many login attempts — pokušajte ponovo za nekoliko minuta.';
  }

  // 400 - neispravan zahtev
  if (status === 400 || lower.includes('bad request')) {
    return 'Invalid request — proverite unete podatke i pokušajte ponovo.';
  }

  // 5xx - server error
  if ((typeof status === 'number' && status >= 500) || lower.includes('server')) {
    return 'Server error — prijava trenutno nije moguća, pokušajte kasnije.';
  }

  
  return raw || 'Login failed. Please try again.';
};


  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    const trimmedEmail = email.trim();
    const pwd = password;

    
    if (!trimmedEmail) {
      setErr('An email address must have an @-sign (Email field cannot be empty).');
      return;
    }

    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErr('An email address must have an @-sign (Invalid email format).');
      return;
    }

    if (!pwd) {
      setErr('Password is required — unesite lozinku.');
      return;
    }

    setLoading(true);
    try {
      const r = await api.login(trimmedEmail.toLowerCase(), pwd);

      const tok =
        r?.access_token || r?.token || r?.jwt ||
        (r?.data && (r.data.access_token || r.data.token || r.data.jwt)) || '';

      if (!tok) throw new Error('No token in login response');

      setToken(tok);
      setGuest(false);

      try {
        const me = await api.me(tok);
        setMe(me || null);
      } catch (_) {}

      // redirect na glavnu stranu posle uspeha
      nav('/projects');
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      const msg = mapErrorMessage(status, detail, e?.message);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>

      {err && (
        <div data-testid="errorMessage" className="mb-2 text-red-600 text-sm">
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-3">
        <input
          className="input"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>

      <div className="mt-3 text-sm">
        No account? <Link className="underline" to="/register">Register</Link>
      </div>
    </div>
  );
}
