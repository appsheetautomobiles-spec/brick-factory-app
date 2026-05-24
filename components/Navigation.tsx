'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={spinning ? { animation: 'spin 0.7s linear infinite' } : undefined}
    >
      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

interface Props {
  user: any;
  onRefresh?: () => Promise<void>;
  onProfileUpdate?: () => void;
}

export default function Navigation({ user, onRefresh, onProfileUpdate }: Props) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [dbName, setDbName] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('users').select('full_name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.full_name) setDbName(data.full_name); });
  }, [user?.id]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const openProfile = () => {
    setEditName(dbName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
    setShowProfile(true);
  };

  const handleSaveProfile = async () => {
    const name = editName.trim();
    if (!name || profileSaving) return;
    setProfileSaving(true);
    try {
      // Update auth metadata (affects greeting) and users table (affects expense list names)
      const [authResult, apiResult] = await Promise.all([
        supabase.auth.updateUser({ data: { full_name: name } }),
        fetch('/api/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, fullName: name }),
        }).then(r => r.json()),
      ]);

      if (authResult.error) throw new Error(authResult.error.message);
      if (apiResult.error) throw new Error(apiResult.error);

      setDbName(name);
      setShowProfile(false);
      onProfileUpdate?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update name. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const resolvedName = dbName || user?.user_metadata?.full_name || '';
  const displayName = resolvedName.split(' ')[0] || user?.email?.split('@')[0] || 'User';
  const initials = (resolvedName || displayName).slice(0, 2).toUpperCase();

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🧱</span>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-base tracking-tight leading-tight">Ittige Factory</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium leading-tight">Expense Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button onClick={handleRefresh} disabled={refreshing}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshIcon spinning={refreshing} />
              </button>
            )}
            <button onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Avatar — tappable to edit profile */}
            <button onClick={openProfile} className="relative group" aria-label="Edit profile">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-transparent group-hover:ring-orange-400 transition-all" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold ring-2 ring-transparent group-hover:ring-orange-400 transition-all">
                  {initials}
                </div>
              )}
              {/* Pencil badge */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-600 rounded-full flex items-center justify-center">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </span>
            </button>

            <button onClick={() => setShowConfirm(true)}
              className="text-xs text-gray-500 dark:text-gray-400 font-medium py-1.5 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Profile edit modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowProfile(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-xs slide-up">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-5 text-center">Edit Profile</h3>

            {/* Avatar preview */}
            <div className="flex justify-center mb-5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-orange-100 dark:ring-orange-900/40" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center text-3xl font-bold ring-4 ring-orange-50 dark:ring-orange-900/20">
                  {editName.slice(0, 2).toUpperCase() || initials}
                </div>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveProfile()}
                placeholder="Your name"
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:border-orange-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">This name appears on all your expenses</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowProfile(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all"
              >Cancel</button>
              <button onClick={handleSaveProfile} disabled={profileSaving || !editName.trim()}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50"
              >{profileSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sign out confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-xs text-center slide-up">
            <div className="text-4xl mb-3">👋</div>
            <p className="text-base font-bold text-gray-900 dark:text-white mb-1">Sign out?</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">You'll need to sign in again to access your expenses.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all"
              >Cancel</button>
              <button onClick={handleSignOut} disabled={signingOut}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
              >{signingOut ? 'Signing out...' : 'Sign out'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
