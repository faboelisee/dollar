import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/:companyId/dashboard', async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    const { period = '7j' } = req.query as { period?: string };

    const days = period === '90j' ? 90 : period === '30j' ? 30 : 7;
    const from = startOfDay(subDays(new Date(), days));
    const to = endOfDay(new Date());
    const today = startOfDay(new Date());

    const [
      cashRegisters,
      todayInflows,
      todayOutflows,
      bankAccounts,
      pendingValidations,
      alerts,
      fluxData,
      topExpenses,
    ] = await Promise.all([
      prisma.cashRegister.findMany({
        where: { companyId, isActive: true },
        include: {
          balances: {
            where: { date: today },
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
      }),

      prisma.operation.aggregate({
        where: {
          companyId,
          status: 'VALIDE',
          type: { in: ['ENCAISSEMENT', 'RECETTE'] },
          date: { gte: today, lte: to },
        },
        _sum: { amountBaseCurrency: true },
      }),

      prisma.operation.aggregate({
        where: {
          companyId,
          status: 'VALIDE',
          type: { in: ['DECAISSEMENT', 'DEPENSE', 'AVANCE'] },
          date: { gte: today, lte: to },
        },
        _sum: { amountBaseCurrency: true },
      }),

      prisma.bankAccount.findMany({
        where: { companyId, isActive: true },
        select: { currentBalance: true },
      }),

      prisma.operation.count({
        where: { companyId, status: 'EN_ATTENTE' },
      }),

      prisma.alert.findMany({
        where: { companyId, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Flux chart data by day
      prisma.$queryRaw<Array<{ date: Date; inflows: number; outflows: number }>>`
        SELECT
          DATE(date) as date,
          SUM(CASE WHEN type IN ('ENCAISSEMENT', 'RECETTE') THEN amount_base_currency ELSE 0 END) as inflows,
          SUM(CASE WHEN type IN ('DECAISSEMENT', 'DEPENSE', 'AVANCE') THEN amount_base_currency ELSE 0 END) as outflows
        FROM operations
        WHERE company_id = ${companyId}
          AND status = 'VALIDE'
          AND date >= ${from}
          AND date <= ${to}
        GROUP BY DATE(date)
        ORDER BY DATE(date)
      `,

      // Top expense categories
      prisma.operation.groupBy({
        by: ['categoryId'],
        where: {
          companyId,
          status: 'VALIDE',
          type: { in: ['DECAISSEMENT', 'DEPENSE'] },
          date: { gte: from, lte: to },
        },
        _sum: { amountBaseCurrency: true },
        _count: true,
        orderBy: { _sum: { amountBaseCurrency: 'desc' } },
        take: 5,
      }),
    ]);

    // Build cash balances summary
    const totalCashBalance = cashRegisters.reduce((sum, cr) => {
      const balance = cr.balances[0];
      return sum + Number(balance?.theoreticalBalance ?? 0);
    }, 0);

    const cashBalances = cashRegisters.map((cr) => {
      const balance = Number(cr.balances[0]?.theoreticalBalance ?? 0);
      const min = Number(cr.minimumBalance);
      const status = balance >= min ? 'ok' : balance >= min * 0.5 ? 'bas' : 'critique';
      return {
        cashRegisterId: cr.id,
        name: cr.name,
        currency: cr.currency,
        balance,
        minimumBalance: min,
        status,
      };
    });

    const bankBalance = bankAccounts.reduce(
      (sum, ba) => sum + Number(ba.currentBalance),
      0
    );

    // Build flux chart with running balance
    let runningBalance = totalCashBalance;
    const fluxChart = fluxData.map((d) => {
      const inflows = Number(d.inflows);
      const outflows = Number(d.outflows);
      runningBalance = runningBalance + inflows - outflows;
      return {
        date: d.date.toISOString().split('T')[0],
        inflows,
        outflows,
        balance: runningBalance,
      };
    });

    // Load category details for top expenses
    const categoryIds = topExpenses.map((t) => t.categoryId);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const totalExpense = topExpenses.reduce(
      (s, e) => s + Number(e._sum.amountBaseCurrency ?? 0),
      0
    );

    const topExpensesFormatted = topExpenses.map((e) => {
      const cat = catMap.get(e.categoryId);
      const amount = Number(e._sum.amountBaseCurrency ?? 0);
      return {
        categoryId: e.categoryId,
        categoryName: cat?.name ?? 'Autre',
        color: cat?.color ?? '#2E86AB',
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
        count: e._count,
      };
    });

    return reply.send({
      cashBalances,
      totalCashBalance,
      todayInflows: Number(todayInflows._sum.amountBaseCurrency ?? 0),
      todayOutflows: Number(todayOutflows._sum.amountBaseCurrency ?? 0),
      bankBalance,
      pendingValidations,
      activeAlerts: alerts,
      fluxChart,
      topExpenses: topExpensesFormatted,
    });
  });

  app.get('/:companyId/alerts', async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    const alerts = await prisma.alert.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return reply.send({ items: alerts });
  });
}
