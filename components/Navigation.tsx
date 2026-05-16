'use client';
import { useState } from 'react';
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

export default function Navigation({ user }: { user: any }) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/');
  };

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🧱</span>
            <span className="font-bold text-gray-900 dark:text-white text-base tracking-tight">Ittige Factory</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">{initials}</div>
            )}
            <button
              onClick={() => setShowConfirm(true)}
              className="text-xs text-gray-500 dark:text-gray-400 font-medium py-1.5 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Sign out confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-xs text-center slide-up">
            <div className="text-4xl mb-3">👋</div>
            <p className="text-base font-bold text-gray-900 dark:text-white mb-1">Sign out?</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">You'll need to sign in again to access your expenses.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
