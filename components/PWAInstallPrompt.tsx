'use client';
import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'pwa-install-dismissed';

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Don't show if user dismissed it before
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as any).standalone === true) return;

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);

    if (ios) {
      // Safari never fires beforeinstallprompt — show manual instructions
      setIsIOS(true);
      setShow(true);
      return;
    }

    // Chrome/Android: the event may have already fired before this component mounted.
    // layout.tsx captures it early into window.__pwaPrompt.
    const early = (window as any).__pwaPrompt;
    if (early) {
      setDeferredPrompt(early);
      setShow(true);
      return;
    }

    // Still listening in case it fires after mount
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setShow(false));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
    (window as any).__pwaPrompt = null;
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-36 left-4 right-4 max-w-2xl mx-auto z-20 fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-4">
        {isIOS ? (
          /* Safari / iOS — manual instructions */
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0 mt-0.5">🧱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Install Ittige Factory</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Tap the{' '}
                <span className="inline-flex items-center gap-0.5 font-bold text-gray-700 dark:text-gray-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  Share
                </span>
                {' '}button, then choose{' '}
                <span className="font-bold text-gray-700 dark:text-gray-300">Add to Home Screen</span>
              </p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss" className="text-gray-300 dark:text-gray-600 hover:text-gray-500 p-1 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        ) : (
          /* Chrome / Android — native install prompt */
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">🧱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Install Ittige Factory</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add to home screen for quick access</p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss" className="text-gray-300 dark:text-gray-600 hover:text-gray-500 p-1 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <button onClick={handleInstall} className="bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all shrink-0">
              Install
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
