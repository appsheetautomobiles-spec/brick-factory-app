'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import BottomNav from '@/components/BottomNav';

export default function SettlementsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUser(user);
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation
        user={user}
        onProfileUpdate={async () => {
          const { data: { user: u } } = await supabase.auth.getUser();
          setUser(u);
        }}
      />
      <div className="max-w-2xl mx-auto px-4 flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 56px - 64px)' }}>
        <div className="text-center px-6">
          <div className="text-6xl mb-5">🤝</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Settlements</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm leading-relaxed mb-6">
            Track who owes what, settle balances between members, and keep everyone square.
          </p>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Coming Soon
          </span>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
