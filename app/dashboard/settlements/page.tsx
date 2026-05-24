'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import BottomNav from '@/components/BottomNav';

interface Member { id: string; user_id: string; email?: string; full_name?: string }
interface AppUser { id: string; email: string; full_name?: string }
interface Expense {
  id: string; amount: number; paid_amount: number; expense_date: string; description: string;
  created_at: string; user_id: string;
  category?: { name: string } | null;
}
interface Payment { id: string; expense_id: string; user_id: string; amount: number; payment_date: string; note?: string }
interface Session { id: string; settled_at: string; note?: string }
interface MemberBalance { user_id: string; name: string; paid: number; share: number; balance: number }
interface Transfer { from: string; fromName: string; to: string; toName: string; amount: number }

function fmt(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateTransfers(balances: MemberBalance[]): Transfer[] {
  if (balances.length < 2) return [];
  const members = balances.map(m => ({ ...m, bal: m.balance }));
  const transfers: Transfer[] = [];
  for (let i = 0; i < 100; i++) {
    members.sort((a, b) => a.bal - b.bal);
    const debtor = members[0];
    const creditor = members[members.length - 1];
    if (!debtor || !creditor || Math.abs(debtor.bal) < 0.5 || creditor.bal < 0.5) break;
    const amount = Math.min(-debtor.bal, creditor.bal);
    transfers.push({ from: debtor.user_id, fromName: debtor.name, to: creditor.user_id, toName: creditor.name, amount });
    debtor.bal += amount;
    creditor.bal -= amount;
  }
  return transfers;
}

export default function SettlementsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, AppUser>>({});
  const [showExpenses, setShowExpenses] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [settleNote, setSettleNote] = useState('');
  const [settling, setSettling] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');

  const lastSession = sessions[0] ?? null;
  const periodStart = lastSession?.settled_at ?? null;

  const memberBalances = useMemo((): MemberBalance[] => {
    if (!members.length) return [];
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const share = members.length > 0 ? totalExpenses / members.length : 0;

    return members.map(m => {
      const paid = payments
        .filter(p => p.user_id === m.user_id)
        .reduce((s, p) => s + Number(p.amount), 0);
      const expensePaid = expenses
        .filter(e => e.user_id === m.user_id)
        .reduce((s, e) => s + Number(e.amount), 0);
      const totalPaid = paid + expensePaid;
      return {
        user_id: m.user_id,
        name: usersMap[m.user_id]?.full_name || usersMap[m.user_id]?.email?.split('@')[0] || 'Unknown',
        paid: totalPaid,
        share,
        balance: totalPaid - share,
      };
    });
  }, [members, expenses, payments, usersMap]);

  const transfers = useMemo(() => calculateTransfers(memberBalances), [memberBalances]);

  const fetchData = async () => {
    const [{ data: membersData }, { data: usersData }, { data: sessionsData }] = await Promise.all([
      supabase.from('settlement_members').select('*'),
      supabase.from('users').select('id, email, full_name'),
      supabase.from('settlement_sessions').select('*').order('settled_at', { ascending: false }),
    ]);

    const mems = membersData ?? [];
    const uMap: Record<string, AppUser> = {};
    (usersData ?? []).forEach((u: AppUser) => { uMap[u.id] = u; });
    const sess = sessionsData ?? [];

    setMembers(mems);
    setUsersMap(uMap);
    setSessions(sess);

    const lastSettled = sess[0]?.settled_at ?? null;
    const [{ data: expData }, { data: payData }] = await Promise.all([
      lastSettled
        ? supabase.from('expenses').select('id, amount, paid_amount, expense_date, description, created_at, user_id, category:categories!category_id(name)').gte('created_at', lastSettled)
        : supabase.from('expenses').select('id, amount, paid_amount, expense_date, description, created_at, user_id, category:categories!category_id(name)'),
      lastSettled
        ? supabase.from('payments').select('*').gte('created_at', lastSettled)
        : supabase.from('payments').select('*'),
    ]);

    setExpenses((expData ?? []) as unknown as Expense[]);
    setPayments(payData ?? []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUser(user);
      await fetchData();
      setLoading(false);
    };
    init();
  }, [router]);

  const handleSettle = async () => {
    setSettling(true);
    await supabase.from('settlement_sessions').insert({ settled_by: user.id, note: settleNote || null });
    setShowSettleConfirm(false);
    setSettleNote('');
    await fetchData();
    setSettling(false);
  };

  const handleAddMember = async () => {
    setMemberError('');
    if (!newMemberEmail.trim()) return;
    const { data: found } = await supabase.from('users').select('id, email').eq('email', newMemberEmail.trim().toLowerCase()).single();
    if (!found) { setMemberError('No user found with that email.'); return; }
    const { error } = await supabase.from('settlement_members').insert({ user_id: found.id });
    if (error) { setMemberError(error.message); return; }
    setNewMemberEmail('');
    await fetchData();
  };

  const handleRemoveMember = async (userId: string) => {
    await supabase.from('settlement_members').delete().eq('user_id', userId);
    await fetchData();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="text-5xl mb-3">🤝</div>
        <p className="text-gray-400 text-sm font-medium">Loading...</p>
      </div>
    </div>
  );

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const maxPaid = Math.max(...memberBalances.map(m => m.paid), 1);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation
        user={user}
        onProfileUpdate={async () => {
          const { data: { user: u } } = await supabase.auth.getUser();
          setUser(u);
        }}
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 dark:from-orange-700 dark:via-orange-800 dark:to-gray-900">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-14">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Settlements</h1>
              <p className="text-orange-200 text-sm mt-0.5">
                {periodStart ? `Since ${fmtDate(periodStart)}` : 'All time'}
              </p>
            </div>
            <button
              onClick={() => setShowManageMembers(true)}
              className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/30 active:scale-95 transition-transform"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Members
            </button>
          </div>

          {/* Summary card */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3.5 border border-white/20">
              <p className="text-orange-100 text-xs font-medium">Total Expenses</p>
              <p className="text-white text-xl font-bold mt-1">{fmt(totalExpenses)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3.5 border border-white/20">
              <p className="text-orange-100 text-xs font-medium">Per Person Share</p>
              <p className="text-white text-xl font-bold mt-1">{members.length ? fmt(totalExpenses / members.length) : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-8 pb-36 space-y-3">

        {members.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-700 dark:text-gray-200 font-semibold">No settlement members yet</p>
            <p className="text-gray-400 text-sm mt-1">Add members to start tracking shared expenses.</p>
            <button
              onClick={() => setShowManageMembers(true)}
              className="mt-4 px-5 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform"
            >
              Add Members
            </button>
          </div>
        ) : (
          <>
            {/* Member balances */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-sm font-bold text-gray-800 dark:text-white">Member Balances</p>
                <p className="text-xs text-gray-400 mt-0.5">Positive = overpaid (owed money), Negative = underpaid (owes money)</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {memberBalances.map(m => (
                  <div key={m.user_id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{m.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">paid {fmt(m.paid)}</span>
                        <span className={`text-sm font-bold ${m.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {m.balance >= 0 ? '+' : ''}{fmt(m.balance)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, (m.paid / maxPaid) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transfers needed */}
            {transfers.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-sm font-bold text-gray-800 dark:text-white">Transfers Needed</p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {transfers.map((t, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-600">
                          {t.fromName[0]?.toUpperCase()}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-600">
                          {t.toName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white">
                            <span className="text-red-500">{t.fromName}</span> → <span className="text-green-600">{t.toName}</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(t.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-green-700 dark:text-green-400 font-semibold text-sm">All settled!</p>
                  <p className="text-green-600 dark:text-green-500 text-xs mt-0.5">Everyone&apos;s balances are even.</p>
                </div>
              </div>
            )}

            {/* Settle up button */}
            <button
              onClick={() => setShowSettleConfirm(true)}
              className="w-full py-3.5 bg-orange-600 text-white font-bold rounded-2xl text-base active:scale-95 transition-transform shadow-lg"
              style={{ boxShadow: '0 4px 16px rgba(234,88,12,0.35)' }}
            >
              Mark as Settled
            </button>

            {/* Expense details collapsible */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <button
                className="w-full px-4 py-3.5 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
                onClick={() => setShowExpenses(v => !v)}
              >
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white text-left">Expense Details</p>
                  <p className="text-xs text-gray-400 mt-0.5 text-left">{expenses.length} expenses this period</p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform duration-200 ${showExpenses ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {showExpenses && (
                <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  {expenses.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-6">No expenses this period</p>
                  ) : (
                    expenses.map(e => {
                      const expPayments = payments.filter(p => p.expense_id === e.id);
                      const paidByExpenseOwner = Number(e.amount) - expPayments.reduce((s, p) => s + Number(p.amount), 0);
                      return (
                        <div key={e.id} className="px-4 py-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                {(e.category as any)?.name ?? 'Uncategorized'}{e.description ? ` · ${e.description}` : ''}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{fmtDate(e.expense_date)} · by {usersMap[e.user_id]?.full_name?.split(' ')[0] || usersMap[e.user_id]?.email?.split('@')[0] || 'Unknown'}</p>
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white ml-3">{fmt(e.amount)}</p>
                          </div>
                          {(expPayments.length > 0 || paidByExpenseOwner > 0.5) && (
                            <div className="mt-2 space-y-0.5">
                              {paidByExpenseOwner > 0.5 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 pl-2 border-l-2 border-orange-300">
                                  {usersMap[e.user_id]?.full_name?.split(' ')[0] || 'Owner'} paid {fmt(paidByExpenseOwner)} (expense)
                                </p>
                              )}
                              {expPayments.map(p => (
                                <p key={p.id} className="text-xs text-gray-500 dark:text-gray-400 pl-2 border-l-2 border-blue-300">
                                  {usersMap[p.user_id]?.full_name?.split(' ')[0] || 'Someone'} paid {fmt(p.amount)}{p.note ? ` · ${p.note}` : ''}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Settlement history collapsible */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <button
                className="w-full px-4 py-3.5 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
                onClick={() => setShowHistory(v => !v)}
              >
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white text-left">Settlement History</p>
                  <p className="text-xs text-gray-400 mt-0.5 text-left">{sessions.length} settlements total</p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {showHistory && (
                <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  {sessions.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-6">No settlements yet</p>
                  ) : (
                    sessions.map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{fmtDate(s.settled_at)}</p>
                          {s.note && <p className="text-xs text-gray-400 mt-0.5">{s.note}</p>}
                        </div>
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold px-2 py-0.5 rounded-full">Settled</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />

      {/* Manage Members bottom sheet */}
      {showManageMembers && (
        <div className="fixed inset-0 z-30 flex items-end fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowManageMembers(false); setMemberError(''); setNewMemberEmail(''); }} />
          <div className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-t-3xl px-4 pt-3 pb-10 slide-up max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Settlement Members</h2>

            {/* Current members */}
            <div className="space-y-2 mb-5">
              {members.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No members yet</p>
              ) : (
                members.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-sm font-bold text-orange-600">
                        {(usersMap[m.user_id]?.full_name || usersMap[m.user_id]?.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">
                          {usersMap[m.user_id]?.full_name || usersMap[m.user_id]?.email?.split('@')[0] || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400">{usersMap[m.user_id]?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.user_id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 active:scale-90 transition-transform"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add new member */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Add Member by Email</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                  placeholder="user@example.com"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                />
                <button
                  onClick={handleAddMember}
                  disabled={addingMember}
                  className="px-4 py-2.5 bg-orange-600 text-white font-semibold rounded-xl text-sm active:scale-95 transition-transform disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {memberError && <p className="text-red-500 text-xs mt-1.5">{memberError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Settle confirmation sheet */}
      {showSettleConfirm && (
        <div className="fixed inset-0 z-30 flex items-end fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettleConfirm(false)} />
          <div className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-t-3xl px-4 pt-3 pb-10 slide-up">
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-5" />
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🤝</div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Mark as Settled</h2>
              <p className="text-gray-400 text-sm mt-1">This will start a new settlement period. Balances will reset from now.</p>
            </div>

            {transfers.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 mb-4">
                <p className="text-orange-700 dark:text-orange-400 text-xs font-semibold mb-1.5">Pending transfers before settling:</p>
                {transfers.map((t, i) => (
                  <p key={i} className="text-orange-600 dark:text-orange-300 text-sm">
                    {t.fromName} → {t.toName}: {fmt(t.amount)}
                  </p>
                ))}
              </div>
            )}

            <input
              type="text"
              value={settleNote}
              onChange={e => setSettleNote(e.target.value)}
              placeholder="Add a note (optional)"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowSettleConfirm(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleSettle}
                disabled={settling}
                className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {settling ? 'Settling...' : 'Confirm Settle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
