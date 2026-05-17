'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/profile';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ExpenseForm from '@/components/ExpenseForm';
import ExpenseList from '@/components/ExpenseList';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import BottomNav from '@/components/BottomNav';

interface Stats { year: number; month: number; today: number; pending: number }
interface LastEntry { amount: number; created_at: string; category?: { name: string } | null; subcategory?: { name: string } | null }


function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

const STAT_ICONS = ['📅', '🗓️', '☀️'];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ year: 0, month: 0, today: 0, pending: 0 });
  const [lastEntry, setLastEntry] = useState<LastEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      // Check allowlist
      const { data: allowed } = await supabase
        .from('allowed_emails')
        .select('email')
        .eq('email', user.email)
        .single();

      if (!allowed) {
        await supabase.auth.signOut();
        router.replace('/?error=access_denied');
        return;
      }

      setUser(user);
      await ensureUserProfile(user.id, user.email!, user.user_metadata?.full_name);
      await fetchStats();
      setLoading(false);
    };
    init();
  }, [router]);

  const fetchStats = async () => {
    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = localDateStr(now);

    const [{ data: allData }, { data: last }] = await Promise.all([
      supabase.from('expenses').select('amount, expense_date, paid_amount'),
      supabase.from('expenses').select('amount, created_at, category:categories!category_id(name), subcategory:subcategories!subcategory_id(name)').order('created_at', { ascending: false }).limit(1).single(),
    ]);

    if (allData) {
      const yearData = allData.filter(e => e.expense_date >= yearStart);
      setStats({
        year: yearData.reduce((s, e) => s + Number(e.amount), 0),
        month: yearData.filter(e => e.expense_date >= monthStart).reduce((s, e) => s + Number(e.amount), 0),
        today: yearData.filter(e => e.expense_date === today).reduce((s, e) => s + Number(e.amount), 0),
        pending: allData.reduce((s, e) => s + Math.max(0, Number(e.amount) - Number(e.paid_amount || 0)), 0),
      });
    }
    if (last) setLastEntry(last as unknown as LastEntry);
  };

  const handleRefresh = async () => {
    await fetchStats();
    setRefreshKey(k => k + 1);
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
  const statRows = [
    { label: 'This Year', value: stats.year },
    { label: 'This Month', value: stats.month },
    { label: 'Today', value: stats.today },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation
        user={user}
        onRefresh={handleRefresh}
        onProfileUpdate={async () => {
          const { data: { user: u } } = await supabase.auth.getUser();
          setUser(u);
          setRefreshKey(k => k + 1);
        }}
      />

      {/* Hero header */}
      <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 dark:from-orange-700 dark:via-orange-800 dark:to-gray-900">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-14">

          {/* Single-line greeting + last entry */}
          <h1 className="text-2xl font-bold text-white capitalize">
            {greeting}, {firstName} ✨
          </h1>
          {lastEntry ? (
            <p className="text-orange-200 text-sm mt-1.5 font-medium">
              Last entry: {lastEntry.category?.name ?? 'Unknown'}{lastEntry.subcategory?.name ? ` · ${lastEntry.subcategory.name}` : ''} · {fmt(lastEntry.amount)} · {timeAgo(lastEntry.created_at)}
            </p>
          ) : (
            <p className="text-orange-200 text-sm mt-1.5 font-medium">No expenses logged yet</p>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2.5 mt-5">
            {statRows.map(({ label, value }, i) => (
              <div key={label} className="bg-white/15 backdrop-blur-sm rounded-2xl p-3.5 border border-white/20">
                <p className="text-lg mb-0.5">{STAT_ICONS[i]}</p>
                <p className="text-orange-100 text-xs font-medium leading-tight">{label}</p>
                <p className="text-white text-lg font-bold mt-1 leading-tight">{fmt(value)}</p>
              </div>
            ))}
          </div>

          {/* Pending card */}
          {stats.pending > 0 && (
            <div className="mt-2.5 bg-red-500/25 border border-red-400/30 backdrop-blur-sm rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-red-200 text-xs font-semibold uppercase tracking-wide">⚠️ Pending Payments</p>
                <p className="text-white text-xl font-bold mt-0.5">{fmt(stats.pending)}</p>
              </div>
              <p className="text-red-200 text-xs font-medium text-right">outstanding<br/>balance</p>
            </div>
          )}
        </div>
      </div>

      {/* Content slides up over hero */}
      <div className="max-w-2xl mx-auto px-4 -mt-8 pb-40 space-y-3">
        <ExpenseList
          refreshKey={refreshKey}
          currentUserId={user?.id}
          onStatsChange={fetchStats}
        />
      </div>

      <PWAInstallPrompt />
      <BottomNav />

      {/* FAB — sits above the bottom nav */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-orange-600 text-white rounded-full shadow-xl flex items-center justify-center text-3xl font-light active:scale-90 transition-transform z-20 leading-none"
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
