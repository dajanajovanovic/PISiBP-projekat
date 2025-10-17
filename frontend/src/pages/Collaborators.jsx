import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';

export default function Collaborators() {
  const { id } = useParams();
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.listCollabs(token, id);
      setItems(r);
    } catch (e) {
      alert(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const add = async () => {
    if (!email) return;
    try {
      await api.addCollab(token, id, email, role);
      setEmail('');
      setRole('viewer');
      load();
    } catch (e) {
      alert(e);
    }
  };

  const del = async (cid) => {
    if (!confirm('Remove collaborator?')) return;
    try {
      await api.delCollab(token, id, cid);
      load();
    } catch (e) {
      alert(e);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Collaborators</h1>
        <Link className="btn" to={`/forms/${id}/edit`}>Back</Link>
      </div>

      <div className="border rounded-xl p-4">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="user@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
          <select className="input w-40" value={role} onChange={e=>setRole(e.target.value)}>
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
          </select>
          <button className="btn" onClick={add}>Add</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        <div className="grid gap-2">
          {items.length === 0 ? <div className="text-sm text-gray-600">No collaborators.</div> : items.map(c => (
            <div key={c.id} className="border rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{c.email}</div>
                <div className="text-xs text-gray-600">{c.role}</div>
              </div>
              <button className="btn" onClick={() => del(c.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
