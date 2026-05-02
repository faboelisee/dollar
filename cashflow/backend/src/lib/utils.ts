export function generateReference(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${prefix.toUpperCase()}-${y}${m}${d}-${rand}`;
}

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export function formatAmountFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-CI', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount);
}
