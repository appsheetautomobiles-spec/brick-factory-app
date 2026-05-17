'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Tab = 'all' | 'category' | 'daily' | 'users';
type DateFilter = 'all' | 'today' | 'week' | 'month';

interface Category { id: string; name: string }
interface Subcategory { id: string; category_id: string; name: string }

interface Expense {
  id: string;
  user_id: string;
  category_id?: string | null;
  category?: { id: string; name: string } | null;
  subcategory_id?: string | null;
  subcategory?: { id: string; name: string } | null;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
  image_url?: string;
  userName?: string;
}

interface EditForm { amount: string; description: string; expense_date: string }

interface Props { refreshKey: number; currentUserId: string; onStatsChange: () => void }

// Dynamic color palette — hashed by category name so same category always gets same color
const CAT_COLORS = [
  'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
];
const CAT_BAR = ['bg-orange-500', 'bg-purple-500', 'bg-amber-500', 'bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-teal-500', 'bg-pink-500'];

function hashIdx(str: string) { return str.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % CAT_COLORS.length; }
function catColor(name: string) { return CAT_COLORS[hashIdx(name)]; }
function catBar(name: string) { return CAT_BAR[hashIdx(name)]; }

function getCategoryName(e: Expense): string { return e.category?.name || 'Unknown'; }
function getSubcategoryName(e: Expense): string | null { return e.subcategory?.name || null; }

const AVATAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
function avatarColor(id: string) { return AVATAR_COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '??'; }

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDate(s: string): string {
  const today = localDateStr(), yest = localDateStr(new Date(Date.now() - 86400000));
  if (s === today) return 'Today';
  if (s === yest) return 'Yesterday';
  return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function formatDateHeader(s: string): string {
  const today = localDateStr(), yest = localDateStr(new Date(Date.now() - 86400000));
  if (s === today) return 'Today';
  if (s === yest) return 'Yesterday';
  return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmt(n: number) { return '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n)); }

const DATE_FILTER_LABELS: Record<DateFilter, string> = { all: 'All time', today: 'Today', week: 'This week', month: 'This month' };

const SEL_CLS = "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 text-sm font-medium appearance-none pr-8";

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
  const [editForm, setEditForm] = useState<EditForm>({ amount: '', description: '', expense_date: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const [editSubcategories, setEditSubcategories] = useState<Subcategory[]>([]);
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editSubcategoryId, setEditSubcategoryId] = useState('');
  const editSubcategoryIdRef = useRef('');
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => { fetchExpenses(); }, [refreshKey]);

  // Keep ref in sync so the editCategoryId effect can read current subcategoryId without a dep loop
  useEffect(() => { editSubcategoryIdRef.current = editSubcategoryId; }, [editSubcategoryId]);

  useEffect(() => {
    if (!editingExpense) return;
    setEditForm({
      amount: editingExpense.amount.toString(),
      description: editingExpense.description || '',
      expense_date: editingExpense.expense_date,
    });
    setEditImageUrl(editingExpense.image_url ?? null);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditSubcategoryId(editingExpense.subcategory_id || '');
    supabase.from('categories').select('*').order('name').then(({ data: cats }) => {
      const cats_ = cats || [];
      setEditCategories(cats_);
      setEditCategoryId(editingExpense.category_id || cats_[0]?.id || '');
    });
  }, [editingExpense]);

  useEffect(() => {
    if (!editCategoryId) { setEditSubcategories([]); return; }
    supabase.from('subcategories').select('*').eq('category_id', editCategoryId).order('name').then(({ data: subs }) => {
      const subs_ = subs || [];
      setEditSubcategories(subs_);
      const belongs = subs_.some(s => s.id === editSubcategoryIdRef.current);
      if (!belongs) setEditSubcategoryId(subs_[0]?.id || '');
    });
  }, [editCategoryId]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const [{ data: expData }, { data: usersData }] = await Promise.all([
        supabase.from('expenses')
          .select('*, category:categories!category_id(id, name), subcategory:subcategories!subcategory_id(id, name)')
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('users').select('id, full_name, email'),
      ]);
      const usersMap = Object.fromEntries((usersData || []).map(u => [u.id, { name: u.full_name || u.email?.split('@')[0] || 'Unknown' }]));
      setExpenses((expData || []).map((e: any) => ({ ...e, userName: usersMap[e.user_id]?.name || 'Unknown' })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const today = localDateStr(now);
    const weekAgo = localDateStr(new Date(Date.now() - 7 * 86400000));
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    let result = expenses;
    if (dateFilter === 'today') result = result.filter(e => e.expense_date === today);
    else if (dateFilter === 'week') result = result.filter(e => e.expense_date >= weekAgo);
    else if (dateFilter === 'month') result = result.filter(e => e.expense_date >= monthStart);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.description?.toLowerCase().includes(q) ||
        getCategoryName(e).toLowerCase().includes(q) ||
        (getSubcategoryName(e) || '').toLowerCase().includes(q) ||
        e.userName?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [expenses, search, dateFilter]);

  const deleteCloudinaryImage = async (imageUrl: string) => {
    try {
      await fetch('/api/delete-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl }) });
    } catch { }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    const expense = expenses.find(e => e.id === id);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      if (expense?.image_url) await deleteCloudinaryImage(expense.image_url);
      setExpenses(prev => prev.filter(e => e.id !== id));
      onStatsChange();
    }
    setDeleteLoading(false);
    setConfirmingDelete(false);
    setSelectedExpense(null);
  };

  const uploadEditImage = async (): Promise<string | null> => {
    if (!editImageFile) return null;
    setEditImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', editImageFile);
      fd.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
      fd.append('folder', 'ittige-factory');
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Upload failed');
      return json.secure_url as string;
    } catch { alert('Image upload failed.'); return null; }
    finally { setEditImageUploading(false); }
  };

  const handleUpdate = async () => {
    if (!editingExpense) return;
    setEditLoading(true);
    let finalImageUrl = editImageUrl;
    if (editImageFile) finalImageUrl = await uploadEditImage();
    const originalImageUrl = editingExpense.image_url;
    const { error } = await supabase.from('expenses').update({
      category_id: editCategoryId || null,
      subcategory_id: editSubcategoryId || null,
      amount: parseFloat(editForm.amount),
      description: editForm.description,
      expense_date: editForm.expense_date,
      image_url: finalImageUrl,
    }).eq('id', editingExpense.id);
    if (!error) {
      if (originalImageUrl && originalImageUrl !== finalImageUrl) await deleteCloudinaryImage(originalImageUrl);
      await fetchExpenses();
      onStatsChange();
      setEditingExpense(null);
    } else {
      alert(error.message);
    }
    setEditLoading(false);
  };

  const closeDetail = () => { setSelectedExpense(null); setConfirmingDelete(false); };

  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    filteredExpenses.forEach(e => { const k = getCategoryName(e); acc[k] = (acc[k] || 0) + Number(e.amount); });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const subcategoryTotals = useMemo(() => {
    const acc: Record<string, Record<string, number>> = {};
    filteredExpenses.forEach(e => {
      const cat = getCategoryName(e), sub = getSubcategoryName(e);
      if (sub) { if (!acc[cat]) acc[cat] = {}; acc[cat][sub] = (acc[cat][sub] || 0) + Number(e.amount); }
    });
    return acc;
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

  if (loading) return <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by category, subcategory, description…"
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-orange-500 shadow-sm"
        />
      </div>

      {/* Date filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map(f => (
          <button key={f} onClick={() => setDateFilter(f)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${dateFilter === f ? 'bg-orange-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
          >{DATE_FILTER_LABELS[f]}</button>
        ))}
      </div>

      {/* Empty state */}
      {filteredExpenses.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center">
          <div className="text-5xl mb-3">{isFiltering ? '🔍' : '📋'}</div>
          <p className="text-gray-500 dark:text-gray-300 font-medium">{isFiltering ? 'No matching expenses' : 'No expenses yet'}</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{isFiltering ? 'Try a different search or filter' : 'Tap + to add your first expense'}</p>
        </div>
      )}

      {filteredExpenses.length > 0 && (
        <>
          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-1.5 flex gap-1">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >{tab.label}</button>
            ))}
          </div>

          {/* ALL TAB */}
          {activeTab === 'all' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{filteredExpenses.length} expenses</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmt(grandTotal)}</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {filteredExpenses.map(expense => {
                  const catName = getCategoryName(expense);
                  const subName = getSubcategoryName(expense);
                  return (
                    <div key={expense.id} className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors" onClick={() => setSelectedExpense(expense)}>
                      {expense.image_url && <img src={expense.image_url} alt="receipt" className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-600 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColor(catName)}`}>{catName}</span>
                          {subName && <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{subName}</span>}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{expense.description || '—'} · {formatDate(expense.expense_date)} · {expense.userName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-base font-bold text-gray-900 dark:text-gray-100">{fmt(expense.amount)}</span>
                        <svg className="text-gray-300 dark:text-gray-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CATEGORY TAB */}
          {activeTab === 'category' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Total · {fmt(grandTotal)}</span>
              </div>
              <div className="p-4 space-y-5">
                {categoryTotals.map(([catName, total]) => {
                  const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                  const subBreakdown = subcategoryTotals[catName] || {};
                  return (
                    <div key={catName}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${catColor(catName)}`}>{catName}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmt(total)}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${catBar(catName)} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                      {/* Subcategory breakdown */}
                      {Object.keys(subBreakdown).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(subBreakdown).sort((a, b) => b[1] - a[1]).map(([subName, subTotal]) => (
                            <div key={subName} className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 px-1">
                              <span className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                                {subName}
                              </span>
                              <span className="font-semibold text-gray-600 dark:text-gray-300">{fmt(subTotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
                      {items.map(expense => {
                        const catName = getCategoryName(expense);
                        const subName = getSubcategoryName(expense);
                        return (
                          <div key={expense.id} className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors" onClick={() => setSelectedExpense(expense)}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${catColor(catName)}`}>{catName}</span>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                {subName ? `${subName} · ` : ''}{expense.description || '—'} · {expense.userName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {expense.image_url && <img src={expense.image_url} alt="receipt" className="w-7 h-7 rounded object-cover border border-gray-200 dark:border-gray-600" />}
                              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmt(expense.amount)}</span>
                            </div>
                          </div>
                        );
                      })}
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
                        <div className={`w-9 h-9 rounded-full ${avatarColor(userId)} text-white flex items-center justify-center text-xs font-bold shrink-0`}>{initials(info.name)}</div>
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

      {/* DETAIL POPUP */}
      {selectedExpense && (
        <div className="fixed inset-0 z-40 flex items-end fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={closeDetail} />
          <div className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-t-3xl px-4 pt-3 pb-10 slide-up max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-5" />
            {!confirmingDelete ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${catColor(getCategoryName(selectedExpense))}`}>{getCategoryName(selectedExpense)}</span>
                    {getSubcategoryName(selectedExpense) && (
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{getSubcategoryName(selectedExpense)}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium shrink-0">{formatDate(selectedExpense.expense_date)}</span>
                </div>
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{fmt(selectedExpense.amount)}</p>
                {selectedExpense.description
                  ? <p className="text-gray-600 dark:text-gray-300 mb-1">{selectedExpense.description}</p>
                  : <p className="text-gray-400 dark:text-gray-500 italic mb-1 text-sm">No description</p>}
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Added by {selectedExpense.userName}</p>
                {selectedExpense.image_url && (
                  <button onClick={() => setLightboxUrl(selectedExpense.image_url!)} className="w-full mb-5 block">
                    <img src={selectedExpense.image_url} alt="receipt" className="w-full h-52 object-cover rounded-2xl border border-gray-200 dark:border-gray-600" />
                    <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1.5">Tap to view full image</p>
                  </button>
                )}
                {selectedExpense.user_id === currentUserId && (
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => { setEditingExpense(selectedExpense); closeDetail(); }} className="flex-1 py-3.5 rounded-2xl font-semibold text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 active:scale-95 transition-all">Edit</button>
                    <button onClick={() => setConfirmingDelete(true)} className="flex-1 py-3.5 rounded-2xl font-semibold text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 active:scale-95 transition-all">Delete</button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-4 text-center">
                <div className="text-4xl mb-3">🗑️</div>
                <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">Delete this expense?</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
                  {getCategoryName(selectedExpense)}{getSubcategoryName(selectedExpense) ? ` · ${getSubcategoryName(selectedExpense)}` : ''} · {fmt(selectedExpense.amount)} · {formatDate(selectedExpense.expense_date)}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmingDelete(false)} className="flex-1 py-3.5 rounded-2xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all">Cancel</button>
                  <button onClick={() => handleDelete(selectedExpense.id)} disabled={deleteLoading} className="flex-1 py-3.5 rounded-2xl font-semibold text-white bg-red-500 active:scale-95 transition-all disabled:opacity-50">{deleteLoading ? 'Deleting...' : 'Yes, Delete'}</button>
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
              {/* Category + Subcategory */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Category</label>
                  <div className="relative">
                    <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className={SEL_CLS}>
                      {editCategories.length === 0 && <option value="">No categories</option>}
                      {editCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Subcategory</label>
                  <div className="relative">
                    <select value={editSubcategoryId} onChange={e => setEditSubcategoryId(e.target.value)} disabled={editSubcategories.length === 0} className={`${SEL_CLS} disabled:opacity-50`}>
                      {editSubcategories.length === 0 && <option value="">None</option>}
                      {editSubcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Amount (₹)</label>
                <input type="number" step="0.01" inputMode="decimal" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 text-lg font-semibold" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Description</label>
                <input type="text" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Optional note"
                  className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Date</label>
                <input type="date" value={editForm.expense_date} onChange={e => setEditForm({ ...editForm, expense_date: e.target.value })}
                  className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700" />
              </div>

              {/* Image */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Receipt / Photo</label>
                {editImagePreview ? (
                  <div className="relative">
                    <img src={editImagePreview} alt="New preview" className="w-full h-40 object-cover rounded-xl border border-gray-200 dark:border-gray-600" />
                    <button type="button" onClick={() => { setEditImageFile(null); setEditImagePreview(null); }} className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow">×</button>
                  </div>
                ) : editImageUrl ? (
                  <div>
                    <img src={editImageUrl} alt="Current receipt" className="w-full h-40 object-cover rounded-xl border border-gray-200 dark:border-gray-600" />
                    <div className="flex gap-2 mt-2">
                      <button type="button" onClick={() => editFileInputRef.current?.click()} className="flex-1 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 active:scale-95 transition-all">Change photo</button>
                      <button type="button" onClick={() => setEditImageUrl(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 active:scale-95 transition-all">Remove photo</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => editFileInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-gray-400 dark:text-gray-500 text-sm font-medium hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center justify-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                    </svg>
                    Attach photo
                  </button>
                )}
                <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setEditImageFile(file);
                  const reader = new FileReader();
                  reader.onload = ev => setEditImagePreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }} />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditingExpense(null)} className="flex-1 py-4 rounded-xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all">Cancel</button>
                <button onClick={handleUpdate} disabled={editLoading || editImageUploading} className="flex-1 bg-orange-600 text-white py-4 rounded-xl font-semibold active:scale-95 transition-all disabled:opacity-50">
                  {editImageUploading ? 'Uploading...' : editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 fade-in p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="receipt" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center text-gray-300 text-lg font-bold" onClick={() => setLightboxUrl(null)}>×</button>
        </div>
      )}
    </div>
  );
}
