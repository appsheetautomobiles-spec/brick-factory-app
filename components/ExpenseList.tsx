'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

type Tab = 'all' | 'category' | 'daily' | 'users';
type DateFilter = 'all' | 'today' | 'week' | 'month';

interface Expense {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
  image_url?: string;
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

const CATEGORIES = ['raw_materials', 'labor', 'utilities', 'maintenance', 'transport', 'other'];

const CATEGORY_LABELS: Record<string, string> = {
  raw_materials: 'Raw Materials',
  labor: 'Labor',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  transport: 'Transport',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  raw_materials: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  labor: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  utilities: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  maintenance: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  transport: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
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

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  all: 'All time',
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

export default function ExpenseList({ refreshKey, currentUserId, onStatsChange }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ category: '', amount: '', description: '', expense_date: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  // Filtered expenses based on search + date filter
  const filteredExpenses = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    let result = expenses;

    if (dateFilter === 'today') result = result.filter(e => e.expense_date === today);
    else if (dateFilter === 'week') result = result.filter(e => e.expense_date >= weekAgo);
    else if (dateFilter === 'month') result = result.filter(e => e.expense_date >= monthStart);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.description?.toLowerCase().includes(q) ||
        CATEGORY_LABELS[e.category]?.toLowerCase().includes(q) ||
        e.userName?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [expenses, search, dateFilter]);

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      onStatsChange();
    }
    setDeleteLoading(false);
    setConfirmingDelete(false);
    setSelectedExpense(null);
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

  const closeDetail = () => {
    setSelectedExpense(null);
    setConfirmingDelete(false);
  };

  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    filteredExpenses.forEach(e => { acc[e.category] = (acc[e.category] || 0) + Number(e.amount); });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const grandTotal = useMemo(() => filteredExpenses.reduce((s, e) => s + Number(e.amount), 0), [filteredExpenses]);

  const byDate = useMemo(() => {
    const acc: Record<string, Expense[]> = {};
    filteredExpenses.forEach(e => { if (!acc[e.expense_date]) acc[e.expense_date] = []; acc[e.expense_date].push(e); });
    return Object.entries(acc).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredExpenses]);

