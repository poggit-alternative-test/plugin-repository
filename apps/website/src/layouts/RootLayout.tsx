/**
 * RootLayout Component
 *
 * The root application layout that wraps all pages.
 */

import { Outlet } from 'react-router-dom';
import { Header, Footer } from '@/components/layout';

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
