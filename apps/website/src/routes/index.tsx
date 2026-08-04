import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from '@/layouts/RootLayout';
import { HomePage } from '@/pages/HomePage';
import { SearchPage } from '@/pages/SearchPage';
import { PluginPage } from '@/pages/PluginPage';
import { VersionPage } from '@/pages/VersionPage';
import { AuthorPage } from '@/pages/AuthorPage';
import { AuthorsPage } from '@/pages/AuthorsPage';
import { AboutPage } from '@/pages/AboutPage';
import { PluginsPage } from '@/pages/PluginsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Development-only: Import playground if in development mode
let PlaygroundPage: React.ComponentType<unknown> | undefined;
if (import.meta.env.DEV) {
  const module = await import('@/pages/PlaygroundPage');
  PlaygroundPage = module.PlaygroundPage;
}

const devRoutes = PlaygroundPage
  ? [{ path: 'playground', element: <PlaygroundPage /> }]
  : [];

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <RootLayout />,
      children: [
        {
          index: true,
          element: <HomePage />,
        },
        {
          path: 'search',
          element: <SearchPage />,
        },
        {
          path: 'plugins/:slug',
          element: <PluginPage />,
        },
        {
          path: 'versions/:slug/:version',
          element: <VersionPage />,
        },
        {
          path: 'authors',
          element: <AuthorsPage />,
        },
        {
          path: 'about',
          element: <AboutPage />,
        },
        {
          path: 'plugins',
          element: <PluginsPage />,
        },
        {
          path: 'authors/:owner',
          element: <AuthorPage />,
        },
        // Development-only routes
        ...devRoutes,
        {
          path: '*',
          element: <NotFoundPage />,
        },
      ],
    },
  ],
  {
    basename: BASENAME || '/',
  }
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
