import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store";

const EMPTY_Q = {
  text: "",
  type: "short_text",
  required: false,
  order_index: null,
  image_url: "",
  options_json: null,
};

const typeOptions = [
  { value: "short_text", label: "Short text (≤512)" },
  { value: "long_text",  label: "Long text (≤4096)" },
  { value: "single_choice", label: "Single choice" },
  { value: "multi_choice",  label: "Multiple choice" },
  { value: "numeric", label: "Numeric (list/range)" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
];

export default function FormBuilder() {
  const { id:idParam } = useParams();
  const formId = Number(idParam);
  const navigate = useNavigate();
  const { token } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newQ, setNewQ] = useState(EMPTY_Q);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!formId || Number.isNaN(formId)) {
      setLoading(false);
      alert("Invalid form id in URL.");
      return;
    }
    let active = true;
    (async () => {
      try {
        const f = await api.getForm(token, formId);
        if (active) {
          f.questions = [...(f.questions||[])].sort((a,b)=> (a.order_index??0) - (b.order_index??0));
          setForm(f);
        }
      } catch (e) {
        alert("Cannot load form: " + e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => (active = false);
  }, [formId, token]);

  const filteredQuestions = useMemo(() => {
    if (!form?.questions) return [];
    if (!search) return form.questions;
    const q = search.toLowerCase();
    return form.questions.filter(x => (x.text||"").toLowerCase().includes(q));
  }, [form, search]);

  const handleFormToggle = async (patch) => {
    if (!form) return;
    setSaving(true);
    try {
      // api.updateForm je sada PUT (u api.js si već promenila)
      const updated = await api.updateForm(token, form.id, patch);
      updated.questions = [...(updated.questions||[])].sort((a,b)=> (a.order_index??0) - (b.order_index??0));
      setForm(updated);
    } catch (e) {
      alert(e);
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = async () => {
    if (form?.is_locked) return alert("Form is locked");
    if (!newQ.text.trim()) return alert("Question text is required");
    setSaving(true);
    try {
      const payload = buildOptionsForType(newQ);
      const created = await api.addQuestion(token, form.id, payload);
      setForm(prev => ({
        ...prev,
        questions: [...prev.questions, created].sort((a,b)=> (a.order_index??0) - (b.order_index??0))
      }));
      setNewQ(EMPTY_Q);
    } catch (e) {
      alert(e);
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = async (qid, patch) => {
    if (form?.is_locked) return;
    setSaving(true);
    try {
      const current = form.questions.find(q => q.id === qid);
      const merged = normalizeForUpdate(current, patch);
      const upd = await api.updateQuestion(token, form.id, qid, merged);
      setForm(prev => ({
        ...prev,
        questions: prev.questions.map(q => q.id===qid ? upd : q).sort((a,b)=> (a.order_index??0) - (b.order_index??0))
      }));
    } catch (e) {
      alert(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (qid) => {
    if (form?.is_locked) return;
    if (!confirm("Delete this question?")) return;
    setSaving(true);
    try {
      const ok = await api.deleteQuestion(token, form.id, qid);
      if (ok) setForm(prev => ({...prev, questions: prev.questions.filter(q=>q.id!==qid)}));
    } catch (e) {
      alert(e);
    } finally {
      setSaving(false);
    }
  };

  const cloneQuestion = async (qid) => {
    if (form?.is_locked) return;
    setSaving(true);
    try {
      const c = await api.cloneQuestion(token, form.id, qid);
      setForm(prev => ({
        ...prev,
        questions: [...prev.questions, c].sort((a,b)=> (a.order_index??0) - (b.order_index??0))
      }));
    } catch (e) {
      alert(e);
    } finally {
      setSaving(false);
    }
  };

  const move = (qid, dir) => {
    if (form?.is_locked) return;
    const qs = [...form.questions];
    const idx = qs.findIndex(q => q.id === qid);
    if (idx < 0) return;
    const swapWith = dir === "up" ? idx-1 : idx+1;
    if (swapWith < 0 || swapWith >= qs.length) return;
    [qs[idx], qs[swapWith]] = [qs[swapWith], qs[idx]];
    qs.forEach((q,i)=> q.order_index = i);
    setForm(prev => ({...prev, questions: qs}));
  };

  const saveOrder = async () => {
    if (form?.is_locked) return;
    setSaving(true);
    try {
      const order = form.questions.map(q=>q.id);
      const updated = await api.reorder(token, form.id, order);
      updated.questions = [...(updated.questions||[])].sort((a,b)=> (a.order_index??0) - (b.order_index??0));
      setForm(updated);
      alert("Order saved");
    } catch (e) {
      alert(e);
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = () => {
    const url = `${location.origin}/p/${form.id}`;
    navigator.clipboard.writeText(url);
    alert("Link copied: " + url);
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!formId) return <div className="p-6 text-red-600">Form not found</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{form.name}</h1>
          <p className="text-sm text-gray-600">{form.description}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => handleFormToggle({ allow_anonymous: !form.allow_anonymous })} disabled={saving}>
            {form.allow_anonymous ? "Disable anonymous" : "Allow anonymous"}
          </button>
          <button className="btn" onClick={() => handleFormToggle({ is_locked: !form.is_locked })} disabled={saving}>
            {form.is_locked ? "Unlock" : "Lock"}
          </button>
          <button className="btn" onClick={copyShareLink}>Share link</button>
          <button className="btn" onClick={()=>navigate(`/forms/${form.id}/results`)}>Results</button>
          <button className="btn" onClick={()=>navigate(`/forms/${form.id}/collaborators`)}>Collaborators</button>
        </div>
      </div>

      {form.is_locked && (
        <div className="text-sm rounded-xl border p-3 bg-gray-50">
          This form is <b>locked</b>. Editing questions is disabled.
        </div>
      )}

      <div className="flex items-center gap-2">
        <input className="input w-80" placeholder="Search questions..." value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="btn" onClick={saveOrder} disabled={saving || form?.is_locked}>Save order</button>
      </div>

      <div className="grid gap-3">
        {filteredQuestions.map((q, i) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={i}
            locked={!!form?.is_locked}
            onMoveUp={()=>move(q.id,"up")}
            onMoveDown={()=>move(q.id,"down")}
            onClone={()=>cloneQuestion(q.id)}
            onDelete={()=>deleteQuestion(q.id)}
            onChange={(patch)=>updateQuestion(q.id, patch)}
          />
        ))}
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Add question</h2>
        <QuestionEditor q={newQ} onChange={setNewQ} />
        <button className="btn" onClick={addQuestion} disabled={saving || form?.is_locked}>Add</button>
      </div>
    </div>
  );
}

function QuestionCard({ q, index, locked, onMoveUp, onMoveDown, onClone, onDelete, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(q);

  useEffect(() => { setDraft(q); }, [q.id]);

  const save = () => {
    if (locked) return;
    onChange(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(q);
    setEditing(false);
  };

  return (
    <div className="border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          #{index + 1} • {q.type} {q.required ? "• required" : ""}
        </div>
        <div className="flex gap-2">
          <button className="btn" disabled={locked} onClick={locked ? undefined : onMoveUp}>↑</button>
          <button className="btn" disabled={locked} onClick={locked ? undefined : onMoveDown}>↓</button>
          <button className="btn" disabled={locked} onClick={locked ? undefined : () => setEditing(v => !v)}>
            {editing ? "Close" : "Edit"}
          </button>
          <button className="btn" disabled={locked} onClick={locked ? undefined : onClone}>Clone</button>
          <button className="btn btn-danger" disabled={locked} onClick={locked ? undefined : onDelete}>Delete</button>
        </div>
      </div>

      {!editing ? (
        <div className="mt-2">
          <div className="font-medium">{q.text}</div>
          {q.image_url ? (
            <img
              src={q.image_url}
              alt=""
              className="mt-2 max-h-40 rounded-lg"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : null}
          {q.type === "single_choice" && <ChoicesPreview q={q} />}
          {q.type === "multi_choice" && <ChoicesPreview q={q} />}
          {q.type === "numeric" && <NumericPreview q={q} />}
        </div>
      ) : (
        <div className="mt-3">
          <QuestionEditor q={draft} onChange={setDraft} />
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={save} disabled={locked}>Save</button>
            <button className="btn" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ q, onChange }) {
  const set = (patch) => onChange({ ...q, ...patch });

  return (
    <div className="grid gap-3">
      <input className="input" placeholder="Question text" value={q.text} onChange={e=>set({text:e.target.value})} />
      <div className="flex gap-3 items-center">
        <select className="input" value={q.type} onChange={e=>set({type:e.target.value, options_json:null})}>
          {typeOptions.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={q.required} onChange={e=>set({required:e.target.checked})}/>
          <span>Required</span>
        </label>
      </div>
      <input className="input" placeholder="Image URL (optional)" value={q.image_url || ""} onChange={e=>set({image_url:e.target.value})} />
      <TypeSpecificOptions q={q} onChange={set} />
    </div>
  );
}

function TypeSpecificOptions({ q, onChange }) {
  // CHOICES
  if (q.type === "single_choice" || q.type === "multi_choice") {
    const initial = (q.options_json?.choices) || [];
    const [editorText, setEditorText] = useState(initial.join("\n"));

    useEffect(() => {
      setEditorText((q.options_json?.choices || []).join("\n"));
    }, [q.id]);

    const required_count =
      q.type === "multi_choice" ? (q.options_json?.required_count ?? "") : "";

    const updateChoices = (text) => {
      setEditorText(text);
      const arr = text
        .split(/(?:\r?\n|,)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      onChange({
        options_json: {
          ...(q.options_json || {}),
          choices: arr,
          ...(q.type === "multi_choice" && required_count !== ""
            ? { required_count: Number(required_count) }
            : {}),
        },
      });
    };

    return (
      <div className="grid gap-2">
        <label className="text-sm text-gray-600">
          Choices (jedna po redu ili razdvojene zarezom)
        </label>
        <textarea
          className="input min-h-28"
          value={editorText}
          onChange={(e) => updateChoices(e.target.value)}
          placeholder={"Opcija 1\nOpcija 2\nOpcija 3\n...  (može i: Opcija 1, Opcija 2, ...)"}
        />
        {q.type === "multi_choice" && (
          <input
            className="input w-48"
            type="number"
            min={0}
            placeholder="required_count (opciono)"
            value={required_count}
            onChange={(e) => {
              const v = e.target.value;
              const rc = v === "" ? undefined : Number(v);
              onChange({
                options_json: {
                  ...(q.options_json || {}),
                  choices: (q.options_json?.choices || []),
                  ...(rc !== undefined ? { required_count: rc } : {}),
                },
              });
            }}
          />
        )}
      </div>
    );
  }

  // NUMERIC
  if (q.type === "numeric") {
    const startMode = q.options_json?.list ? "list" : (q.options_json?.range ? "range" : "list");
    const [mode, setMode] = useState(startMode);
    const [numText, setNumText] = useState((q.options_json?.list || []).join(", "));

    useEffect(() => {
      const m = q.options_json?.list ? "list" : (q.options_json?.range ? "range" : "list");
      setMode(m);
      setNumText((q.options_json?.list || []).join(", "));
    }, [q.id]);

    const commitList = (text) => {
      setNumText(text);
      const arr = text
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map(Number)
        .filter((n) => Number.isFinite(n));

      onChange({ options_json: { list: arr } });
    };

    const r = q.options_json?.range || { start: 0, end: 10, step: 1 };

    return (
      <div className="grid gap-2">
        <div className="flex gap-2 items-center">
          <span className="text-sm">Numeric mode:</span>
          <select
            className="input w-40"
            value={mode}
            onChange={(e) => {
              const m = e.target.value;
              setMode(m);
              if (m === "list") {
                setNumText((q.options_json?.list || []).join(", "));
                onChange({ options_json: { list: q.options_json?.list || [] } });
              } else {
                onChange({ options_json: { range: r } });
              }
            }}
          >
            <option value="list">List</option>
            <option value="range">Range</option>
          </select>
        </div>

        {mode === "list" ? (
          <textarea
            className="input"
            rows={3}
            placeholder="Brojevi razdvojeni zarezom, npr: 1, 2, 3"
            value={numText}
            onChange={(e) => commitList(e.target.value)}
          />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <input
              className="input"
              type="number"
              placeholder="start"
              value={r.start}
              onChange={(e) =>
                onChange({ options_json: { range: { ...r, start: Number(e.target.value) } } })
              }
            />
            <input
              className="input"
              type="number"
              placeholder="end"
              value={r.end}
              onChange={(e) =>
                onChange({ options_json: { range: { ...r, end: Number(e.target.value) } } })
              }
            />
            <input
              className="input"
              type="number"
              placeholder="step"
              value={r.step}
              onChange={(e) =>
                onChange({ options_json: { range: { ...r, step: Number(e.target.value) } } })
              }
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}

function ChoicesPreview({ q }) {
  const choices = (q.options_json?.choices)||[];
  return <div className="text-sm text-gray-700 mt-2">Choices: {choices.join(" | ")}</div>;
}

function NumericPreview({ q }) {
  const oj = q.options_json || {};
  return <div className="text-sm text-gray-700 mt-2">Numeric: {oj.list ? `list [${oj.list.join(", ")}]` : oj.range ? `range ${oj.range.start}..${oj.range.end} step ${oj.range.step}` : "—"}</div>;
}

function buildOptionsForType(q) {
  const base = {
    text: q.text,
    type: q.type,
    required: !!q.required,
    order_index: q.order_index ?? null,
    image_url: q.image_url || null,
    options_json: null
  };
  if (q.type === "single_choice" || q.type === "multi_choice") {
    const choices = q.options_json?.choices || [];
    const required_count = q.type === "multi_choice" ? (q.options_json?.required_count) : undefined;
    base.options_json = { choices: choices };
    if (required_count !== undefined && required_count !== null && required_count !== "")
      base.options_json.required_count = Number(required_count);
  }
  if (q.type === "numeric") {
    if (q.options_json?.list) base.options_json = { list: q.options_json.list.map(Number) };
    else if (q.options_json?.range) base.options_json = { range: { ...q.options_json.range } };
  }
  return base;
}

function normalizeForUpdate(cur, patch) {
  const merged = { ...cur, ...patch };
  return buildOptionsForType(merged);
}
