import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { generateReference } from '../lib/utils';
import { createJournalEntry } from '../services/accountingService';
import { notifyCompany } from '../services/notificationService';
import { auditLog } from '../services/auditService';
import { generateOperationPdf } from '../services/pdfService';

const createOperationSchema = z.object({
  type: z.enum(['ENCAISSEMENT', 'DECAISSEMENT', 'AVANCE', 'DEPENSE', 'RECETTE', 'TRANSFERT']),
  cashRegisterId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.enum(['XOF', 'EUR', 'USD', 'GBP', 'XAF']).default('XOF'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(3).max(500),
  paymentMethod: z.enum(['ESPECES', 'ORANGE_MONEY', 'MTN_MOMO', 'WAVE', 'MOOV_MONEY', 'CHEQUE', 'VIREMENT', 'CARTE']).default('ESPECES'),
  categoryId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().optional(),
  targetCashRegisterId: z.string().uuid().optional(),
  reference: z.string().optional(),
  valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const filterSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(200).default(20),
  type: z.string().optional(),
  status: z.string().optional(),
  cashRegisterId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});

const validationSchema = z.object({
  comment: z.string().optional(),
});

const rejectSchema = z.object({
  comment: z.string().min(5, 'Motif de rejet requis'),
});

const cancelSchema = z.object({
  reason: z.string().min(5, 'Motif d\'annulation requis'),
});

export async function operationsRoutes(app: FastifyInstance) {
  // List operations
  app.get('/', async (req, reply) => {
    const filters = filterSchema.parse(req.query);
    const companyId = req.companyId;

    const where: Record<string, unknown> = { companyId };
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.cashRegisterId) where.cashRegisterId = filters.cashRegisterId;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) (where.date as Record<string, Date>).gte = new Date(filters.from);
      if (filters.to) (where.date as Record<string, Date>).lte = new Date(filters.to);
    }
    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.minAmount || filters.maxAmount) {
      where.amount = {};
      if (filters.minAmount) (where.amount as Record<string, number>).gte = filters.minAmount;
      if (filters.maxAmount) (where.amount as Record<string, number>).lte = filters.maxAmount;
    }

    const [total, items] = await Promise.all([
      prisma.operation.count({ where }),
      prisma.operation.findMany({
        where,
        include: {
          category: true,
          contact: true,
          cashRegister: { select: { id: true, name: true, currency: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);

    return reply.send({
      items,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    });
  });

  // Get single operation
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const operation = await prisma.operation.findFirst({
      where: { id, companyId: req.companyId },
      include: {
        category: true,
        contact: true,
        employee: true,
        cashRegister: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true } },
        validations: true,
        journalEntry: { include: { lines: { include: { account: true } } } },
      },
    });

    if (!operation) return reply.code(404).send({ error: 'Opération introuvable' });
    return reply.send(operation);
  });

  // Create operation
  app.post('/', async (req, reply) => {
    const data = createOperationSchema.parse(req.body);

    // Verify cash register belongs to company
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id: data.cashRegisterId, companyId: req.companyId },
    });
    if (!cashRegister) {
      return reply.code(404).send({ error: 'Caisse introuvable' });
    }

    // Determine initial status based on validation rules
    const validationThreshold = await getValidationThreshold(req.companyId);
    const status = data.amount >= validationThreshold ? 'EN_ATTENTE' : 'VALIDE';

    const reference = data.reference ?? generateReference(data.type.slice(0, 3));

    const operation = await prisma.operation.create({
      data: {
        ...data,
        reference,
        amountBaseCurrency: data.amount,
        companyId: req.companyId,
        status,
        createdById: req.userId,
        date: new Date(data.date),
        valueDate: data.valueDate ? new Date(data.valueDate) : undefined,
      },
      include: { category: true, contact: true, cashRegister: true },
    });

    // Auto-create journal entry for validated operations
    if (status === 'VALIDE') {
      await createJournalEntry(operation);
    }

    // Notify supervisors if pending validation
    if (status === 'EN_ATTENTE') {
      await notifyCompany(req.companyId, {
        type: 'OPERATION_EN_ATTENTE',
        severity: 'WARNING',
        message: `Nouvelle opération de ${data.amount.toLocaleString('fr-CI')} FCFA en attente de validation`,
      });
    }

    await auditLog({
      userId: req.userId,
      companyId: req.companyId,
      action: 'CREATE_OPERATION',
      entityType: 'operation',
      entityId: operation.id,
      afterData: operation,
      ipAddress: req.ip,
    });

    // Emit real-time event
    (app as FastifyInstance & { io: { to: (room: string) => { emit: (event: string, data: unknown) => void } } })
      .io.to(`company:${req.companyId}`).emit('operation:created', operation);

    return reply.code(201).send(operation);
  });

  // Validate operation
  app.post('/:id/validate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { comment } = validationSchema.parse(req.body);

    const operation = await prisma.operation.findFirst({
      where: { id, companyId: req.companyId, status: 'EN_ATTENTE' },
    });

    if (!operation) {
      return reply.code(404).send({ error: 'Opération introuvable ou non validable' });
    }

    const updated = await prisma.operation.update({
      where: { id },
      data: { status: 'VALIDE', validatedById: req.userId, validatedAt: new Date() },
    });

    await prisma.operationValidation.create({
      data: { operationId: id, validatorId: req.userId, action: 'VALIDE', comment, level: 1 },
    });

    await createJournalEntry(updated);

    await auditLog({
      userId: req.userId,
      companyId: req.companyId,
      action: 'VALIDATE_OPERATION',
      entityType: 'operation',
      entityId: id,
      beforeData: { status: 'EN_ATTENTE' },
      afterData: { status: 'VALIDE' },
      ipAddress: req.ip,
    });

    return reply.send(updated);
  });

  // Reject operation
  app.post('/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { comment } = rejectSchema.parse(req.body);

    const operation = await prisma.operation.findFirst({
      where: { id, companyId: req.companyId, status: 'EN_ATTENTE' },
    });

    if (!operation) {
      return reply.code(404).send({ error: 'Opération introuvable ou non rejetable' });
    }

    const updated = await prisma.operation.update({
      where: { id },
      data: { status: 'REJETE' },
    });

    await prisma.operationValidation.create({
      data: { operationId: id, validatorId: req.userId, action: 'REJETE', comment, level: 1 },
    });

    return reply.send(updated);
  });

  // Cancel operation
  app.post('/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = cancelSchema.parse(req.body);

    const operation = await prisma.operation.findFirst({
      where: { id, companyId: req.companyId },
    });

    if (!operation || operation.status === 'ANNULE') {
      return reply.code(404).send({ error: 'Opération introuvable ou déjà annulée' });
    }

    const updated = await prisma.operation.update({
      where: { id },
      data: {
        status: 'ANNULE',
        cancelledById: req.userId,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    return reply.send(updated);
  });

  // Upload attachment
  app.post('/:id/attachments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'Fichier manquant' });

    // TODO: upload to cloud storage and update operation attachments
    const fileUrl = `/uploads/${id}/${data.filename}`;

    const operation = await prisma.operation.findFirst({
      where: { id, companyId: req.companyId },
      select: { attachments: true },
    });

    if (!operation) return reply.code(404).send({ error: 'Opération introuvable' });

    const attachments = (operation.attachments as unknown[]) ?? [];
    attachments.push({
      id: crypto.randomUUID(),
      name: data.filename,
      url: fileUrl,
      type: data.mimetype,
      size: data.file.readableLength ?? 0,
    });

    await prisma.operation.update({ where: { id }, data: { attachments } });

    return reply.send({ url: fileUrl });
  });

  // Export PDF
  app.get('/export/pdf', async (req, reply) => {
    const filters = filterSchema.parse(req.query);
    // TODO: generate PDF from operations list
    const pdf = await generateOperationPdf(req.companyId, filters);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="operations.pdf"');
    return reply.send(pdf);
  });
}

async function getValidationThreshold(companyId: string): Promise<number> {
  // Default threshold: 500,000 FCFA — should be configurable per company
  return 500_000;
}
