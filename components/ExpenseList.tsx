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

export default function ExpenseList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses();
    const subscription = supabase
      .channel('expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchExpenses();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  if (loading) return <div className="bg-white rounded-lg shadow p-6">Loading expenses...</div>;

  const totalByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Recent Expenses</h2>

      {/* Category Summary */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(totalByCategory).map(([category, amount]) => (
          <div key={category} className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">{category.replace(/_/g, ' ').toUpperCase()}</p>
            <p className="text-lg font-bold text-blue-600">${amount.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Expense Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{new Date(expense.expense_date).toLocaleDateString()}</td>
                <td className="px-4 py-2">{expense.category.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2">{expense.description}</td>
                <td className="px-4 py-2 text-right font-semibold">${parseFloat(expense.amount.toString()).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expenses.length === 0 && (
        <div className="text-center py-8 text-gray-500">No expenses yet. Add your first expense!</div>
      )}
    </div>
  );
}