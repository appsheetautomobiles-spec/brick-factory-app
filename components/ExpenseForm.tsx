'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['raw_materials', 'labor', 'utilities', 'maintenance', 'transport', 'other'];

const CATEGORY_LABELS: Record<string, string> = {
  raw_materials: 'Raw Materials',
  labor: 'Labor',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  transport: 'Transport',
  other: 'Other',
};

interface Props {
  onExpenseAdded: () => void;
  onCancel?: () => void;
}

export default function ExpenseForm({ onExpenseAdded, onCancel }: Props) {
  const [formData, setFormData] = useState({
    category: 'raw_materials',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('expenses').insert([{
        user_id: user.id,
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description,
        expense_date: formData.expense_date,
      }]);

      if (error) throw error;
      setFormData({ category: 'raw_materials', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0] });
      onExpenseAdded();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error adding expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-5">Add Expense</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFormData({ ...formData, category: cat })}
                className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                  formData.category === cat
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {CATEGORY_LABELS[cat]}
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
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-500 bg-gray-50 text-lg font-semibold"
            placeholder="0"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-orange-500 bg-gray-50"
            placeholder="Optional note"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date</label>
          <input
            type="date"
            value={formData.expense_date}
            onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-orange-500 bg-gray-50"
          />
        </div>

        <div className="flex gap-3 pt-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 rounded-xl font-semibold text-gray-600 bg-gray-100 active:scale-95 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-orange-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
