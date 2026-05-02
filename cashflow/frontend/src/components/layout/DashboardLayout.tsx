'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useUiStore } from '@/store/ui';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { sidebarCollapsed } = useUiStore();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main
        className={cn(
          'flex-1 overflow-auto transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        {children}
      </main>
    </div>
  );
}
