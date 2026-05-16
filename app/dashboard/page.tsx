'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/profile';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ExpenseForm from '@/components/ExpenseForm';
import ExpenseList from '@/components/ExpenseList';

interface Stats { year: number; month: number; today: number }

function fmt(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ year: 0, month: 0, today: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUser(user);
      await ensureUserProfile(user.id, user.email!, user.user_metadata?.full_name);
      await fetchStats();
      setLoading(false);
    };
    init();
  }, [router]);

  const fetchStats = async () => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const { data } = await supabase.from('expenses').select('amount, expense_date').gte('expense_date', yearStart);
    if (!data) return;

    setStats({
      year: data.reduce((s, e) => s + Number(e.amount), 0),
      month: data.filter(e => e.expense_date >= monthStart).reduce((s, e) => s + Number(e.amount), 0),
      today: data.filter(e => e.expense_date === today).reduce((s, e) => s + Number(e.amount), 0),
    });
  };

  const handleExpenseAdded = () => {
    fetchStats();
    setRefreshKey(k => k + 1);
    setShowAdd(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="text-5xl mb-3">🧱</div>
        <p className="text-gray-400 text-sm font-medium">Loading...</p>
      </div>
    </div>
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation user={user} />

      <div className="max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-4">
        {/* Greeting */}
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">{greeting},</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{firstName} 👋</h1>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'This Year', value: stats.year },
            { label: 'This Month', value: stats.month },
            { label: 'Today', value: stats.today },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl p-3.5 shadow-sm">
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium leading-tight">{label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1 leading-tight">{fmt(value)}</p>
            </div>
          ))}
        </div>

        <ExpenseList
          refreshKey={refreshKey}
          currentUserId={user?.id}
          onStatsChange={fetchStats}
        />
      </div>

      {/* Floating action button */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-4 w-14 h-14 bg-orange-600 text-white rounded-full shadow-xl flex items-center justify-center text-3xl font-light active:scale-90 transition-transform z-20 leading-none"
        style={{ boxShadow: '0 4px 20px rgba(234,88,12,0.4)' }}
      >
        +
      </button>

      {/* Add Expense bottom sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-30 flex items-end fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-t-3xl px-4 pt-3 pb-10 slide-up max-h-[92vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-5" />
            <ExpenseForm onExpenseAdded={handleExpenseAdded} onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
