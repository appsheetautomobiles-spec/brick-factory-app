'use client';
import { useEffect, useState } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    const handleInstalled = () => setShow(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-2xl mx-auto z-20 fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">🧱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Install Ittige Factory</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add to home screen for quick access</p>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 p-1 flex-shrink-0"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <button
          onClick={handleInstall}
          className="bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all flex-shrink-0"
        >
          Install
        </button>
      </div>
    </div>
  );
}
