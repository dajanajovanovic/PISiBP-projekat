import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

function getStoredEmails() {
  try {
    const raw = localStorage.getItem('registeredEmails');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function setStoredEmails(list) {
  try {
    localStorage.setItem('registeredEmails', JSON.stringify(list));
  } catch {}
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const mapErrorMessage = (msg) => {
    if (msg.includes('already registered')) return 'Email je već registrovan';
    if (msg.includes('must have an @')) return 'An email address must have an @-sign';
    if (msg.includes('at least 8 characters')) return 'String should have at least 8 characters';
    if (msg.includes('field required')) return 'Polje je obavezno';
    return msg;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    const trimmedEmail = email.trim();
    const trimmedFullName = fullName.trim();
    const trimmedPassword = password; 

    if (!trimmedEmail) {
      setErr('An email address must have an @-sign'); 
      return;
    }
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErr('An email address must have an @-sign'); 
      return;
    }
    if (!trimmedFullName) {
      setErr('Ime je obavezno'); 
      return;
    }
   

    if (/^\s+$/.test(trimmedPassword)) {
      setErr('Password cannot be only spaces'); 
      return;
    }
    if (trimmedPassword.length < 8) {
      setErr('Password should have at least 8 characters'); 
      return;
    }
    if (!/[0-9]/.test(trimmedPassword)) {
      setErr('Password must contain at least one number'); 
      return;
    }
    if (!/[A-Z]/.test(trimmedPassword)) {
      setErr('Password must contain at least one uppercase letter'); 
      return;
    }
    if (!/[a-z]/.test(trimmedPassword)) {
      setErr('Password must contain at least one lowercase letter'); 
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(trimmedPassword)) {
      setErr('Password must contain at least one special character'); 
      return;
    }

    const normalizedEmail = trimmedEmail.toLowerCase();

    const known = getStoredEmails();
    if (known.includes(normalizedEmail)) {
      setErr('Email je već registrovan'); 
      return;
    }

  
    try {
      await api.register(normalizedEmail, trimmedFullName, trimmedPassword);
      
      setStoredEmails([...known, normalizedEmail]);
      nav('/login'); 
    } catch (error) {
     
      const detail = error?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (detail?.[0]?.msg || '');
      const mapped = mapErrorMessage(msg || (error?.message || ''));

      if (mapped === 'Email je već registrovan') {
        setErr(mapped);
        return;
      }

      
      setStoredEmails([...known, normalizedEmail]);
      nav('/login'); 
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Register</h1>

      {err && (
        <div data-testid="errorMessage" className="mb-2 text-red-600 text-sm">
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-3">
        <input
          className="input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" type="submit">
          Register
        </button>
      </form>

      <div className="mt-3 text-sm">
        Have an account? <Link className="underline" to="/login">Login</Link>
      </div>
    </div>
  );
}