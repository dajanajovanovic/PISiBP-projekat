// api.js
const AUTH = import.meta.env.VITE_AUTH_API || 'http://localhost:8001';
const FORMS = import.meta.env.VITE_FORMS_API || 'http://localhost:8002';
const RESP  = import.meta.env.VITE_RESPONSES_API || 'http://localhost:8003';
const AUTH_LOGIN_MODE = import.meta.env.VITE_AUTH_LOGIN_MODE || 'query'; // 'query' | 'json' | 'form'
const RESP_SUBMIT_PATH = import.meta.env.VITE_RESPONSES_SUBMIT_PATH || '/submit';



const asJson = async (r) => {
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(txt || ('HTTP ' + r.status));
  }
  return r.json();
};

const authH = (t) => (t ? { Authorization: 'Bearer ' + t } : {});

export const api = {
  // ---------------- Auth ----------------
  register: (email, full_name, password) =>
    fetch(`${AUTH}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name, password }),
    }).then(asJson),

  login: (email, password) => {
    const e = encodeURIComponent(email);
    const p = encodeURIComponent(password);

    if (AUTH_LOGIN_MODE === 'json') {
      return fetch(`${AUTH}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then(asJson);
    }

    if (AUTH_LOGIN_MODE === 'form') {
      return fetch(`${AUTH}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: email, password }),
      }).then(asJson);
    }

    // default: 'query'
    return fetch(`${AUTH}/login?email=${e}&password=${p}`, { method: 'POST' }).then(asJson);
  },

  me: (t) =>
    fetch(`${AUTH}/me`, { headers: { ...authH(t) } }).then(asJson),

  // --------------- Forms ----------------
  createForm: (t, payload) =>
    fetch(`${FORMS}/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(t) },
      body: JSON.stringify(payload),
    }).then(asJson),

  // Privatna lista (ulogovani) — podržava ?q= (pretraga po name)
  listForms: (t, q = '') =>
    fetch(`${FORMS}/forms${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      headers: { ...authH(t) },
    }).then(asJson),

  // Javna lista (gost) — podržava ?q= (pretraga po name), prikazuje samo ne-zaključane
  listPublicForms: (q = '') =>
    fetch(`${FORMS}/forms/public${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then(asJson),

  // Helper: univerzalna pretraga koja sama bira javni/privatni endpoint u zavisnosti od tokena
  searchForms: (t, q = '') =>
    t ? api.listForms(t, q) : api.listPublicForms(q),

  myForms: (t) =>
    fetch(`${FORMS}/my/forms`, { headers: { ...authH(t) } }).then(asJson),

  // Napomena: /forms/{id} traži auth; za gosta koristi getFormMetaPublic
  getForm: (t, id) =>
    fetch(`${FORMS}/forms/${id}`, { headers: { ...authH(t) } }).then(asJson),

  // Javni meta endpoint (bez auth), koristi se za prikaz/popunjavanje
  getFormMetaPublic: (id) =>
    fetch(`${FORMS}/forms/${id}/meta`).then(asJson),

  updateForm: (t, id, patch) =>
    fetch(`${FORMS}/forms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH(t) },
      body: JSON.stringify(patch),
    }).then(asJson),

  deleteForm: (t, id) =>
    fetch(`${FORMS}/forms/${id}`, {
      method: 'DELETE',
      headers: { ...authH(t) },
    }).then((r) => r.ok),

  // ------------- Questions --------------
  addQuestion: (t, formId, q) =>
    fetch(`${FORMS}/forms/${formId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(t) },
      body: JSON.stringify(q),
    }).then(asJson),

  updateQuestion: (t, formId, qid, q) =>
    fetch(`${FORMS}/forms/${formId}/questions/${qid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH(t) },
      body: JSON.stringify(q),
    }).then(asJson),

  deleteQuestion: (t, formId, qid) =>
    fetch(`${FORMS}/forms/${formId}/questions/${qid}`, {
      method: 'DELETE',
      headers: { ...authH(t) },
    }).then((r) => r.ok),

  cloneQuestion: (t, formId, qid) =>
    fetch(`${FORMS}/forms/${formId}/questions/${qid}/clone`, {
      method: 'POST',
      headers: { ...authH(t) },
    }).then(asJson),

  reorder: (t, formId, order) =>
    fetch(`${FORMS}/forms/${formId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH(t) },
      body: JSON.stringify(order),
    }).then(asJson),

 

// ------------- Responses --------------
submit: async (payload, token) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  };

  // Dozvoli i templatisan path, npr. "/forms/{id}/submit"
  let path = RESP_SUBMIT_PATH;
  if (path.includes('{id}')) path = path.replace('{id}', String(payload.form_id));
  if (path.includes(':id')) path = path.replace(':id', String(payload.form_id));

  const r = await fetch(`${RESP}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(txt || `HTTP ${r.status}`);
  }
  return r.json();
},


  // (Po potrebi dodaj token ako backend traži autorizaciju za list/aggregate/export)
  listResponses: (id, t) =>
    fetch(`${RESP}/forms/${id}/responses`, {
      headers: { ...(t ? authH(t) : {}) },
    }).then(asJson),

  aggregate: (id, t) =>
    fetch(`${RESP}/forms/${id}/aggregate`, {
      headers: { ...(t ? authH(t) : {}) },
    }).then(asJson),

  exportXlsx: (id) => `${RESP}/forms/${id}/export`,
};