  const byUser = useMemo(() => {
    const acc: Record<string, { name: string; total: number; count: number }> = {};
    filteredExpenses.forEach(e => {
      if (!acc[e.user_id]) acc[e.user_id] = { name: e.userName || 'Unknown', total: 0, count: 0 };
      acc[e.user_id].total += Number(e.amount);
      acc[e.user_id].count++;
    });
    return Object.entries(acc).sort((a, b) => b[1].total - a[1].total);
  }, [filteredExpenses]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'category', label: 'Category' },
    { id: 'daily', label: 'Daily' },
    { id: 'users', label: 'Users' },
  ];

  const isFiltering = search.trim() !== '' || dateFilter !== 'all';

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">Loading...</div>
  );

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search expenses..."
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-orange-500 shadow-sm"
        />
      </div>

      {/* Date filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              dateFilter === f
                ? 'bg-orange-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {DATE_FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredExpenses.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center">
          <div className="text-5xl mb-3">{isFiltering ? '🔍' : '📋'}</div>
          <p className="text-gray-500 dark:text-gray-300 font-medium">
            {isFiltering ? 'No matching expenses' : 'No expenses yet'}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {isFiltering ? 'Try a different search or filter' : 'Tap + to add your first expense'}
          </p>
        </div>
      )}

      {filteredExpenses.length > 0 && (
        <>
          {/* Tab bar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-1.5 flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ALL TAB */}
          {activeTab === 'all' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {filteredExpenses.length} expenses
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmt(grandTotal)}</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {filteredExpenses.map(expense => (
                  <div
                    key={expense.id}
                    className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                    onClick={() => setSelectedExpense(expense)}
                  >
                    {expense.image_url && (
                      <img src={expense.image_url} alt="receipt" className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[expense.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {expense.description || '—'} · {formatDate(expense.expense_date)} · {expense.userName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-base font-bold text-gray-900 dark:text-gray-100">{fmt(expense.amount)}</span>
                      <svg className="text-gray-300 dark:text-gray-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CATEGORY TAB */}
          {activeTab === 'category' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Total · {fmt(grandTotal)}</span>
              </div>
              <div className="p-4 space-y-4">
                {categoryTotals.map(([cat, total]) => {
                  const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[cat] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                          {CATEGORY_LABELS[cat] || cat}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmt(total)}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${CATEGORY_BAR[cat] || 'bg-gray-400'} transition-all duration-500`} style={{ width: `${pct}%` }} />
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
                  <div key={date} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatDateHeader(date)}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmt(dayTotal)}</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                      {items.map(expense => (
                        <div
                          key={expense.id}
                          className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                          onClick={() => setSelectedExpense(expense)}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[expense.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                              {CATEGORY_LABELS[expense.category] || expense.category}
                            </span>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{expense.description || '—'} · {expense.userName}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {expense.image_url && (
                              <img src={expense.image_url} alt="receipt" className="w-7 h-7 rounded object-cover border border-gray-200 dark:border-gray-600" />
                            )}
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmt(expense.amount)}</span>
                          </div>
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">By member</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {byUser.map(([userId, info]) => {
                  const pct = grandTotal > 0 ? (info.total / grandTotal) * 100 : 0;
                  return (
                    <div key={userId} className="px-4 py-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-9 h-9 rounded-full ${avatarColor(userId)} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                          {initials(info.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{info.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{info.count} {info.count === 1 ? 'expense' : 'expenses'}</p>
                        </div>
                        <span className="text-base font-bold text-gray-900 dark:text-gray-100 shrink-0">{fmt(info.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden ml-12">
                        <div className={`h-full rounded-full ${avatarColor(userId)} opacity-70 transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* EXPENSE DETAIL POPUP */}
      {selectedExpense && (
        <div className="fixed inset-0 z-40 flex items-end fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={closeDetail} />
          <div className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-t-3xl px-4 pt-3 pb-10 slide-up max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-5" />

            {!confirmingDelete ? (
              <>
                {/* Header row: category + date */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${CATEGORY_COLORS[selectedExpense.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                    {CATEGORY_LABELS[selectedExpense.category] || selectedExpense.category}
                  </span>
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">{formatDate(selectedExpense.expense_date)}</span>
                </div>

                {/* Amount */}
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{fmt(selectedExpense.amount)}</p>

                {/* Description */}
                {selectedExpense.description ? (
                  <p className="text-gray-600 dark:text-gray-300 mb-1">{selectedExpense.description}</p>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 italic mb-1 text-sm">No description</p>
                )}

                {/* Added by */}
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Added by {selectedExpense.userName}</p>

                {/* Image */}
                {selectedExpense.image_url && (
                  <button
                    onClick={() => setLightboxUrl(selectedExpense.image_url!)}
                    className="w-full mb-5 block"
                  >
                    <img
                      src={selectedExpense.image_url}
                      alt="receipt"
                      className="w-full h-52 object-cover rounded-2xl border border-gray-200 dark:border-gray-600"
                    />
                    <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1.5">Tap to view full image</p>
                  </button>
                )}

                {/* Actions — only for own expenses */}
                {selectedExpense.user_id === currentUserId && (
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => { setEditingExpense(selectedExpense); closeDetail(); }}
                      className="flex-1 py-3.5 rounded-2xl font-semibold text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 active:scale-95 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="flex-1 py-3.5 rounded-2xl font-semibold text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 active:scale-95 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Delete confirmation */
              <div className="py-4 text-center">
                <div className="text-4xl mb-3">🗑️</div>
                <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">Delete this expense?</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
                  {CATEGORY_LABELS[selectedExpense.category]} · {fmt(selectedExpense.amount)} · {formatDate(selectedExpense.expense_date)}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 py-3.5 rounded-2xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(selectedExpense.id)}
                    disabled={deleteLoading}
                    className="flex-1 py-3.5 rounded-2xl font-semibold text-white bg-red-500 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-40 flex items-end fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingExpense(null)} />
          <div className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-t-3xl px-4 pt-3 pb-10 slide-up max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Edit Expense</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, category: cat })}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                        editForm.category === cat ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={editForm.amount}
                  onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 text-lg font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Description</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Optional note"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Date</label>
                <input
                  type="date"
                  value={editForm.expense_date}
                  onChange={e => setEditForm({ ...editForm, expense_date: e.target.value })}
                  className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 py-4 rounded-xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all"
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

      {/* IMAGE LIGHTBOX */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 fade-in p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="receipt" className="max-w-full max-h-full rounded-xl object-contain" />
          <button
            className="absolute top-4 right-4 w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center text-gray-300 text-lg font-bold"
            onClick={() => setLightboxUrl(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
