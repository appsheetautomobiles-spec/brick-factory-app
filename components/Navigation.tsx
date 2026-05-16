'use client';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Navigation({ user }: { user: any }) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧱</span>
          <span className="font-bold text-gray-800 text-lg">Ittige Factory</span>
        </div>
        <div className="flex items-center gap-2">
          {avatarUrl && (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
          )}
          <span className="text-sm text-gray-500 hidden sm:block max-w-[140px] truncate">{displayName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 font-medium py-1.5 px-3 rounded-lg border border-red-200 hover:bg-red-50 active:scale-95 transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
