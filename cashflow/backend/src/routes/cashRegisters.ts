import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auditLog } from '../services/auditService';
import { generateClosurePdf } from '../services/pdfService';
import { notifyCompany } from '../services/notificationService';

const createSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['PRINCIPALE', 'ANNEXE', 'COFFRE']).default('PRINCIPALE'),
  currency: z.enum(['XOF', 'EUR', 'USD', 'GBP', 'XAF']).default('XOF'),
  minimumBalance: z.number().default(0),
  branchId: z.string().uuid().optional(),
});

const closeSchema = z.object({
  physicalBalance: z.number(),
  signature: z.string().optional(),
  notes: z.string().optional(),
});

const reopenSchema = z.object({
  reason: z.string().min(10),
});

export async function cashRegistersRoutes(app: FastifyInstance) {
  // Get balance for a cash register
  app.get('/:id/balance', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { date } = req.query as { date?: string };

    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id, companyId: req.companyId },
    });
    if (!cashRegister) return reply.code(404).send({ error: 'Caisse introuvable' });

    let balance = await prisma.cashRegisterBalance.findFirst({
      where: { cashRegisterId: id, date: new Date(dateStr) },
    });

    if (!balance) {
      // Compute balance from operations
      const agg = await prisma.operation.aggregate({
        where: {
          cashRegisterId: id,
          status: 'VALIDE',
          date: { lte: new Date(dateStr) },
        },
        _sum: { amountBaseCurrency: true },
      });

      const inflows = await prisma.operation.aggregate({
        where: {
          cashRegisterId: id,
          status: 'VALIDE',
          type: { in: ['ENCAISSEMENT', 'RECETTE'] },
          date: { equals: new Date(dateStr) },
        },
        _sum: { amountBaseCurrency: true },
      });

      const outflows = await prisma.operation.aggregate({
        where: {
          cashRegisterId: id,
          status: 'VALIDE',
          type: { in: ['DECAISSEMENT', 'DEPENSE', 'AVANCE'] },
          date: { equals: new Date(dateStr) },
        },
        _sum: { amountBaseCurrency: true },
      });

      balance = await prisma.cashRegisterBalance.create({
        data: {
          cashRegisterId: id,
          date: new Date(dateStr),
          openingBalance: 0,
          totalInflows: Number(inflows._sum.amountBaseCurrency ?? 0),
          totalOutflows: Number(outflows._sum.amountBaseCurrency ?? 0),
          theoreticalBalance: Number(agg._sum.amountBaseCurrency ?? 0),
          status: 'OUVERT',
        },
      });
    }

    return reply.send({ cashRegister, balance });
  });

  // Close cash register
  app.post('/:id/close', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { physicalBalance, signature, notes } = closeSchema.parse(req.body);

    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id, companyId: req.companyId },
    });
    if (!cashRegister) return reply.code(404).send({ error: 'Caisse introuvable' });

    const today = new Date().toISOString().split('T')[0];
    const balance = await prisma.cashRegisterBalance.findFirst({
      where: { cashRegisterId: id, date: new Date(today) },
    });

    if (!balance) {
      return reply.code(400).send({ error: 'Aucun solde journalier à clôturer' });
    }

    if (balance.status === 'CLOTURE') {
      return reply.code(409).send({ error: 'Cette caisse est déjà clôturée pour aujourd\'hui' });
    }

    const variance = physicalBalance - Number(balance.theoreticalBalance);
    const toleranceOk = Math.abs(variance) <= 500; // 500 FCFA tolerance

    const updated = await prisma.cashRegisterBalance.update({
      where: { id: balance.id },
      data: {
        physicalBalance,
        variance,
        status: 'CLOTURE',
        closedAt: new Date(),
        closedByUserId: req.userId,
        signature,
      },
    });

    if (!toleranceOk) {
      await notifyCompany(req.companyId, {
        type: 'ECART_CAISSE',
        severity: Math.abs(variance) > 5000 ? 'CRITICAL' : 'WARNING',
        message: `Écart de caisse détecté : ${variance > 0 ? '+' : ''}${variance.toLocaleString('fr-CI')} FCFA sur la caisse "${cashRegister.name}"`,
      });
    }

    await auditLog({
      userId: req.userId,
      companyId: req.companyId,
      action: 'CLOSE_CASH_REGISTER',
      entityType: 'cash_register_balance',
      entityId: balance.id,
      afterData: { physicalBalance, variance, status: 'CLOTURE' },
      ipAddress: req.ip,
    });

    const pdf = await generateClosurePdf(cashRegister, updated);

    return reply.send({ balance: updated, variance, toleranceOk, pdfBase64: pdf.toString('base64') });
  });

  // Reopen cash register (restricted to senior roles)
  app.post('/:id/reopen', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = reopenSchema.parse(req.body);

    const today = new Date().toISOString().split('T')[0];
    const balance = await prisma.cashRegisterBalance.findFirst({
      where: {
        cashRegisterId: id,
        date: new Date(today),
        status: 'CLOTURE',
        cashRegister: { companyId: req.companyId },
      },
    });

    if (!balance) {
      return reply.code(404).send({ error: 'Aucune clôture trouvée pour aujourd\'hui' });
    }

    await prisma.cashRegisterBalance.update({
      where: { id: balance.id },
      data: { status: 'OUVERT', closedAt: null, physicalBalance: null, variance: null },
    });

    await auditLog({
      userId: req.userId,
      companyId: req.companyId,
      action: 'REOPEN_CASH_REGISTER',
      entityType: 'cash_register_balance',
      entityId: balance.id,
      afterData: { reason, status: 'OUVERT' },
      ipAddress: req.ip,
    });

    return reply.send({ success: true, reason });
  });

  // Get closure history
  app.get('/:id/closures', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { from, to, page = '1', limit = '30' } = req.query as Record<string, string>;

    const closures = await prisma.cashRegisterBalance.findMany({
      where: {
        cashRegisterId: id,
        cashRegister: { companyId: req.companyId },
        status: 'CLOTURE',
        ...(from || to ? { date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        }} : {}),
      },
      orderBy: { date: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    return reply.send({ items: closures });
  });
}
