'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  raw_materials: 'bg-orange-100 text-orange-700',
  labor: 'bg-purple-100 text-purple-700',
  utilities: 'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-red-100 text-red-700',
  transport: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function ExpenseList({ refreshKey }: { refreshKey: number }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses();
  }, [refreshKey]);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-gray-400">
        Loading expenses...
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">
        <div className="text-4xl mb-2">📋</div>
        <p>No expenses yet. Add your first one!</p>
      </div>
    );
  }

  const totalByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Category summary */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">By Category</h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(totalByCategory).map(([category, amount]) => (
            <div key={category} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColors[category] || 'bg-gray-100 text-gray-700'}`}>
                {category.replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-bold text-gray-800">₹{amount.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expense cards */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 mb-1">Recent Expenses</h2>
        <div className="divide-y divide-gray-100">
          {expenses.map((expense) => (
            <div key={expense.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColors[expense.category] || 'bg-gray-100 text-gray-700'}`}>
                    {expense.category.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {expense.description || '—'} · {new Date(expense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <span className="text-base font-bold text-gray-800 shrink-0">
                ₹{parseFloat(expense.amount.toString()).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
