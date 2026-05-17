'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';

interface Category { id: string; name: string }
interface Subcategory { id: string; category_id: string; name: string }

export default function CategoriesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState('');
  const [newSubNames, setNewSubNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

  const fetchData = async () => {
    const [{ data: cats }, { data: subs }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('subcategories').select('*').order('name'),
    ]);
    setCategories(cats || []);
    setSubcategories(subs || []);
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name || saving) return;
    setSaving(true);
    const { error } = await supabase.from('categories').insert({ name });
    if (error) { alert(error.message); } else {
      setNewCatName('');
      await fetchData();
    }
    setSaving(false);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category and all its subcategories?')) return;
    await supabase.from('categories').delete().eq('id', id);
    await fetchData();
  };

  const addSubcategory = async (categoryId: string) => {
    const name = (newSubNames[categoryId] || '').trim();
    if (!name || saving) return;
    setSaving(true);
    const { error } = await supabase.from('subcategories').insert({ category_id: categoryId, name });
    if (error) { alert(error.message); } else {
      setNewSubNames(prev => ({ ...prev, [categoryId]: '' }));
      await fetchData();
    }
    setSaving(false);
  };

  const deleteSubcategory = async (id: string) => {
    await supabase.from('subcategories').delete().eq('id', id);
    await fetchData();
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation user={user} />
      <div className="max-w-2xl mx-auto px-4 py-6 pb-20 space-y-4">

        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Manage expense categories and subcategories</p>
        </div>

        {/* Add category */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">New Category</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="Category name"
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:border-orange-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              onClick={addCategory}
              disabled={saving || !newCatName.trim()}
              className="px-5 py-2.5 bg-orange-600 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-40"
            >Add</button>
          </div>
        </div>

        {/* Category list */}
        {categories.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center">
            <div className="text-4xl mb-2">🏷️</div>
            <p className="text-gray-500 dark:text-gray-300 font-medium">No categories yet</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Add your first category above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => {
              const subs = subcategories.filter(s => s.category_id === cat.id);
              const isOpen = expanded.has(cat.id);
              return (
                <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                  {/* Category row */}
                  <button
                    className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left"
                    onClick={() => toggleExpand(cat.id)}
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{cat.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {subs.length} subcategor{subs.length === 1 ? 'y' : 'ies'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}
                        className="text-red-300 hover:text-red-500 dark:text-red-800 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                      <svg
                        className={`text-gray-300 dark:text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      >
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  </button>

                  {/* Subcategories */}
                  {isOpen && (
                    <div className="border-t border-gray-50 dark:border-gray-700">
                      {subs.length === 0 && (
                        <p className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500 italic">No subcategories yet</p>
                      )}
                      {subs.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                          <p className="text-sm text-gray-700 dark:text-gray-300">{sub.name}</p>
                          <button
                            onClick={() => deleteSubcategory(sub.id)}
                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-1 transition-colors"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                      {/* Add subcategory */}
                      <div className="flex gap-2 px-4 py-3 bg-gray-50/50 dark:bg-gray-700/30">
                        <input
                          type="text"
                          value={newSubNames[cat.id] || ''}
                          onChange={e => setNewSubNames(prev => ({ ...prev, [cat.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addSubcategory(cat.id)}
                          placeholder="Add subcategory..."
                          className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:border-orange-500 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        <button
                          onClick={() => addSubcategory(cat.id)}
                          disabled={saving || !newSubNames[cat.id]?.trim()}
                          className="px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-sm font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-40"
                        >Add</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
