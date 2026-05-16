'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const categories = ['raw_materials', 'labor', 'utilities', 'maintenance', 'transport', 'other'];

const categoryLabels: Record<string, string> = {
  raw_materials: 'Raw Materials',
  labor: 'Labor',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  transport: 'Transport',
  other: 'Other',
};

export default function ExpenseForm({ onExpenseAdded }: { onExpenseAdded: () => void }) {
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

      const { error } = await supabase.from('expenses').insert([
        {
          user_id: user.id,
          factory_id: user.user_metadata?.factory_id || user.id,
          category: formData.category,
          amount: parseFloat(formData.amount),
          description: formData.description,
          expense_date: formData.expense_date,
        },
      ]);

      if (error) throw error;

      setFormData({
        category: 'raw_materials',
        amount: '',
        description: '',
        expense_date: new Date().toISOString().split('T')[0],
      });
      onExpenseAdded();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error adding expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Add Expense</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 bg-gray-50 text-base"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{categoryLabels[cat]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 bg-gray-50 text-base"
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 bg-gray-50 text-base"
            placeholder="Optional note"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Date</label>
          <input
            type="date"
            value={formData.expense_date}
            onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 bg-gray-50 text-base"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Save Expense'}
        </button>
      </form>
    </div>
  );
}
