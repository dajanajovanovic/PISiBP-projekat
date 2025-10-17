import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';

export default function FormsList() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [forms, setForms] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const canCreate = !!token; // samo ulogovani mogu da kreiraju

  const load = async (query = '') => {
    setLoading(true);
    try {
      if (token) {
        const data = await api.listForms(token, query); // samo sa tokenom
        setForms(Array.isArray(data) ? data : []);
      } else {
        // gost: ne zovi endpoint koji traži token
        setForms([]);
      }
    } catch (e) {
      console.error(e);
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onCreate = async () => {
    if (!canCreate) return;
    try {
      // VAŽNO: token je PRVI argument, payload je DRUGI
      const f = await api.createForm(token, { name: 'Untitled form' });
      if (!f?.id) {
        alert('Form created but no id returned from API.');
        return;
      }
      navigate(`/forms/${f.id}/edit`);
    } catch (e) {
      console.error(e);
      alert(`Cannot create form: ${e.message}`);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Forms</h1>
        {canCreate ? (
          <button className="btn" onClick={onCreate}>New Form</button>
        ) : (
          <div className="text-sm opacity-70">
            You are browsing as <span className="font-semibold">Guest</span>. Creating forms is disabled.
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" onClick={() => load(q)}>Search</button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : forms.length === 0 ? (
        <div className="opacity-70 text-sm">No forms found.</div>
      ) : (
        <div className="grid gap-3">
          {forms.map((f) => (
            <div key={f.id} className="p-3 border rounded-xl flex items-center justify-between">
              <div>
                <div className="font-medium">{f.name || `Form #${f.id}`}</div>
                <div className="text-xs opacity-70">
                  {f.is_public ? 'Public' : 'Private'}
                </div>
              </div>

              <div className="flex gap-2">
                {/* Public link (za javno popunjavanje) */}
                <Link className="btn" to={`/p/${f.id}`}>Public link</Link>

                {/* Edit/Results/Collaborators samo za ulogovanog */}
                {token && (
                  <>
                    <Link className="btn" to={`/forms/${f.id}/edit`}>Edit</Link>
                    <Link className="btn" to={`/forms/${f.id}/results`}>Results</Link>
                    <Link className="btn" to={`/forms/${f.id}/collaborators`}>Collaborators</Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
