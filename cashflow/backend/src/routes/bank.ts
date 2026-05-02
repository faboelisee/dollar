import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const createAccountSchema = z.object({
  bankName: z.string().min(2),
  accountNumber: z.string().min(5),
  rib: z.string().optional(),
  iban: z.string().optional(),
  currency: z.enum(['XOF', 'EUR', 'USD', 'GBP', 'XAF']).default('XOF'),
  currentBalance: z.number().default(0),
});

export async function bankRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const accounts = await prisma.bankAccount.findMany({
      where: { companyId: req.companyId, isActive: true },
    });
    return reply.send({ items: accounts });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const account = await prisma.bankAccount.findFirst({
      where: { id, companyId: req.companyId },
      include: {
        transactions: { orderBy: { date: 'desc' }, take: 30 },
      },
    });
    if (!account) return reply.code(404).send({ error: 'Compte bancaire introuvable' });
    return reply.send(account);
  });

  app.post('/', async (req, reply) => {
    const data = createAccountSchema.parse(req.body);
    const account = await prisma.bankAccount.create({
      data: { ...data, companyId: req.companyId },
    });
    return reply.code(201).send(account);
  });

  app.get('/:id/transactions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { from, to, page = '1' } = req.query as Record<string, string>;

    const txs = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId: id,
        bankAccount: { companyId: req.companyId },
        ...(from || to ? { date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        }} : {}),
      },
      orderBy: { date: 'desc' },
      skip: (Number(page) - 1) * 50,
      take: 50,
    });

    return reply.send({ items: txs });
  });

  app.post('/:id/reconcile', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { transactionIds } = req.body as { transactionIds: string[] };

    await prisma.bankTransaction.updateMany({
      where: { id: { in: transactionIds }, bankAccountId: id },
      data: { isReconciled: true },
    });

    return reply.send({ success: true, reconciled: transactionIds.length });
  });
}
