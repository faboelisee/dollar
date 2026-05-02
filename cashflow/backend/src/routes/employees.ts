import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const advanceSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(5),
});

export async function employeesRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const employees = await prisma.employee.findMany({
      where: { companyId: req.companyId, isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return reply.send({ items: employees });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const employee = await prisma.employee.findFirst({
      where: { id, companyId: req.companyId },
      include: {
        advances: { where: { status: { notIn: ['REMBOURSE'] } } },
      },
    });
    if (!employee) return reply.code(404).send({ error: 'Employé introuvable' });
    return reply.send(employee);
  });

  app.post('/:id/advances', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { amount, reason } = advanceSchema.parse(req.body);

    const employee = await prisma.employee.findFirst({
      where: { id, companyId: req.companyId },
    });
    if (!employee) return reply.code(404).send({ error: 'Employé introuvable' });

    const advance = await prisma.advance.create({
      data: { employeeId: id, companyId: req.companyId, amount, reason },
    });

    return reply.code(201).send(advance);
  });

  app.get('/:id/advances', async (req, reply) => {
    const { id } = req.params as { id: string };
    const advances = await prisma.advance.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ items: advances });
  });
}
