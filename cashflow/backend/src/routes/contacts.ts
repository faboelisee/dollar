import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const createContactSchema = z.object({
  type: z.enum(['CLIENT', 'FOURNISSEUR', 'EMPLOYE', 'AUTRE']),
  name: z.string().min(2),
  rccm: z.string().optional(),
  nif: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.number().optional(),
  paymentDelay: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function contactsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const { type, search, page = '1', limit = '50' } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { companyId: req.companyId, isActive: true };
    if (type) where.type = type;
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { nif: { contains: search } },
    ];

    const [total, items] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        include: { balance: true },
        orderBy: { name: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);

    return reply.send({ items, total });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const contact = await prisma.contact.findFirst({
      where: { id, companyId: req.companyId },
      include: {
        balance: true,
        operations: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { category: true, cashRegister: true },
        },
      },
    });
    if (!contact) return reply.code(404).send({ error: 'Contact introuvable' });
    return reply.send(contact);
  });

  app.post('/', async (req, reply) => {
    const data = createContactSchema.parse(req.body);
    const contact = await prisma.contact.create({
      data: { ...data, companyId: req.companyId },
    });
    await prisma.contactBalance.create({
      data: { contactId: contact.id },
    });
    return reply.code(201).send(contact);
  });

  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = createContactSchema.partial().parse(req.body);
    const contact = await prisma.contact.findFirst({
      where: { id, companyId: req.companyId },
    });
    if (!contact) return reply.code(404).send({ error: 'Contact introuvable' });
    const updated = await prisma.contact.update({ where: { id }, data });
    return reply.send(updated);
  });

  app.get('/:id/statement', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { from, to } = req.query as { from?: string; to?: string };

    const ops = await prisma.operation.findMany({
      where: {
        contactId: id,
        companyId: req.companyId,
        status: 'VALIDE',
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          }
        } : {}),
      },
      include: { category: true, cashRegister: true },
      orderBy: { date: 'asc' },
    });

    const totalIn = ops
      .filter((o) => ['ENCAISSEMENT', 'RECETTE'].includes(o.type))
      .reduce((s, o) => s + Number(o.amountBaseCurrency), 0);

    const totalOut = ops
      .filter((o) => ['DECAISSEMENT', 'DEPENSE'].includes(o.type))
      .reduce((s, o) => s + Number(o.amountBaseCurrency), 0);

    return reply.send({ operations: ops, totalIn, totalOut, netBalance: totalIn - totalOut });
  });
}
