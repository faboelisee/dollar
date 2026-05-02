export type Currency = 'XOF' | 'EUR' | 'USD' | 'GBP' | 'XAF';

export type OperationType =
  | 'encaissement'
  | 'decaissement'
  | 'avance'
  | 'depense'
  | 'recette'
  | 'transfert';

export type OperationStatus = 'brouillon' | 'en_attente' | 'valide' | 'annule' | 'rejete';

export type PaymentMethod =
  | 'especes'
  | 'orange_money'
  | 'mtn_momo'
  | 'wave'
  | 'moov_money'
  | 'cheque'
  | 'virement'
  | 'carte';

export type ContactType = 'client' | 'fournisseur' | 'employe' | 'autre';

export type CashRegisterType = 'principale' | 'annexe' | 'coffre';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'business' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
}

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  rccm: string;
  nif: string;
  address: string;
  logoUrl?: string;
  currency: Currency;
  fiscalYearStart: number;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: Role;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  resource: string;
}

export interface CashRegister {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  type: CashRegisterType;
  currency: Currency;
  minimumBalance: number;
  isActive: boolean;
  currentBalance?: number;
}

export interface Operation {
  id: string;
  companyId: string;
  cashRegisterId: string;
  type: OperationType;
  reference: string;
  amount: number;
  currency: Currency;
  exchangeRate: number;
  amountBaseCurrency: number;
  date: string;
  valueDate: string;
  description: string;
  status: OperationStatus;
  paymentMethod: PaymentMethod;
  categoryId: string;
  category?: Category;
  contactId?: string;
  contact?: Contact;
  employeeId?: string;
  attachments: Attachment[];
  journalEntryId?: string;
  createdBy: string;
  createdByUser?: User;
  validatedBy?: string;
  validatedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  companyId: string;
  parentId?: string;
  name: string;
  type: 'charge' | 'produit' | 'neutre';
  accountingCode: string;
  color: string;
  icon: string;
  isSystem: boolean;
  isActive: boolean;
  children?: Category[];
}

export interface Contact {
  id: string;
  companyId: string;
  type: ContactType;
  name: string;
  rccm?: string;
  nif?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  creditLimit?: number;
  paymentDelay?: number;
  isActive: boolean;
  balance?: ContactBalance;
}

export interface ContactBalance {
  advanceBalance: number;
  receivableBalance: number;
  payableBalance: number;
}

export interface Employee {
  id: string;
  companyId: string;
  userId?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  bankRib?: string;
  isActive: boolean;
  hireDate: string;
  pendingAdvances?: number;
}

export interface BankAccount {
  id: string;
  companyId: string;
  bankName: string;
  accountNumber: string;
  rib?: string;
  iban?: string;
  currency: Currency;
  currentBalance: number;
  isActive: boolean;
}

export interface CashRegisterBalance {
  id: string;
  cashRegisterId: string;
  date: string;
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  theoreticalBalance: number;
  physicalBalance?: number;
  variance?: number;
  status: 'ouvert' | 'en_cloture' | 'cloture';
  closedAt?: string;
  closedBy?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  ocrData?: OcrData;
}

export interface OcrData {
  amount?: number;
  date?: string;
  vendor?: string;
  invoiceNumber?: string;
  vatAmount?: number;
  confidence: number;
}

export interface DashboardStats {
  cashBalances: CashBalanceSummary[];
  totalCashBalance: number;
  todayInflows: number;
  todayOutflows: number;
  bankBalance: number;
  pendingValidations: number;
  activeAlerts: Alert[];
  fluxChart: FluxDataPoint[];
  topExpenses: CategoryStat[];
  topClients: ContactStat[];
  kpis: KpiData;
}

export interface CashBalanceSummary {
  cashRegisterId: string;
  name: string;
  currency: Currency;
  balance: number;
  minimumBalance: number;
  status: 'ok' | 'bas' | 'critique';
}

export interface Alert {
  id: string;
  type: 'solde_bas' | 'operation_en_attente' | 'echeance' | 'ecart_caisse' | 'budget_depasse';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface FluxDataPoint {
  date: string;
  inflows: number;
  outflows: number;
  balance: number;
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  color: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface ContactStat {
  contactId: string;
  contactName: string;
  amount: number;
  count: number;
}

export interface KpiData {
  liquidityRatio: number;
  averageDso: number;
  averageDpo: number;
  recoveryRate: number;
  operationalCostRatio: number;
  cashVarianceCount: number;
}

export interface AccountingAccount {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: 'actif' | 'passif' | 'charge' | 'produit';
  class: number;
  isSystem: boolean;
  isActive: boolean;
  parentId?: string;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  journalType: 'caisse' | 'banque' | 'achats' | 'ventes' | 'operations_diverses';
  date: string;
  reference: string;
  description: string;
  isBalanced: boolean;
  lines: JournalLine[];
  createdAt: string;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  account?: AccountingAccount;
  debit: number;
  credit: number;
  description: string;
  contactId?: string;
}

export interface Advance {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: Employee;
  amount: number;
  reason: string;
  status: 'demande' | 'approuve' | 'refuse' | 'rembourse' | 'partiellement_rembourse';
  repaidAmount: number;
  approvedBy?: string;
  createdAt: string;
}

export interface TreasureyForecast {
  date: string;
  predictedBalance: number;
  confidenceLow: number;
  confidenceHigh: number;
  scenario: 'optimiste' | 'realiste' | 'pessimiste';
  scheduledFlows: ScheduledFlow[];
}

export interface ScheduledFlow {
  date: string;
  description: string;
  amount: number;
  type: 'in' | 'out';
  certainty: 'certain' | 'probable' | 'possible';
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  plan: Plan;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  startedAt: string;
  expiresAt: string;
  autoRenew: boolean;
}

export interface Plan {
  id: string;
  name: string;
  maxCompanies: number;
  maxUsers: number;
  maxCaisses: number;
  features: string[];
  monthlyPrice: number;
  annualPrice: number;
  currency: Currency;
}
