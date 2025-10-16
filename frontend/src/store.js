import { create } from 'zustand'

export const useAuth = create((set, get) => ({
  token: localStorage.getItem('token') || '',
  me: null,
  isGuest: localStorage.getItem('guest') === '1',

  setToken: (t) => {
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
  localStorage.removeItem('guest');       // <<< gasi guest
  set({ token: t || '', isGuest: false });
},

setGuest: (v) => {
  if (v) localStorage.setItem('guest', '1');
  else localStorage.removeItem('guest');
  if (v) localStorage.removeItem('token'); // gost nema token
  set({ isGuest: !!v, token: v ? '' : localStorage.getItem('token') || '' });
},


  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('guest');
    set({ token: '', me: null, isGuest: false });
  },
}));
