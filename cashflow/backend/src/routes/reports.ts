import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { generateClosurePdf } from '../services/pdfService';

export async function reportsRoutes(app: FastifyInstance) {
  app.get('/daily-cash/:cashRegisterId', async (req, reply) => {
    const { cashRegisterId } = req.params as { cashRegisterId: string };
    const { date } = req.query as { date?: string };

    const targetDate = date ? new Date(date) : new Date();

    const [cashRegister, balance, operations] = await Promise.all([
      prisma.cashRegister.findFirst({
        where: { id: cashRegisterId, companyId: req.companyId },
      }),
      prisma.cashRegisterBalance.findFirst({
        where: { cashRegisterId, date: targetDate },
      }),
      prisma.operation.findMany({
        where: {
          cashRegisterId,
          date: targetDate,
          status: 'VALIDE',
        },
        include: { category: true, contact: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!cashRegister) return reply.code(404).send({ error: 'Caisse introuvable' });

    const summary = {
      cashRegister,
      balance,
      operations,
      totalIn: operations
        .filter((o) => ['ENCAISSEMENT', 'RECETTE'].includes(o.type))
        .reduce((s, o) => s + Number(o.amountBaseCurrency), 0),
      totalOut: operations
        .filter((o) => ['DECAISSEMENT', 'DEPENSE', 'AVANCE'].includes(o.type))
        .reduce((s, o) => s + Number(o.amountBaseCurrency), 0),
    };

    return reply.send(summary);
  });

  app.get('/daily-cash/:cashRegisterId/pdf', async (req, reply) => {
    const { cashRegisterId } = req.params as { cashRegisterId: string };
    const { date } = req.query as { date?: string };

    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, companyId: req.companyId },
    });
    const balance = await prisma.cashRegisterBalance.findFirst({
      where: { cashRegisterId, date: date ? new Date(date) : new Date() },
    });

    if (!cashRegister || !balance) {
      return reply.code(404).send({ error: 'Données introuvables' });
    }

    const pdf = await generateClosurePdf(cashRegister, balance);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="cloture-${cashRegister.name}-${date}.pdf"`);
    return reply.send(pdf);
  });

  app.get('/expense-stats', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string };

    const stats = await prisma.operation.groupBy({
      by: ['categoryId'],
      where: {
        companyId: req.companyId,
        status: 'VALIDE',
        type: { in: ['DECAISSEMENT', 'DEPENSE'] },
        ...(from || to ? { date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        }} : {}),
      },
      _sum: { amountBaseCurrency: true },
      _count: true,
    });

    const categoryIds = stats.map((s) => s.categoryId);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const total = stats.reduce((s, e) => s + Number(e._sum.amountBaseCurrency ?? 0), 0);

    return reply.send({
      items: stats.map((s) => {
        const cat = catMap.get(s.categoryId);
        const amount = Number(s._sum.amountBaseCurrency ?? 0);
        return {
          categoryId: s.categoryId,
          categoryName: cat?.name ?? 'Autre',
          color: cat?.color ?? '#2E86AB',
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          count: s._count,
        };
      }),
      total,
    });
  });

  app.get('/kpis', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();

    const [inflows, outflows, variances] = await Promise.all([
      prisma.operation.aggregate({
        where: { companyId: req.companyId, status: 'VALIDE', type: { in: ['ENCAISSEMENT', 'RECETTE'] }, date: { gte: fromDate, lte: toDate } },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.operation.aggregate({
        where: { companyId: req.companyId, status: 'VALIDE', type: { in: ['DECAISSEMENT', 'DEPENSE', 'AVANCE'] }, date: { gte: fromDate, lte: toDate } },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.cashRegisterBalance.count({
        where: {
          cashRegister: { companyId: req.companyId },
          variance: { not: null },
          date: { gte: fromDate, lte: toDate },
        },
      }),
    ]);

    const totalIn = Number(inflows._sum.amountBaseCurrency ?? 0);
    const totalOut = Number(outflows._sum.amountBaseCurrency ?? 0);

    return reply.send({
      liquidityRatio: totalOut > 0 ? totalIn / totalOut : 0,
      averageDso: 0,
      averageDpo: 0,
      recoveryRate: totalIn > 0 ? Math.min((totalIn / (totalIn + totalOut)) * 100, 100) : 0,
      operationalCostRatio: totalIn > 0 ? (totalOut / totalIn) * 100 : 0,
      cashVarianceCount: variances,
    });
  });
}
