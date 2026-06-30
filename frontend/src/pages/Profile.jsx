import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import {
  Award,
  Trophy,
  FileText,
  CheckCircle,
  Loader2,
  Star,
  TrendingUp,
  Users,
  Shield,
} from 'lucide-react';

const BADGE_CONFIG = {
  'Newcomer': { icon: '🌱', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Active Citizen': { icon: '⭐', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Community Hero': { icon: '🦸', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  'City Champion': { icon: '🏆', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
};

export default function Profile() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profRes, lbRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/profiles/${currentUser.id}`),
        axios.get(`${API_BASE_URL}/api/profiles/leaderboard`),
      ]);
      setProfile(profRes.data);
      setLeaderboard(lbRes.data);
      console.log('[Profile] profile data:', profRes.data);
      console.log('[Profile] leaderboard data:', lbRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--civic-bg)]">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="loading-spin text-civic-blue" />
        </div>
      </div>
    );
  }

  const badgeInfo = BADGE_CONFIG[profile?.badge] || BADGE_CONFIG['Newcomer'];
  const nextBadge =
    profile?.civic_points <= 50 ? 'Active Citizen' :
    profile?.civic_points <= 150 ? 'Community Hero' :
    profile?.civic_points <= 300 ? 'City Champion' : null;

  const pointsToNext = nextBadge
    ? (profile?.civic_points <= 50 ? 51 - profile.civic_points :
       profile?.civic_points <= 150 ? 151 - profile.civic_points :
       301 - profile.civic_points)
    : 0;

  return (
    <div className="min-h-screen bg-[var(--civic-bg)]">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-sky-700">Profile</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Your civic reputation</h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <div className="card-surface rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:p-8">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className={`flex h-24 w-24 items-center justify-center rounded-full text-4xl ${badgeInfo.bg} ${badgeInfo.border} border-2`}>
                  {badgeInfo.icon}
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-black text-slate-900">{profile?.name || 'Citizen'}</h2>
                  <p className="text-sm text-slate-500">{profile?.email}</p>
                  <div className={`mt-2 inline-flex items-center gap-2 rounded-full ${badgeInfo.bg} px-4 py-1.5 text-sm font-bold ${badgeInfo.color}`}>
                    <Award size={16} />
                    {profile?.badge || 'Newcomer'}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4 text-center ring-1 ring-slate-200">
                  <p className="text-3xl font-black text-civic-navy">{profile?.civic_points || 0}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Points</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-center ring-1 ring-slate-200">
                  <p className="text-3xl font-black text-civic-navy">{profile?.total_reports || 0}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Reports</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
                  <p className="text-3xl font-black text-emerald-600">{profile?.verified_reports || 0}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Verified</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-center ring-1 ring-amber-200">
                  <p className="text-3xl font-black text-amber-600">{profile?.civic_points || 0}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Rank</p>
                </div>
              </div>

              {nextBadge && (
                <div className="mt-6 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 p-5 ring-1 ring-sky-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700">Next badge: {nextBadge} {BADGE_CONFIG[nextBadge]?.icon}</p>
                      <p className="mt-1 text-xs text-slate-500">{pointsToNext} more points needed</p>
                    </div>
                    <TrendingUp size={24} className="text-sky-600" />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
                      style={{ width: `${Math.min(100, (profile?.civic_points || 0) / (profile?.civic_points + pointsToNext) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="card-surface rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <Trophy size={20} className="text-amber-500" />
                How points work
              </h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">+10</span>
                  <span className="text-sm text-slate-700">Submitting a report</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">+20</span>
                  <span className="text-sm text-slate-700">Report verified by 3+ citizens</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">+50</span>
                  <span className="text-sm text-slate-700">Resolution verified by you</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">+5</span>
                  <span className="text-sm text-slate-700">Confirming another citizen's issue</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-surface rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <Users size={20} className="text-civic-blue" />
                Top Citizens
              </h3>
              <div className="mt-5 space-y-3">
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-slate-400">No citizens ranked yet.</p>
                ) : (
                  leaderboard.map((citizen, index) => (
                    <div
                      key={citizen.id}
                      className={`flex items-center gap-3 rounded-2xl p-3 transition ${
                        citizen.id === currentUser?.id
                          ? 'bg-civic-blue/5 ring-1 ring-civic-blue/20'
                          : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-slate-200 text-slate-600' :
                        index === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {citizen.id === currentUser?.id ? 'You' : (citizen.name || citizen.email?.split('@')[0] || 'Citizen')}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{citizen.badge} {BADGE_CONFIG[citizen.badge]?.icon}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-civic-navy">{citizen.civic_points || 0}</p>
                        <p className="text-xs text-slate-400">pts</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-civic-navy to-civic-blue p-6 text-white shadow-[0_4px_24px_rgba(10,22,40,0.06)] ring-1 ring-white/10 sm:p-8">
              <Shield size={32} className="mb-3 opacity-50" />
              <p className="text-lg font-black">CivicAI</p>
              <p className="mt-2 text-sm text-white/70">Every report builds a better city. Your contributions earn points and recognition in the community.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
