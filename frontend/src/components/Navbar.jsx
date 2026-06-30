import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LayoutDashboard, LogOut, Award, User } from 'lucide-react';

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `nav-link text-sm font-semibold tracking-[0.16em] uppercase ${isActive(path) ? 'active text-civic-blue' : 'text-slate-600 hover:text-civic-blue'}`;

  return (
    <nav className={`sticky top-0 z-40 border-b border-civic-border/10 bg-white transition-all ${scrolled ? 'shadow-[0_8px_24px_rgba(10,22,40,0.08)] border-civic-border/50' : 'shadow-none'}`}>
      <div className="mx-auto max-w-7xl pl-0 pr-5 sm:pr-8 lg:pr-10">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-civic-blue to-civic-sky text-white shadow-[0_10px_24px_rgba(27,79,216,0.18)]">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M12 2.5C7.3 2.5 4.5 6.2 4.5 10.5c0 4.2 2.8 7.2 7.5 12 4.7-4.8 7.5-7.8 7.5-12 0-4.3-2.8-8-7.5-8z" fill="currentColor" />
                <circle cx="12" cy="9.5" r="2.5" fill="#0A1628" />
                <path d="M7 9.5A5 5 0 0 0 17 9.5" stroke="#3B9EFF" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M4 9.5A8 8 0 0 0 20 9.5" stroke="#3B9EFF" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-[0.02em] text-civic-navy">CivicAI</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Beta</span>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400/70">Civic trust, reimagined</span>
            </div>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link to="/community" className={linkClass('/community')}>Community</Link>
            <Link to="/report" className={linkClass('/report')}>Report Issue</Link>
            <Link to="/track" className={linkClass('/track')}>Track</Link>
            {userProfile?.role === 'admin' && (
              <Link to="/admin" className={`${linkClass('/admin')} flex items-center gap-1`}>
                <LayoutDashboard size={14} /> Admin
              </Link>
            )}
            {currentUser ? (
              <div className="flex items-center gap-3">
                <Link to="/profile" className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100">
                  <Award size={14} />
                  {userProfile?.civic_points || 0}
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-civic-blue">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="rounded-full border border-civic-border px-4 py-2 text-sm font-semibold text-civic-navy transition hover:border-civic-blue hover:text-civic-blue">Login</Link>
            )}
            <Link to="/report" className="civic-button rounded-full px-5 py-2.5 text-sm font-semibold">Get Started</Link>
          </div>

          <button
            className="rounded-2xl border border-civic-border bg-white p-2 text-civic-navy transition hover:border-civic-blue hover:text-civic-blue md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <div className={`overflow-hidden border-t border-civic-border/70 bg-white md:hidden ${mobileOpen ? 'max-h-[32rem]' : 'max-h-0'}`}>
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="grid gap-2">
            <Link to="/community" onClick={() => setMobileOpen(false)} className="rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-civic-off hover:text-civic-blue">Community</Link>
            <Link to="/report" onClick={() => setMobileOpen(false)} className="rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-civic-off hover:text-civic-blue">Report Issue</Link>
            <Link to="/track" onClick={() => setMobileOpen(false)} className="rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-civic-off hover:text-civic-blue">Track</Link>
            {userProfile?.role === 'admin' && (
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-civic-off hover:text-civic-blue">Admin Dashboard</Link>
            )}
            {currentUser ? (
              <>
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100">
                  <Award size={14} /> Profile ({userProfile?.civic_points || 0} pts)
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-2 rounded-2xl bg-civic-navy px-3 py-3 text-left text-sm font-semibold text-white transition hover:bg-civic-blue">
                  <LogOut size={14} /> Logout
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)} className="rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-civic-off hover:text-civic-blue">Login</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
