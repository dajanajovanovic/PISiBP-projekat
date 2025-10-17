import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';

function QuestionFill({ q, value, onChange }) {
  if (q.type === 'short_text') {
    return (
      <input
        className="input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your answer"
        maxLength={512}
      />
    );
  }

  if (q.type === 'long_text') {
    return (
      <textarea
        className="input"
        rows={4}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your answer"
        maxLength={4096}
      />
    );
  }

  if (q.type === 'single_choice') {
    // PODRŽI I choices i options
    const opts = q.options_json?.choices || q.options_json?.options || [];
    return (
      <div className="grid gap-2">
        {opts.map((o, idx) => (
          <label key={idx} className="flex gap-2 items-center">
            <input
              type="radio"
              name={`q_${q.id}`}
              checked={value === o}
              onChange={() => onChange(o)}
            />
            <span>{String(o)}</span>
          </label>
        ))}
      </div>
    );
  }

  if (q.type === 'multi_choice') {
    const opts = q.options_json?.choices || q.options_json?.options || [];
    const cur = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-2">
        {opts.map((o, idx) => {
          const checked = cur.includes(o);
          return (
            <label key={idx} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...cur, o]
                    : cur.filter((x) => x !== o);
                  onChange(next);
                }}
              />
              <span>{String(o)}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (q.type === 'numeric') {
    const list = q.options_json?.list || null;
    const range = q.options_json?.range || null;
    if (list) {
      return (
        <select
          className="input"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          <option value="" disabled>
            Choose…
          </option>
          {list.map((n, i) => (
            <option key={i} value={n}>
              {n}
            </option>
          ))}
        </select>
      );
    }
    if (range) {
      const { start = 0, end = 10, step = 1 } = range;
      const arr = [];
      for (let x = start; x <= end; x += step) arr.push(x);
      return (
        <select
          className="input"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          <option value="" disabled>
            Choose…
          </option>
          {arr.map((n, i) => (
            <option key={i} value={n}>
              {n}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className="input"
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }

  if (q.type === 'date') {
    return (
      <input
        className="input"
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (q.type === 'time') {
    return (
      <input
        className="input"
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return <div className="text-xs text-gray-500">Unsupported type</div>;
}

export default function PublicFill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
  let act = true;
  (async () => {
    setLoading(true);
    try {
      if (token) {
        // ulogovan → normalan /forms/{id}
        const f = await api.getForm(token, id);
        if (act) setForm(f);
      } else {
        // gost → public meta /forms/{id}/meta
        const meta = await api.getFormMetaPublic(id);
        if (act) {
          setForm({
            id: meta.id,
            name: meta.name || `Form #${meta.id}`,
            description: meta.description || '',
            allow_anonymous: !!meta.allow_anonymous,
            is_locked: !!meta.is_locked,
            questions: meta.questions || [],
          });
        }
      }
    } catch (e1) {
      // fallback: ako privatan poziv padne (401/403), probaj public meta
      try {
        const meta = await api.getFormMetaPublic(id);
        if (act) {
          setForm({
            id: meta.id,
            name: meta.name || `Form #${meta.id}`,
            description: meta.description || '',
            allow_anonymous: !!meta.allow_anonymous,
            is_locked: !!meta.is_locked,
            questions: meta.questions || [],
          });
        }
      } catch (e2) {
        if (act) setForm(null);
      }
    } finally {
      if (act) setLoading(false);
    }
  })();
  return () => { act = false; };
}, [id, token]);

  const setAnswer = (qid, val) =>
    setAnswers((prev) => ({ ...prev, [qid]: val }));

  const validateRequired = () => {
    if (!form?.questions) return true;
    for (const q of form.questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      if (
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim() === '') ||
        (Array.isArray(v) && v.length === 0)
      ) {
        alert(`Question "${q.text}" is required.`);
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    if (!form) return;

    // BLOK: ne dozvoli anonimni submit kada je zabranjen
    if (!form.allow_anonymous && !token) {
      alert(
        'Ova forma ne prima anonimne odgovore. Uloguj se da bi poslao/la odgovor.'
      );
      navigate('/login');
      return;
    }

    // BLOK: ne dozvoli slanje ako je forma zaključana
    if (form.is_locked) {
      alert('Forma je zaključana i ne može se popunjavati.');
      return;
    }

    if (!validateRequired()) return;

    const payload = {
      form_id: form.id,
      answers: Object.entries(answers).map(([question_id, value]) => ({
        question_id: Number(question_id),
        value,
      })),
    };

    setSubmitting(true);
    try {
      await api.submit(payload, token || null); // prosledi token ako postoji
      alert('Submitted!');
      // ako Results ruta traži token, ovo je ok; u suprotnom vrati na /
      navigate(`/forms/${form.id}/results`);
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!form) return <div className="p-6 text-red-600">Form not found or not accessible.</div>;

  const anonBlocked = !form.allow_anonymous && !token;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{form.name}</h1>
          <div className="text-sm text-gray-600">{form.description}</div>
          <div className="text-xs text-gray-500">
            Anonymous responses: <b>{form.allow_anonymous ? 'ENABLED' : 'DISABLED'}</b>
            {' · '}Locked: <b>{form.is_locked ? 'YES' : 'NO'}</b>
          </div>
        </div>
        <Link className="btn" to={`/forms/${form.id}/results`}>See results</Link>
      </div>

      {form.is_locked && (
        <div className="rounded-xl border p-3 bg-red-50 text-sm text-red-700">
          Forma je zaključana i trenutno se ne može popunjavati.
        </div>
      )}

      {anonBlocked && (
        <div className="rounded-xl border p-3 bg-amber-50 text-sm text-amber-800">
          Ova forma <b>ne prima anonimne odgovore</b>. Uloguj se da bi poslao/la odgovor.
        </div>
      )}

      {!form.is_locked && (
        <div className="grid gap-4">
          {form.questions?.map((q) => (
            <div key={q.id} className="border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {q.text} {q.required ? <span className="text-red-600">*</span> : null}
                </div>
                {q.image_url ? (
                  <img alt="" src={q.image_url} className="max-h-24 rounded-lg" />
                ) : null}
              </div>
              <QuestionFill
                q={q}
                value={answers[q.id]}
                onChange={(val) => setAnswer(q.id, val)}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button className="btn" onClick={submit} disabled={submitting || anonBlocked}>
              Submit
            </button>
            <Link className="btn" to="/">Cancel</Link>
          </div>
        </div>
      )}
    </div>
  );
}
