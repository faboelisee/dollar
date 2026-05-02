import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Company, Role } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  activeCompanyId: string | null;
  activeCompany: Company | null;
  companies: Company[];
  isAuthenticated: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setActiveCompany: (company: Company) => void;
  setCompanies: (companies: Company[]) => void;
  logout: () => void;
  hasPermission: (module: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeCompanyId: null,
      activeCompany: null,
      companies: [],
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      setActiveCompany: (company) => {
        localStorage.setItem('active_company_id', company.id);
        set({ activeCompany: company, activeCompanyId: company.id });
      },

      setCompanies: (companies) => set({ companies }),

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('active_company_id');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          activeCompany: null,
          activeCompanyId: null,
          companies: [],
          isAuthenticated: false,
        });
      },

      hasPermission: (module, action) => {
        const { user } = get();
        if (!user) return false;
        return user.role.permissions.some(
          (p) => p.module === module && (p.action === action || p.action === '*')
        );
      },
    }),
    {
      name: 'cashflow-auth',
      partialize: (state) => ({
        activeCompanyId: state.activeCompanyId,
        activeCompany: state.activeCompany,
      }),
    }
  )
);
