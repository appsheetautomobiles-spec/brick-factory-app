'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? '/' : '/dashboard');
      });
    } else {
      router.replace('/');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 to-blue-950 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center w-full max-w-sm">
        <div className="text-5xl mb-4">🧱</div>
        <p className="text-gray-600 font-medium">Signing you in...</p>
        <div className="mt-4 flex justify-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 to-blue-950">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl w-full max-w-sm mx-4">
          <div className="text-5xl mb-4">🧱</div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
