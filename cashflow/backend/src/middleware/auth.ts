import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    companyId: string;
    tenantId: string;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();

    const payload = request.user as { sub: string; tenantId: string };
    request.userId = payload.sub;
    request.tenantId = payload.tenantId;

    const companyId = request.headers['x-company-id'] as string;
    if (companyId) {
      // Verify user has access to this company
      const access = await prisma.userCompanyRole.findFirst({
        where: { userId: request.userId, companyId },
      });
      if (!access) {
        return reply.code(403).send({ error: 'Accès refusé à cette entreprise' });
      }
      request.companyId = companyId;
    }
  } catch {
    return reply.code(401).send({ error: 'Non authentifié' });
  }
}
