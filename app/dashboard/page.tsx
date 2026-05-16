'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getOrCreateProfile } from '@/lib/profile';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ExpenseForm from '@/components/ExpenseForm';
import ExpenseList from '@/components/ExpenseList';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [factoryId, setFactoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      setUser(user);

      try {
        const profile = await getOrCreateProfile(
          user.id,
          user.email!,
          user.user_metadata?.full_name
        );
        setFactoryId(profile.factoryId);
        fetchTotalExpense(profile.factoryId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Setup failed');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const fetchTotalExpense = async (fid: string) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .eq('factory_id', fid)
        .gte('expense_date', new Date(new Date().getFullYear(), 0, 1).toISOString());

      if (error) throw error;
      const total = data?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
      setTotalExpense(total);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-3">🧱</div>
          <p className="text-gray-500">Setting up your factory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-sm text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-600 font-medium mb-2">Setup failed</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-8">
        {/* Stats card */}
        <div className="bg-orange-600 rounded-2xl p-5 text-white">
          <p className="text-orange-200 text-sm font-medium">Total Expenses (This Year)</p>
          <p className="text-4xl font-bold mt-1">₹{totalExpense.toFixed(2)}</p>
        </div>

        {/* Add Expense toggle */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full bg-orange-600 text-white py-4 rounded-2xl font-semibold text-base active:scale-95 transition-transform"
        >
          {showForm ? '✕  Cancel' : '+ Add Expense'}
        </button>

        {showForm && factoryId && (
          <ExpenseForm
            factoryId={factoryId}
            onExpenseAdded={() => {
              fetchTotalExpense(factoryId);
              setShowForm(false);
            }}
          />
        )}

        {factoryId && <ExpenseList factoryId={factoryId} />}
      </div>
    </div>
  );
}
