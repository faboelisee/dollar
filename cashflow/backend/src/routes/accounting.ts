import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getTrialBalance } from '../services/accountingService';

export async function accountingRoutes(app: FastifyInstance) {
  app.get('/accounts', async (req, reply) => {
    const accounts = await prisma.accountingAccount.findMany({
      where: { companyId: req.companyId, isActive: true },
      orderBy: { code: 'asc' },
    });
    return reply.send({ items: accounts });
  });

  app.post('/accounts', async (req, reply) => {
    const { code, name, type, class: cls, parentId } = req.body as {
      code: string; name: string; type: string; class: number; parentId?: string;
    };
    const account = await prisma.accountingAccount.create({
      data: { code, name, type: type as 'ACTIF' | 'PASSIF' | 'CHARGE' | 'PRODUIT', class: cls, parentId, companyId: req.companyId },
    });
    return reply.code(201).send(account);
  });

  app.get('/journals/:type/entries', async (req, reply) => {
    const { type } = req.params as { type: string };
    const { from, to, page = '1' } = req.query as Record<string, string>;

    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId: req.companyId,
        journalType: type.toUpperCase() as 'CAISSE' | 'BANQUE' | 'ACHATS' | 'VENTES' | 'OPERATIONS_DIVERSES',
        ...(from || to ? { date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        }} : {}),
      },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' },
      skip: (Number(page) - 1) * 50,
      take: 50,
    });

    return reply.send({ items: entries });
  });

  app.get('/accounts/:id/ledger', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { from, to } = req.query as { from?: string; to?: string };

    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: id,
        journalEntry: {
          companyId: req.companyId,
          ...(from || to ? { date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          }} : {}),
        },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { date: 'asc' } },
    });

    let runningBalance = 0;
    const ledgerLines = lines.map((l) => {
      runningBalance += Number(l.debit) - Number(l.credit);
      return { ...l, runningBalance };
    });

    return reply.send({ lines: ledgerLines });
  });

  app.get('/trial-balance', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();

    const balance = await getTrialBalance(req.companyId, fromDate, toDate);
    return reply.send({ items: balance });
  });

  app.get('/cash-flow', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();

    const [inflows, outflows] = await Promise.all([
      prisma.operation.aggregate({
        where: {
          companyId: req.companyId,
          status: 'VALIDE',
          type: { in: ['ENCAISSEMENT', 'RECETTE'] },
          date: { gte: fromDate, lte: toDate },
        },
        _sum: { amountBaseCurrency: true },
      }),
      prisma.operation.aggregate({
        where: {
          companyId: req.companyId,
          status: 'VALIDE',
          type: { in: ['DECAISSEMENT', 'DEPENSE', 'AVANCE'] },
          date: { gte: fromDate, lte: toDate },
        },
        _sum: { amountBaseCurrency: true },
      }),
    ]);

    const totalInflows = Number(inflows._sum.amountBaseCurrency ?? 0);
    const totalOutflows = Number(outflows._sum.amountBaseCurrency ?? 0);

    return reply.send({
      totalInflows,
      totalOutflows,
      netCashFlow: totalInflows - totalOutflows,
      period: { from: fromDate, to: toDate },
    });
  });
}
