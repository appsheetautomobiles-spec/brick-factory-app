'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

type Tab = 'all' | 'category' | 'daily' | 'users';

interface Expense {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
  userName?: string;
}

interface EditForm {
  category: string;
  amount: string;
  description: string;
  expense_date: string;
}

interface Props {
  refreshKey: number;
  currentUserId: string;
  onStatsChange: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  raw_materials: 'Raw Materials',
  labor: 'Labor',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  transport: 'Transport',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  raw_materials: 'bg-orange-100 text-orange-700',
  labor: 'bg-purple-100 text-purple-700',
  utilities: 'bg-amber-100 text-amber-700',
  maintenance: 'bg-red-100 text-red-700',
  transport: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
};

const CATEGORY_BAR: Record<string, string> = {
  raw_materials: 'bg-orange-500',
  labor: 'bg-purple-500',
  utilities: 'bg-amber-500',
  maintenance: 'bg-red-500',
  transport: 'bg-green-500',
  other: 'bg-gray-400',
};

const AVATAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];

function avatarColor(userId: string) {
  const n = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '??';
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDateHeader(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmt(amount: number): string {
  return '₹' + new Intl.NumberFormat('en-IN').format(Math.round(amount));
}

export default function ExpenseList({ refreshKey, currentUserId, onStatsChange }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ category: '', amount: '', description: '', expense_date: '' });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => { fetchExpenses(); }, [refreshKey]);

  useEffect(() => {
    if (editingExpense) {
      setEditForm({
        category: editingExpense.category,
        amount: editingExpense.amount.toString(),
        description: editingExpense.description || '',
        expense_date: editingExpense.expense_date,
      });
    }
  }, [editingExpense]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const [{ data: expData }, { data: usersData }] = await Promise.all([
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('users').select('id, full_name, email'),
      ]);

      const usersMap = Object.fromEntries((usersData || []).map(u => [u.id, { name: u.full_name || u.email?.split('@')[0] || 'Unknown' }]));
      setExpenses((expData || []).map(e => ({ ...e, userName: usersMap[e.user_id]?.name || 'Unknown' })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      onStatsChange();
    }
    setDeletingId(null);
    setDeleteLoading(false);
  };

  const handleUpdate = async () => {
    if (!editingExpense) return;
    setEditLoading(true);
    const { error } = await supabase.from('expenses').update({
      category: editForm.category,
      amount: parseFloat(editForm.amount),
      description: editForm.description,
      expense_date: editForm.expense_date,
    }).eq('id', editingExpense.id);

    if (!error) {
      await fetchExpenses();
      onStatsChange();
      setEditingExpense(null);
    } else {
      alert(error.message);
    }
    setEditLoading(false);
  };

  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    expenses.forEach(e => { acc[e.category] = (acc[e.category] || 0) + Number(e.amount); });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const grandTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const byDate = useMemo(() => {
    const acc: Record<string, Expense[]> = {};
    expenses.forEach(e => { if (!acc[e.expense_date]) acc[e.expense_date] = []; acc[e.expense_date].push(e); });
    return Object.entries(acc).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  const byUser = useMemo(() => {
    const acc: Record<string, { name: string; total: number; count: number }> = {};
    expenses.forEach(e => {
      if (!acc[e.user_id]) acc[e.user_id] = { name: e.userName || 'Unknown', total: 0, count: 0 };
      acc[e.user_id].total += Number(e.amount);
      acc[e.user_id].count++;
    });
    return Object.entries(acc).sort((a, b) => b[1].total - a[1].total);
  }, [expenses]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'category', label: 'Category' },
    { id: 'daily', label: 'Daily' },
    { id: 'users', label: 'Users' },
  ];

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">Loading...</div>
  );

  if (expenses.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
      <div className="text-5xl mb-3">📋</div>
      <p className="text-gray-500 font-medium">No expenses yet</p>
      <p className="text-gray-400 text-sm mt-1">Tap + to add your first expense</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="bg-white rounded-2xl shadow-sm p-1.5 flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ALL TAB */}
      {activeTab === 'all' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {expenses.length} expenses
            </span>
            <span className="text-sm font-bold text-gray-900">{fmt(grandTotal)}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {expenses.map(expense => (
              <div key={expense.id} className="px-4 py-3.5">
                {deletingId === expense.id ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700 font-medium">Delete this expense?</p>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setDeletingId(null)} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg">Cancel</button>
                      <button onClick={() => handleDelete(expense.id)} disabled={deleteLoading} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg disabled:opacity-50">
                        {deleteLoading ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[expense.category] || 'bg-gray-100 text-gray-600'}`}>
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {expense.description || '—'} · {formatDate(expense.expense_date)} · {expense.userName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-base font-bold text-gray-900 mr-1">{fmt(expense.amount)}</span>
                      {expense.user_id === currentUserId && (
                        <>
                          <button
                            onClick={() => setEditingExpense(expense)}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            onClick={() => setDeletingId(expense.id)}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CATEGORY TAB */}
      {activeTab === 'category' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total · {fmt(grandTotal)}</span>
          </div>
          <div className="p-4 space-y-4">
            {categoryTotals.map(([cat, total]) => {
              const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600'}`}>
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{fmt(total)}</span>
                      <span className="text-xs text-gray-400 ml-2">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${CATEGORY_BAR[cat] || 'bg-gray-400'} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAILY TAB */}
      {activeTab === 'daily' && (
        <div className="space-y-3">
          {byDate.map(([date, items]) => {
            const dayTotal = items.reduce((s, e) => s + Number(e.amount), 0);
            return (
              <div key={date} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">{formatDateHeader(date)}</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(dayTotal)}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map(expense => (
                    <div key={expense.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[expense.category] || 'bg-gray-100 text-gray-600'}`}>
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </span>
                        <p className="text-xs text-gray-400 truncate">{expense.description || '—'} · {expense.userName}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 shrink-0">{fmt(expense.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">By member</span>
          </div>
          <div className="divide-y divide-gray-50">
            {byUser.map(([userId, info]) => {
              const pct = grandTotal > 0 ? (info.total / grandTotal) * 100 : 0;
              return (
                <div key={userId} className="px-4 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-full ${avatarColor(userId)} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                      {initials(info.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{info.name}</p>
                      <p className="text-xs text-gray-400">{info.count} {info.count === 1 ? 'expense' : 'expenses'}</p>
                    </div>
                    <span className="text-base font-bold text-gray-900 shrink-0">{fmt(info.total)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-12">
                    <div className={`h-full rounded-full ${avatarColor(userId)} opacity-70 transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-40 flex items-end fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingExpense(null)} />
          <div className="relative w-full max-w-2xl mx-auto bg-white rounded-t-3xl px-4 pt-3 pb-10 slide-up max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-bold text-gray-900 mb-5">Edit Expense</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, category: cat })}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                        editForm.category === cat ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={editForm.amount}
                  onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-500 bg-gray-50 text-lg font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-orange-500 bg-gray-50"
                  placeholder="Optional note"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date</label>
                <input
                  type="date"
                  value={editForm.expense_date}
                  onChange={e => setEditForm({ ...editForm, expense_date: e.target.value })}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-orange-500 bg-gray-50"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 py-4 rounded-xl font-semibold text-gray-600 bg-gray-100 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={editLoading}
                  className="flex-1 bg-orange-600 text-white py-4 rounded-xl font-semibold active:scale-95 transition-all disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
