import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { ShieldCheck, Sparkles } from 'lucide-react';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => { e.preventDefault(); setError(''); if (password !== confirmPassword) return setError('Passwords do not match'); setLoading(true); try { await signup(email, password, name); } catch (err) { setError(err.message || 'Failed to create an account'); setLoading(false); } };
  React.useEffect(() => { if (userProfile) navigate('/community'); }, [userProfile, navigate]);

  return (
    <div className="min-h-screen bg-civic-off">
      <Navbar />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-[2rem] border border-civic-border bg-white shadow-civic lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-gradient-to-br from-civic-navy via-civic-blue to-civic-sky p-8 text-white sm:p-10">
            <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 p-3"><ShieldCheck size={22} /></div><div><p className="text-lg font-black">CivicAI</p><p className="text-sm text-slate-300">Trusted civic reporting for modern India</p></div></div>
            <div className="mt-10 max-w-md"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold"><Sparkles size={16} /> Your city, your voice</div><h2 className="mt-5 font-display text-3xl font-extrabold">Create your civic account.</h2><p className="mt-4 text-sm leading-7 text-slate-200">Build trust with every report, from first upload to verified resolution.</p></div>
          </div>
          <div className="p-8 sm:p-10">
            <h3 className="font-display text-2xl font-extrabold text-civic-navy">Create an account</h3>
            <p className="mt-2 text-sm text-slate-600">Join the civic network in minutes.</p>
            {error && <div className="mt-5 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Full name</label><input type="text" required className="civic-input px-4 py-3" placeholder="Asha Rao" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label><input type="email" required className="civic-input px-4 py-3" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Password</label><input type="password" required className="civic-input px-4 py-3" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700">Confirm password</label><input type="password" required className="civic-input px-4 py-3" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
              <button type="submit" disabled={loading} className="civic-button w-full rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-70">{loading ? 'Creating account...' : 'Create account'}</button>
            </form>
            <div className="mt-6 text-sm text-slate-600">Already have an account? <Link to="/login" className="font-semibold text-civic-blue">Log in</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}
