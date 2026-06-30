import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAIL || import.meta.env.ADMIN_EMAIL || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  const isAdminEmail = (email) => {
    if (!email || adminEmails.length === 0) return false;
    return adminEmails.includes(email.trim().toLowerCase());
  };

  async function signup(email, password, name) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) throw authError;

    if (authData.user) {
      const role = isAdminEmail(email) ? 'admin' : 'citizen';
      
      const { error: profileError } = await supabase.from('profiles').insert([
        { id: authData.user.id, email, name, role }
      ]);
      if (profileError) throw profileError;
    }
    return authData;
  }

  function login(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  function logout() {
    return supabase.auth.signOut();
  }

  const [userProfile, setUserProfile] = useState(null);

  const fetchProfile = async (user) => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!error && data) {
      const resolvedRole = isAdminEmail(user.email) ? 'admin' : data.role;

      if (resolvedRole !== data.role) {
        await supabase.from('profiles').update({ role: resolvedRole }).eq('id', user.id);
      }

      setUserProfile({ ...data, role: resolvedRole });
    } else {
      const fallbackRole = isAdminEmail(user.email) ? 'admin' : 'citizen';

      const { data: insertedProfile } = await supabase.from('profiles').upsert([
        { id: user.id, email: user.email, name: user.user_metadata?.name || user.email, role: fallbackRole }
      ]).select().single();

      setUserProfile(insertedProfile || null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user || null;
      setCurrentUser(user);
      fetchProfile(user).then(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setCurrentUser(user);
      fetchProfile(user).then(() => setLoading(false));
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
