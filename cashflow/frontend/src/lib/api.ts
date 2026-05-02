import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const companyId = getActiveCompanyId();
    if (companyId) config.headers['X-Company-Id'] = companyId;
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      if (err.response?.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) return client.request(err.config as AxiosRequestConfig);
        clearAuth();
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }
  );

  return client;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function getActiveCompanyId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('active_company_id');
}

function clearAuth(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function refreshToken(): Promise<boolean> {
  try {
    const token = localStorage.getItem('refresh_token');
    if (!token) return false;
    const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: token });
    localStorage.setItem('access_token', res.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export const api = createApiClient();

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  verifyOtp: (otp: string, tempToken: string) =>
    api.post('/auth/verify-otp', { otp, tempToken }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
};

export const dashboardApi = {
  getStats: (companyId: string, period?: string) =>
    api.get(`/companies/${companyId}/dashboard`, { params: { period } }),
  getAlerts: (companyId: string) =>
    api.get(`/companies/${companyId}/alerts`),
  markAlertRead: (alertId: string) =>
    api.patch(`/alerts/${alertId}/read`),
};

export const operationsApi = {
  list: (params: Record<string, unknown>) => api.get('/operations', { params }),
  get: (id: string) => api.get(`/operations/${id}`),
  create: (data: unknown) => api.post('/operations', data),
  update: (id: string, data: unknown) => api.put(`/operations/${id}`, data),
  validate: (id: string, comment?: string) =>
    api.post(`/operations/${id}/validate`, { comment }),
  reject: (id: string, comment: string) =>
    api.post(`/operations/${id}/reject`, { comment }),
  cancel: (id: string, reason: string) =>
    api.post(`/operations/${id}/cancel`, { reason }),
  uploadAttachment: (operationId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/operations/${operationId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportPdf: (params: Record<string, unknown>) =>
    api.get('/operations/export/pdf', { params, responseType: 'blob' }),
  exportExcel: (params: Record<string, unknown>) =>
    api.get('/operations/export/excel', { params, responseType: 'blob' }),
};

export const cashRegistersApi = {
  list: (companyId: string) => api.get(`/companies/${companyId}/cash-registers`),
  get: (id: string) => api.get(`/cash-registers/${id}`),
  create: (companyId: string, data: unknown) =>
    api.post(`/companies/${companyId}/cash-registers`, data),
  update: (id: string, data: unknown) => api.put(`/cash-registers/${id}`, data),
  getBalance: (id: string, date?: string) =>
    api.get(`/cash-registers/${id}/balance`, { params: { date } }),
  close: (id: string, physicalBalance: number, signature?: string) =>
    api.post(`/cash-registers/${id}/close`, { physicalBalance, signature }),
  reopen: (id: string, reason: string) =>
    api.post(`/cash-registers/${id}/reopen`, { reason }),
  getClosures: (id: string, params?: Record<string, unknown>) =>
    api.get(`/cash-registers/${id}/closures`, { params }),
};

export const contactsApi = {
  list: (params?: Record<string, unknown>) => api.get('/contacts', { params }),
  get: (id: string) => api.get(`/contacts/${id}`),
  create: (data: unknown) => api.post('/contacts', data),
  update: (id: string, data: unknown) => api.put(`/contacts/${id}`, data),
  getStatement: (id: string, params?: Record<string, unknown>) =>
    api.get(`/contacts/${id}/statement`, { params }),
  getBalance: (id: string) => api.get(`/contacts/${id}/balance`),
};

export const bankApi = {
  listAccounts: () => api.get('/bank-accounts'),
  getAccount: (id: string) => api.get(`/bank-accounts/${id}`),
  createAccount: (data: unknown) => api.post('/bank-accounts', data),
  listTransactions: (accountId: string, params?: Record<string, unknown>) =>
    api.get(`/bank-accounts/${accountId}/transactions`, { params }),
  reconcile: (accountId: string, transactionIds: string[]) =>
    api.post(`/bank-accounts/${accountId}/reconcile`, { transactionIds }),
  importStatement: (accountId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/bank-accounts/${accountId}/import-statement`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const accountingApi = {
  getAccountPlan: () => api.get('/accounting/accounts'),
  createAccount: (data: unknown) => api.post('/accounting/accounts', data),
  getJournals: (params?: Record<string, unknown>) =>
    api.get('/accounting/journals', { params }),
  getJournalEntries: (journalType: string, params?: Record<string, unknown>) =>
    api.get(`/accounting/journals/${journalType}/entries`, { params }),
  getLedger: (accountId: string, params?: Record<string, unknown>) =>
    api.get(`/accounting/accounts/${accountId}/ledger`, { params }),
  getTrialBalance: (params?: Record<string, unknown>) =>
    api.get('/accounting/trial-balance', { params }),
  getCashFlowStatement: (params?: Record<string, unknown>) =>
    api.get('/accounting/cash-flow', { params }),
  getVatDeclaration: (period: string) =>
    api.get(`/accounting/vat/${period}`),
};

export const reportsApi = {
  getDailyCashReport: (cashRegisterId: string, date: string) =>
    api.get(`/reports/daily-cash/${cashRegisterId}`, { params: { date } }),
  getTreasuryForecast: (days: number) =>
    api.get('/reports/treasury-forecast', { params: { days } }),
  getExpenseStats: (params: Record<string, unknown>) =>
    api.get('/reports/expense-stats', { params }),
  getRevenueStats: (params: Record<string, unknown>) =>
    api.get('/reports/revenue-stats', { params }),
  getKpis: (params: Record<string, unknown>) =>
    api.get('/reports/kpis', { params }),
  exportDailyCashPdf: (cashRegisterId: string, date: string) =>
    api.get(`/reports/daily-cash/${cashRegisterId}/pdf`, {
      params: { date },
      responseType: 'blob',
    }),
};

export const ocrApi = {
  scan: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/ocr/scan', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const employeesApi = {
  list: (params?: Record<string, unknown>) => api.get('/employees', { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  create: (data: unknown) => api.post('/employees', data),
  update: (id: string, data: unknown) => api.put(`/employees/${id}`, data),
  requestAdvance: (employeeId: string, data: unknown) =>
    api.post(`/employees/${employeeId}/advances`, data),
  getAdvances: (employeeId: string) =>
    api.get(`/employees/${employeeId}/advances`),
};

export const subscriptionApi = {
  getCurrent: () => api.get('/subscription'),
  getPlans: () => api.get('/subscription/plans'),
  upgrade: (planId: string, paymentMethod: string) =>
    api.post('/subscription/upgrade', { planId, paymentMethod }),
  initiateMobilePay: (amount: number, method: string, phone: string) =>
    api.post('/subscription/pay/mobile', { amount, method, phone }),
};
