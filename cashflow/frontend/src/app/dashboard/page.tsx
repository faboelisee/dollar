'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Wallet, Building2,
  Clock, AlertTriangle, Plus, RefreshCw,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { formatCurrency, formatRelative, cn } from '@/lib/utils';
import { FluxChart } from '@/components/charts/FluxChart';
import { ExpenseDonut } from '@/components/charts/ExpenseDonut';
import { useAuthStore } from '@/store/auth';
import type { DashboardStats, CashBalanceSummary } from '@/types';

type Period = '7j' | '30j' | '90j';

export default function DashboardPage() {
  const { activeCompanyId, activeCompany } = useAuthStore();
  const [period, setPeriod] = useState<Period>('7j');

  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', activeCompanyId, period],
    queryFn: () =>
      dashboardApi.getStats(activeCompanyId!, period).then((r) => r.data),
    enabled: !!activeCompanyId,
    refetchInterval: 60_000,
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeCompany?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['7j', '30j', '90j'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  period === p
                    ? 'bg-white text-[#1B4F72] shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#1B4F72] text-white rounded-lg text-sm hover:bg-[#2E86AB] transition-colors font-medium">
            <Plus className="h-4 w-4" />
            Nouvelle opération
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Solde total caisse"
          value={stats?.totalCashBalance ?? 0}
          icon={Wallet}
          color="blue"
          isLoading={isLoading}
        />
        <KpiCard
          label="Encaissements du jour"
          value={stats?.todayInflows ?? 0}
          icon={TrendingUp}
          color="green"
          positive
          isLoading={isLoading}
        />
        <KpiCard
          label="Décaissements du jour"
          value={stats?.todayOutflows ?? 0}
          icon={TrendingDown}
          color="red"
          isLoading={isLoading}
        />
        <KpiCard
          label="Solde bancaire"
          value={stats?.bankBalance ?? 0}
          icon={Building2}
          color="purple"
          isLoading={isLoading}
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Flux chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Flux de trésorerie — {period}
          </h2>
          {isLoading ? (
            <div className="h-64 animate-pulse bg-gray-100 rounded-lg" />
          ) : (
            <FluxChart data={stats?.fluxChart ?? []} />
          )}
        </div>

        {/* Alerts & pending */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Alertes actives</h2>
            {(stats?.activeAlerts.length ?? 0) > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                {stats?.activeAlerts.length}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {isLoading
              ? Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse bg-gray-100 rounded-lg" />
                ))
              : stats?.activeAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-2 p-3 rounded-lg text-sm',
                      alert.severity === 'critical' && 'bg-red-50 border border-red-200',
                      alert.severity === 'warning' && 'bg-amber-50 border border-amber-200',
                      alert.severity === 'info' && 'bg-blue-50 border border-blue-200'
                    )}
                  >
                    <AlertTriangle className={cn(
                      'h-4 w-4 flex-shrink-0 mt-0.5',
                      alert.severity === 'critical' && 'text-red-500',
                      alert.severity === 'warning' && 'text-amber-500',
                      alert.severity === 'info' && 'text-blue-500',
                    )} />
                    <div>
                      <p className="text-gray-700">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatRelative(alert.createdAt)}</p>
                    </div>
                  </div>
                ))}
            {!isLoading && !stats?.activeAlerts.length && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Aucune alerte active
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cash registers + Expense stats */}
      <div className="grid grid-cols-3 gap-6">
        {/* Cash registers */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">État des caisses</h2>
            <span className="text-xs text-gray-500">
              {stats?.cashBalances.length ?? 0} caisse(s)
            </span>
          </div>
          <div className="space-y-3">
            {isLoading
              ? Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse bg-gray-100 rounded-lg" />
                ))
              : stats?.cashBalances.map((cb) => (
                  <CashRegisterRow key={cb.cashRegisterId} data={cb} />
                ))}
          </div>
        </div>

        {/* Expense donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Dépenses par catégorie
          </h2>
          {isLoading ? (
            <div className="h-48 animate-pulse bg-gray-100 rounded-lg" />
          ) : (
            <ExpenseDonut data={stats?.topExpenses ?? []} />
          )}
        </div>
      </div>

      {/* Pending validations */}
      {(stats?.pendingValidations ?? 0) > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-800">
                {stats?.pendingValidations} opération(s) en attente de validation
              </p>
              <p className="text-sm text-amber-600">
                Ces opérations nécessitent votre approbation
              </p>
            </div>
          </div>
          <button className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors font-medium">
            Voir les opérations
          </button>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, color, positive, isLoading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'red' | 'purple';
  positive?: boolean;
  isLoading?: boolean;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {isLoading ? (
        <div className="h-7 w-3/4 animate-pulse bg-gray-100 rounded" />
      ) : (
        <p className="text-2xl font-bold text-gray-900 font-mono">
          {formatCurrency(value)}
        </p>
      )}
    </div>
  );
}

function CashRegisterRow({ data }: { data: CashBalanceSummary }) {
  const pct = Math.min((data.balance / (data.minimumBalance * 3)) * 100, 100);

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div
        className={cn(
          'w-2.5 h-2.5 rounded-full flex-shrink-0',
          data.status === 'ok' && 'bg-green-400',
          data.status === 'bas' && 'bg-amber-400',
          data.status === 'critique' && 'bg-red-500',
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 truncate">{data.name}</span>
          <span className="text-sm font-bold text-gray-900 font-mono ml-2">
            {formatCurrency(data.balance, data.currency)}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all',
              data.status === 'ok' && 'bg-green-400',
              data.status === 'bas' && 'bg-amber-400',
              data.status === 'critique' && 'bg-red-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
