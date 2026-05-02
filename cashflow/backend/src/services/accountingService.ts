import { prisma } from '../lib/prisma';
import type { Operation } from '@prisma/client';

// SYSCOHADA accounting mappings
const ACCOUNTING_RULES: Record<string, { debitCode: string; creditCode: string }> = {
  // Cash inflows → Debit Cash (571), Credit Customer (411)
  ENCAISSEMENT: { debitCode: '571', creditCode: '411' },
  // Revenue → Debit Cash (571), Credit Revenue (701)
  RECETTE: { debitCode: '571', creditCode: '701' },
  // Cash outflows → Debit Supplier (401), Credit Cash (571)
  DECAISSEMENT: { debitCode: '401', creditCode: '571' },
  // Expense → Debit Expense account (6xx), Credit Cash (571)
  DEPENSE: { debitCode: '624', creditCode: '571' },
  // Advance → Debit Advance receivable (471), Credit Cash (571)
  AVANCE: { debitCode: '471', creditCode: '571' },
};

export async function createJournalEntry(operation: Operation): Promise<void> {
  if (operation.status !== 'VALIDE') return;
  if (operation.journalEntryId) return; // Already has a journal entry

  const rule = ACCOUNTING_RULES[operation.type];
  if (!rule) return;

  // Find accounting accounts
  const [debitAccount, creditAccount] = await Promise.all([
    prisma.accountingAccount.findFirst({
      where: {
        companyId: operation.companyId,
        code: { startsWith: rule.debitCode },
        isActive: true,
      },
    }),
    prisma.accountingAccount.findFirst({
      where: {
        companyId: operation.companyId,
        code: { startsWith: rule.creditCode },
        isActive: true,
      },
    }),
  ]);

  if (!debitAccount || !creditAccount) return;

  const journalType = getJournalType(operation);
  const reference = `${journalType.slice(0, 3)}-${operation.reference}`;

  const entry = await prisma.journalEntry.create({
    data: {
      companyId: operation.companyId,
      journalType,
      date: operation.date,
      reference,
      description: operation.description,
      isBalanced: true,
      createdById: operation.createdById,
      lines: {
        create: [
          {
            accountId: debitAccount.id,
            debit: operation.amountBaseCurrency,
            credit: 0,
            description: operation.description,
            contactId: operation.contactId,
          },
          {
            accountId: creditAccount.id,
            debit: 0,
            credit: operation.amountBaseCurrency,
            description: operation.description,
            contactId: operation.contactId,
          },
        ],
      },
    },
  });

  await prisma.operation.update({
    where: { id: operation.id },
    data: { journalEntryId: entry.id },
  });
}

function getJournalType(
  operation: Operation
): 'CAISSE' | 'BANQUE' | 'ACHATS' | 'VENTES' | 'OPERATIONS_DIVERSES' {
  if (operation.bankAccountId) return 'BANQUE';
  if (operation.type === 'ENCAISSEMENT' || operation.type === 'RECETTE') return 'VENTES';
  if (operation.type === 'DECAISSEMENT') return 'ACHATS';
  return 'CAISSE';
}

export async function getTrialBalance(
  companyId: string,
  from: Date,
  to: Date
): Promise<TrialBalanceLine[]> {
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        companyId,
        date: { gte: from, lte: to },
      },
    },
    include: { account: true },
  });

  const grouped = new Map<string, TrialBalanceLine>();

  for (const line of lines) {
    const key = line.accountId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        accountId: key,
        accountCode: line.account.code,
        accountName: line.account.name,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
      });
    }
    const entry = grouped.get(key)!;
    entry.totalDebit += Number(line.debit);
    entry.totalCredit += Number(line.credit);
    entry.balance = entry.totalDebit - entry.totalCredit;
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.accountCode.localeCompare(b.accountCode)
  );
}

interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export async function seedSyscohadadAccounts(companyId: string): Promise<void> {
  const accounts = [
    { code: '401', name: 'Fournisseurs', type: 'PASSIF', class: 4 },
    { code: '411', name: 'Clients', type: 'ACTIF', class: 4 },
    { code: '421', name: 'Personnel - Rémunérations dues', type: 'PASSIF', class: 4 },
    { code: '431', name: 'Sécurité sociale', type: 'PASSIF', class: 4 },
    { code: '441', name: 'État, impôts et taxes', type: 'PASSIF', class: 4 },
    { code: '443', name: 'TVA collectée', type: 'PASSIF', class: 4 },
    { code: '445', name: 'TVA déductible', type: 'ACTIF', class: 4 },
    { code: '471', name: 'Débiteurs divers', type: 'ACTIF', class: 4 },
    { code: '521', name: 'Banque', type: 'ACTIF', class: 5 },
    { code: '571', name: 'Caisse', type: 'ACTIF', class: 5 },
    { code: '581', name: 'Virement de fonds', type: 'ACTIF', class: 5 },
    { code: '601', name: 'Achats de marchandises', type: 'CHARGE', class: 6 },
    { code: '604', name: 'Achats de fournitures', type: 'CHARGE', class: 6 },
    { code: '621', name: 'Entretien et réparations', type: 'CHARGE', class: 6 },
    { code: '622', name: 'Loyers et charges locatives', type: 'CHARGE', class: 6 },
    { code: '624', name: 'Transport sur ventes', type: 'CHARGE', class: 6 },
    { code: '625', name: 'Déplacements, missions, réceptions', type: 'CHARGE', class: 6 },
    { code: '626', name: 'Frais postaux et télécommunications', type: 'CHARGE', class: 6 },
    { code: '627', name: 'Publicité, publications, relations publiques', type: 'CHARGE', class: 6 },
    { code: '631', name: 'Frais bancaires', type: 'CHARGE', class: 6 },
    { code: '641', name: 'Impôts et taxes directs', type: 'CHARGE', class: 6 },
    { code: '658', name: 'Charges diverses', type: 'CHARGE', class: 6 },
    { code: '661', name: 'Rémunérations directes versées au personnel', type: 'CHARGE', class: 6 },
    { code: '676', name: 'Pertes de change', type: 'CHARGE', class: 6 },
    { code: '701', name: 'Ventes de marchandises', type: 'PRODUIT', class: 7 },
    { code: '706', name: 'Services vendus', type: 'PRODUIT', class: 7 },
    { code: '776', name: 'Gains de change', type: 'PRODUIT', class: 7 },
  ];

  await prisma.accountingAccount.createMany({
    data: accounts.map((a) => ({ ...a, companyId, isSystem: true })),
    skipDuplicates: true,
  });
}
