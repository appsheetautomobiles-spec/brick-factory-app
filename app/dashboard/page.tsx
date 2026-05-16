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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm font-medium">Total Expenses (This Year)</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              ${totalExpense.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ExpenseForm onExpenseAdded={fetchTotalExpense} />
          </div>
          <div className="lg:col-span-2">
            <ExpenseList />
          </div>
        </div>
      </div>
    </div>
  )
}