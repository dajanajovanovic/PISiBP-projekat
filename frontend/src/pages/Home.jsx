import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store';
import { api } from '../api';

export default function Home() {
  const nav = useNavigate();
  const { token, setGuest } = useAuth();

  const asGuest = () => {
    setGuest(true);
    nav('/forms');
  };

  const onCreate = async () => {
    if (!token) return; // safety
    try {
      const f = await api.createForm(token, { name: 'Untitled form' });
      if (!f?.id) {
        alert('Form created but no id returned from API.');
        return;
      }
      nav(`/forms/${f.id}/edit`);
    } catch (e) {
      console.error(e);
      alert(`Cannot create form: ${e.message}`);
    }
  };

  if (token) {
    // Ulogovan korisnik – nema "guest" dugmeta i nema /forms/new linka
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Forms — Dashboard</h1>
        <p className="mb-4 text-sm opacity-80">
          Već si ulogovan. Idi na listu svojih formi ili kreiraj novu.
        </p>
        <div className="flex gap-3">
          <Link className="btn" to="/forms">My Forms</Link>
          <button className="btn" onClick={onCreate}>New Form</button>
        </div>
      </div>
    );
  }

  // Nije ulogovan – prikaži login/register/guest
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-3">
        Ovo je stranica za kreiranje formi, anketa i prijava.
      </h1>
      <p className="mb-6 text-sm opacity-80">
        Napravi nalog ili se uloguj da kreneš — ili nastavi kao gost da bi
        popunjavao formе koje su javno dozvoljene.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link className="btn" to="/login">Login</Link>
        <Link className="btn" to="/register">Register</Link>
        <button className="btn" onClick={asGuest}>Continue as Guest</button>
      </div>
    </div>
  );
}
