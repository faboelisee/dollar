import { prisma } from '../lib/prisma';

interface AuditParams {
  userId: string;
  companyId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string;
}

export async function auditLog(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      companyId: params.companyId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeData: params.beforeData ? JSON.parse(JSON.stringify(params.beforeData)) : undefined,
      afterData: params.afterData ? JSON.parse(JSON.stringify(params.afterData)) : undefined,
      ipAddress: params.ipAddress,
    },
  });
}
