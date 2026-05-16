'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('exchangeCodeForSession error:', error);
          setError(error.message);
        } else {
          router.replace('/dashboard');
        }
      });
    } else {
      // No code — listen for session from implicit flow or redirect to login
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) router.replace('/dashboard');
      });

      const timeout = setTimeout(() => router.replace('/'), 4000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 to-blue-950 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center w-full max-w-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-600 font-medium mb-2">Sign-in failed</p>
          <p className="text-gray-500 text-sm mb-5">{error}</p>
          <button
            onClick={() => router.replace('/')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

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
