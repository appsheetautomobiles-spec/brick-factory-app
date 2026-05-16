'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ExpenseForm from '@/components/ExpenseForm';
import ExpenseList from '@/components/ExpenseList';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalExpense, setTotalExpense] = useState(0);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      setUser(user);
      fetchTotalExpense();
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const fetchTotalExpense = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', new Date(new Date().getFullYear(), 0, 1).toISOString());

      if (error) throw error;
      const total = data?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
      setTotalExpense(total);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-3">🧱</div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-8">
        {/* Stats card */}
        <div className="bg-blue-600 rounded-2xl p-5 text-white">
          <p className="text-blue-200 text-sm font-medium">Total Expenses (This Year)</p>
          <p className="text-4xl font-bold mt-1">₹{totalExpense.toFixed(2)}</p>
        </div>

        {/* Add Expense toggle */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold text-base active:scale-95 transition-transform"
        >
          {showForm ? '✕  Cancel' : '+ Add Expense'}
        </button>

        {showForm && (
          <ExpenseForm
            onExpenseAdded={() => {
              fetchTotalExpense();
              setShowForm(false);
            }}
          />
        )}

        <ExpenseList />
      </div>
    </div>
  );
}
