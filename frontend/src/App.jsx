import React from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import FormsList from './pages/FormsList.jsx';
import FormBuilder from './pages/FormBuilder.jsx';
import Results from './pages/Results.jsx';
import Collaborators from './pages/Collaborators.jsx';
import PublicFill from './pages/PublicFill.jsx';
import Home from './pages/Home.jsx';
import { useAuth } from './store';

function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token, isGuest, logout, setGuest } = useAuth();
  const nav = useNavigate();

  const onGuest = () => {
    setGuest(true);
    nav('/forms');
  };

  return (
    <div>
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <Link to="/" className="font-semibold">Forms</Link>
        <div className="flex items-center gap-2">
          {token ? (
            <>
              <Link className="btn" to="/forms">My Forms</Link>
              <button className="btn" onClick={() => { logout(); nav('/'); }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="btn" to="/login">Login</Link>
              <Link className="btn" to="/register">Register</Link>
              {!isGuest && <button className="btn" onClick={onGuest}>Continue as Guest</button>}
            </>
          )}
        </div>
      </div>

      <div>
        <Routes>
          {/* Početna sa tri dugmeta */}
          <Route path="/" element={<Home />} />

          {/* Javno popunjavanje */}
          <Route path="/p/:id" element={<PublicFill />} />

          {/* Lista formi (gost vidi, ali ne može da kreira) */}
          <Route path="/forms" element={<FormsList />} />

          {/* Auth rute */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rute koje zahtevaju login */}
          <Route
            path="/forms/new"
            element={
              <RequireAuth>
                <FormBuilder />
              </RequireAuth>
            }
          />
          <Route
            path="/forms/:id/edit"
            element={
              <RequireAuth>
                <FormBuilder />
              </RequireAuth>
            }
          />
          <Route
            path="/forms/:id/results"
            element={
              <RequireAuth>
                <Results />
              </RequireAuth>
            }
          />
          <Route
            path="/forms/:id/collaborators"
            element={
              <RequireAuth>
                <Collaborators />
              </RequireAuth>
            }
          />
        </Routes>
      </div>
    </div>
  );
}
