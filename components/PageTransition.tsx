'use client';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [animating, setAnimating] = useState(true);

  return (
    <div
      key={pathname}
      className={animating ? 'page-enter' : ''}
      onAnimationEnd={() => setAnimating(false)}
    >
      {children}
    </div>
  );
}
