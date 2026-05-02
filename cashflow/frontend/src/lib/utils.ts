import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Currency } from '@/types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: Currency = 'XOF',
  options?: Intl.NumberFormatOptions
): string {
  const locales: Record<Currency, string> = {
    XOF: 'fr-CI',
    EUR: 'fr-FR',
    USD: 'en-US',
    GBP: 'en-GB',
    XAF: 'fr-CM',
  };

  return new Intl.NumberFormat(locales[currency] ?? 'fr-CI', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2,
    maximumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2,
    ...options,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-CI').format(value);
}

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: fr });
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: fr });
}

export function generateReference(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${prefix}-${year}${month}${day}-${random}`;
}

export function getVarianceStatus(variance: number, tolerance = 500): 'ok' | 'warning' | 'critical' {
  const abs = Math.abs(variance);
  if (abs <= tolerance) return 'ok';
  if (abs <= tolerance * 5) return 'warning';
  return 'critical';
}

export function getBalanceStatus(balance: number, minimum: number): 'ok' | 'bas' | 'critique' {
  if (balance >= minimum) return 'ok';
  if (balance >= minimum * 0.5) return 'bas';
  return 'critique';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  especes: 'Espèces',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  wave: 'Wave',
  moov_money: 'Moov Money',
  cheque: 'Chèque',
  virement: 'Virement bancaire',
  carte: 'Carte bancaire',
};

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  encaissement: 'Encaissement',
  decaissement: 'Décaissement',
  avance: 'Avance',
  depense: 'Dépense',
  recette: 'Recette',
  transfert: 'Transfert',
};

export const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  valide: 'Validée',
  annule: 'Annulée',
  rejete: 'Rejetée',
};

export const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  en_attente: 'bg-amber-100 text-amber-700',
  valide: 'bg-green-100 text-green-700',
  annule: 'bg-red-100 text-red-700',
  rejete: 'bg-red-100 text-red-700',
};
