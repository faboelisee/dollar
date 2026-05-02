'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Users,
  UserCog,
  BookOpen,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
  CreditCard,
  Package,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: { module: string; action: string };
  children?: Omit<NavItem, 'children'>[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Tableau de bord',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Caisse',
    href: '/operations',
    icon: Wallet,
    children: [
      { label: 'Encaissements', href: '/operations/encaissements', icon: TrendingUp },
      { label: 'Décaissements', href: '/operations/decaissements', icon: TrendingDown },
      { label: 'Transferts', href: '/operations/transferts', icon: ArrowLeftRight },
      { label: 'Clôture de caisse', href: '/operations/cloture', icon: Package },
      { label: 'Historique', href: '/operations/historique', icon: FileText },
    ],
  },
  {
    label: 'Banque',
    href: '/bank',
    icon: Building2,
    permission: { module: 'bank', action: 'read' },
  },
  {
    label: 'Avances & Dépenses',
    href: '/avances',
    icon: CreditCard,
  },
  {
    label: 'Contacts',
    href: '/contacts',
    icon: Users,
    children: [
      { label: 'Clients', href: '/contacts/clients', icon: Users },
      { label: 'Fournisseurs', href: '/contacts/fournisseurs', icon: UserCog },
      { label: 'Employés', href: '/contacts/employes', icon: UserCog },
    ],
  },
  {
    label: 'Comptabilité',
    href: '/accounting',
    icon: BookOpen,
    permission: { module: 'accounting', action: 'read' },
  },
  {
    label: 'Rapports',
    href: '/reports',
    icon: BarChart3,
    permission: { module: 'reports', action: 'read' },
  },
  {
    label: 'Administration',
    href: '/settings',
    icon: Settings,
    permission: { module: 'settings', action: 'read' },
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, unreadCount } = useUiStore();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const canView = (item: NavItem) => {
    if (!item.permission) return true;
    return hasPermission(item.permission.module, item.permission.action);
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-[#1B4F72] text-white transition-all duration-300 fixed left-0 top-0 z-40',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-blue-700">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2E86AB] rounded-lg flex items-center justify-center font-bold text-sm">
              CF
            </div>
            <span className="font-bold text-lg tracking-tight">CashFlow CI</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-blue-700 transition-colors ml-auto"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_ITEMS.filter(canView).map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            isActive={isActive}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-blue-700 p-3">
        {!sidebarCollapsed && user && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#2E86AB] flex items-center justify-center text-sm font-semibold">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-blue-300 truncate">{user.role.name}</p>
            </div>
          </div>
        )}
        <div className="flex gap-1">
          <button
            className="relative p-2 rounded hover:bg-blue-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={logout}
            className="p-2 rounded hover:bg-blue-700 transition-colors"
            aria-label="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItemComponent({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: (href: string) => boolean;
  collapsed: boolean;
}) {
  const active = isActive(item.href);
  const Icon = item.icon;

  if (item.children && !collapsed) {
    return (
      <div className="mb-1">
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 text-sm font-medium',
            active ? 'text-white' : 'text-blue-200'
          )}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          <span>{item.label}</span>
        </div>
        <div className="ml-4 border-l border-blue-700 pl-2">
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
                  isActive(child.href)
                    ? 'bg-[#2E86AB] text-white'
                    : 'text-blue-200 hover:bg-blue-700 hover:text-white'
                )}
              >
                <ChildIcon className="h-4 w-4 flex-shrink-0" />
                {child.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mx-2 mb-1 transition-colors',
        active
          ? 'bg-[#2E86AB] text-white'
          : 'text-blue-200 hover:bg-blue-700 hover:text-white',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}
