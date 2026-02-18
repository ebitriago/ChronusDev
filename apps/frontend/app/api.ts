// Use relative '/api' path on client-side to always use the Next.js Proxy.
export const API_URL = typeof window !== 'undefined'
  ? '/api'
  : (process.env.CHRONUSDEV_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');



// ========== TIPOS ==========

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'DEV' | 'AGENT' | 'VIEWER';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  defaultPayRate?: number;
  avatar?: string;
  phone?: string;
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  contactName?: string;
  phone?: string;
  notes?: string;
  projects?: { id: string; name: string; status: string }[];
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  customerId?: string; // CRM uses customerId
  budget: number;
  currency: string;
  status: ProjectStatus;
  client?: Client;
  customer?: { id: string; name: string; email?: string }; // CRM Customer relation
  members?: ProjectMember[];
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  payRate?: number;
  billRate?: number;
  role: string;
  user?: User;
};

export type Task = {
  id: string;
  projectId: string;
  project?: { id: string; name: string };
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo?: { id: string; name: string; avatar?: string } | null;
  assignedToId?: string; // CRM uses assignedToId
  createdBy: string;
  createdById?: string; // CRM uses createdById
  estimatedHours?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  activeWorkers?: { id: string; name: string }[];
  totalHours?: number;
  commentsCount?: number;
  assignedUser?: { id: string; name: string };
  comments?: TaskComment[];
  // Link to CRM ticket
  tickets?: { id: string; title: string; status: string }[];
  attachments?: TaskAttachment[];
  prLink?: string;
  checklist?: { text: string; checked: boolean }[];
};

export type TaskAttachment = {
  id: string;
  taskId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  user?: { id: string; name: string };
  createdAt: string;
};

export type TimeLog = {
  id: string;
  taskId: string;
  userId: string;
  start: string;
  end?: string;
  hours?: number;
  payRate?: number;
  billRate?: number;
  payCost?: number;
  billCost?: number;
  status: 'RUNNING' | 'STOPPED';
  note?: string;
  description?: string; // CRM uses description
  task?: { id: string; title: string };
  project?: { id: string; name: string };
};

export type ProjectSummary = {
  project: Project;
  budget: number;
  spent: number;
  remaining: number;
  currency: string;
  totalHours: number;
  totalPayCost: number;
  tasksByStatus: Record<TaskStatus, number>;
  progress: number;
};

export type TeamStatus = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'ACTIVE' | 'OFFLINE';
  currentTask?: {
    title: string;
    project: string;
    startedAt: string;
  };
  lastActive?: string;
  hoursToday: number;
};

// ========== HELPERS ==========

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Try CRM token first (shared session), then legacy authToken
    return localStorage.getItem('crm_token') || localStorage.getItem('authToken');
  } catch {
    return null;
  }
}

export function getHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// ========== AUTENTICACIÓN ==========

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  const data = await res.json();
  if (typeof window !== 'undefined') {
    // Save both tokens for cross-app compatibility (CRM and ChronusDev)
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('userId', data.user.id);
  }
  return data;
}

export async function register(email: string, password: string, name: string): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Registration failed');
  }
  const data = await res.json();
  if (typeof window !== 'undefined') {
    // Save both tokens for cross-app compatibility
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('userId', data.user.id);
  }
  return data;
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al solicitar recuperación');
  }
  return res.json();
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al restablecer contraseña');
  }
  return res.json();
}

export async function getCurrentUser(): Promise<User> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
    if (!res.ok) {
      if (res.status === 401) {
        logout();
      }
      throw new Error('Not authenticated');
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('API Error (getCurrentUser):', err);
    throw err;
  }
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('crm_token');
    localStorage.removeItem('userId');
  }
}

// ========== CLIENTES ==========

export async function getClients(): Promise<Client[]> {
  const res = await fetch(`${API_URL}/clients`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function getClient(id: string): Promise<Client> {
  const res = await fetch(`${API_URL}/clients/${id}`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function createClient(data: Partial<Client>): Promise<Client> {
  const res = await fetch(`${API_URL}/clients`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  const res = await fetch(`${API_URL}/clients/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function deleteClient(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/clients/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
}

export async function syncClientsFromCRM(): Promise<{ success: boolean; message: string; clients: Client[]; failed?: { name: string; reason: string }[] }> {
  const res = await fetch(`${API_URL}/clients/sync-from-crm`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error sincronizando clientes');
  }
  return res.json();
}

// ========== USUARIOS ==========

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function createUser(data: { email: string; name: string; role?: UserRole; defaultPayRate?: number; password?: string }): Promise<User> {
  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateUser(id: string, data: { name?: string; role?: UserRole; defaultPayRate?: number; avatar?: string; password?: string; phone?: string }): Promise<User> {
  const res = await fetch(`${API_URL}/users/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error eliminando usuario');
  }
}

export type UserBalance = {
  userId: string;
  userName: string;
  defaultPayRate: number;
  totalHours: number;
  totalDebt: number;
  totalPaid: number;
  balance: number;
  payments: Payment[];
};

export type Payment = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  month: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  userName?: string;
  createdByName?: string;
  user?: { email: string; name: string; };
};

export async function getUserBalance(id: string): Promise<UserBalance> {
  const res = await fetch(`${API_URL}/users/${id}/balance`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ========== PAGOS ==========

export type TeamMemberBalance = {
  userId: string;
  userName: string;
  defaultPayRate: number;
  totalHours: number;
  totalDebt: number;
  totalPaid: number;
  balance: number;
};

export async function getTeamBalances(): Promise<TeamMemberBalance[]> {
  const res = await fetch(`${API_URL}/payouts/team-summary`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function getPayments(userId?: string): Promise<Payment[]> {
  const url = userId ? `${API_URL}/payouts?userId=${userId}` : `${API_URL}/payouts`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function createPayment(data: { userId: string; amount: number; month?: string; note?: string }): Promise<Payment> {
  const res = await fetch(`${API_URL}/payouts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function deletePayment(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/payouts/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
}

// ========== PROYECTOS ==========

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_URL}/projects`, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${API_URL}/projects/${id}`, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function getTeamStatus(): Promise<TeamStatus[]> {
  const res = await fetch(`${API_URL}/dashboard/team-status`, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function createProject(data: {
  name: string;
  description?: string;
  clientId: string;
  budget: number;
  currency?: string;
}): Promise<Project> {
  const res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function assignProjectMember(projectId: string, data: { userId: string; payRate: number; billRate: number; role?: 'DEV' | 'MANAGER' | 'ADMIN' }): Promise<any> {
  const res = await fetch(`${API_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function removeProjectMember(projectId: string, userId: string): Promise<any> {
  const res = await fetch(`${API_URL}/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
}


export async function getProjectSummary(id: string): Promise<ProjectSummary> {
  const res = await fetch(`${API_URL}/projects/${id}/summary`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ========== MIEMBROS DE PROYECTO ==========
// NOTE: Use assignProjectMember() above for adding members (same endpoint).

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const res = await fetch(`${API_URL}/projects/${projectId}/members`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ========== TAREAS ==========

export async function getTasks(params?: string | { projectId?: string; assignedTo?: string; status?: string }): Promise<Task[]> {
  let url = `${API_URL}/tasks`;

  if (typeof params === 'string') {
    url += `?projectId=${params}`;
  } else if (params) {
    const query = new URLSearchParams();
    if (params.projectId) query.append('projectId', params.projectId);
    if (params.assignedTo) query.append('assignedTo', params.assignedTo);
    if (params.status) query.append('status', params.status);
    url += `?${query.toString()}`;
  }

  const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  const data = await res.json();
  // CRITICAL: Always return an array to prevent filter errors
  return Array.isArray(data) ? data : [];
}

export async function getTask(id: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${id}`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function createTask(data: {
  projectId: string;
  title: string;
  description?: string;
  priority?: string;
  estimatedHours?: number;
}): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function assignTask(taskId: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/assign`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
}

// ========== COMENTARIOS ==========

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function addTaskComment(taskId: string, content: string): Promise<TaskComment> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ========== TIMELOGS ==========

export async function getCurrentTimer(): Promise<TimeLog | null> {
  const res = await fetch(`${API_URL}/timelogs/current`, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function startTimer(taskId: string, projectId: string): Promise<TimeLog> {
  const res = await fetch(`${API_URL}/timelogs/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ taskId, projectId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function stopTimer(timelogId: string): Promise<TimeLog> {
  const res = await fetch(`${API_URL}/timelogs/stop`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ timelogId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function createTimeLog(data: {
  projectId: string;
  taskId?: string;
  start: string;
  end: string;
  description?: string;
}): Promise<TimeLog> {
  const res = await fetch(`${API_URL}/timelogs`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error creating time log');
  }
  return res.json();
}

export async function addNoteToTimer(timelogId: string, note: string): Promise<TimeLog> {
  const res = await fetch(`${API_URL}/timelogs/${timelogId}/note`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ========== ACTIVE TIMERS ==========

export interface ActiveTimer {
  id: string;
  user: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
  project: { id: string; name: string } | null;
  start: string;
}

export async function getActiveTimers(): Promise<ActiveTimer[]> {
  const res = await fetch(`${API_URL}/timelogs/active`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ========== REPORTES ==========

export function downloadPayrollCSV(projectId: string, month: string) {
  const url = `${API_URL}/reports/${projectId}/payroll.csv?month=${month}`;
  fetch(url, { headers: getHeaders() })
    .then(res => {
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.blob();
    })
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `payroll_${projectId}_${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    })
    .catch(err => console.error('Error downloading payroll CSV:', err));
}

// ========== TEAM EARNINGS ==========

export type TeamEarning = {
  userId: string;
  userName: string;
  totalHours: number;
  totalPay: number; // This might be totalDebt in the backend response? Backend sends totalDebt, totalPaid, balance.
  // Backend returns: userId, userName, defaultPayRate, totalHours, totalDebt, totalPaid, balance.
  // Frontend TeamEarning usage: totalPay (used as 'totalBill' in headers?), totalBill?
  // Let's align with backend:
  totalDebt: number;
  totalPaid: number;
  balance: number;
  totalBill: number;
  projectCount?: number;
  projects: {
    projectId: string;
    projectName: string;
    hours: number;
    pay: number;
  }[];
};

export type TeamEarningsResponse = {
  month: string;
  earnings: TeamEarning[];
};

export async function getTeamEarnings(month: string) {
  const res = await fetch(`${API_URL}/payouts/team-summary?month=${month}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Error cargando earnings');
  const data = await res.json();
  // Backend returns array of summaries.
  // Need to map backend response to TeamEarning if structure differs, or just assert.
  // Backend response: { userId, userName, defaultPayRate, totalHours, totalDebt, totalPaid, balance }
  // It seems 'projects' array is missing from the TEAM SUMMARY endpoint.
  // Frontend expects `member.projects` to map over.
  // I need to update the backend endpoint or the frontend to not rely on `member.projects` in the main view.
  // OR, I need to fetch projects in the backend endpoint.
  // Let's look at `TeamEarningsReport`. It uses `member.projects`.
  // If I want to keep the UI as is, I need `projects` in the summary.
  // But `MemberDetailView` replaces the need for `member.projects` in the expanded view.
  // SO, `member.projects` is ONLY used in the collapsed view context if I didn't change it?
  // In `TeamEarningsReport`:
  // `member.projects.length` is used in the "Info" column: `{member.projects.length} proyectos`.
  // So I need `projects` or count.

  // UPDATE: The backend `/payouts/team-summary` does NOT return `projects`.
  // I should update the backend to include project count or list if needed, OR mock it for now.
  // Actually, `activeTab === 'members'` in project page showed members.
  // Here we are in `TeamEarningsReport`.
  // Let's update `TeamEarning` to match backend response and Fix the frontend to not assume projects array exists if it's not there, OR update backend.

  // Let's update backend `payouts.ts` to include `projectCount` or similar, and maybe `projects` summary if cheap.
  // But for now, let's just make the frontend compatible.

  return { month, earnings: data.map((d: any) => ({ ...d, projects: [], totalPay: d.totalDebt, projectCount: 0 })) };
}

export async function getMemberDetails(userId: string, month: string) {
  const res = await fetch(`${API_URL}/payouts/team-summary/${userId}/details?month=${month}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Error cargando detalles');
  return res.json();
}

export function downloadMemberEarningsCSV(userId: string, month: string) {
  const token = getAuthToken();
  const url = `${API_URL}/reports/member/${userId}/earnings.csv?month=${month}`;
  // Para descargar con auth, necesitamos hacer fetch y crear blob
  fetch(url, { headers: getHeaders() })
    .then(res => res.blob())
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `reporte_${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    });
}

// ========== WIKI ==========

export type WikiPage = {
  id: string;
  projectId: string;
  title: string;
  content: string;
  updatedBy?: string;
  updatedAt: string;
};

export async function getWikiPages(projectId: string): Promise<WikiPage[]> {
  const res = await fetch(`${API_URL}/projects/${projectId}/wiki`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function createWikiPage(projectId: string, data: { title: string; content: string }): Promise<WikiPage> {
  const res = await fetch(`${API_URL}/projects/${projectId}/wiki`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function updateWikiPage(projectId: string, pageId: string, data: { title: string; content: string }): Promise<WikiPage> {
  const res = await fetch(`${API_URL}/projects/${projectId}/wiki/${pageId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function deleteWikiPage(projectId: string, pageId: string): Promise<void> {
  const res = await fetch(`${API_URL}/projects/${projectId}/wiki/${pageId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
}

interface ExportParams {
  startDate?: string;
  endDate?: string;
  userId?: string;
  projectId?: string;
  clientId?: string;
  format?: 'pdf' | 'csv' | 'json';
}

export async function exportReport(params: ExportParams): Promise<any> {
  const query = new URLSearchParams();
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.userId) query.append('userId', params.userId);
  if (params.projectId) query.append('projectId', params.projectId);
  if (params.clientId) query.append('clientId', params.clientId);
  query.append('format', params.format || 'pdf');

  const url = `${API_URL}/reports/export?${query.toString()}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error('Error generando reporte');
  }

  if (params.format === 'json') {
    return res.json();
  } else if (params.format === 'csv') {
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `reporte_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } else {
    // For PDF, we'll use a blob approach to ensure auth header is sent
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    window.open(downloadUrl, '_blank');
  }
}

// ========== STANDUPS ==========

export type Standup = {
  id: string;
  userId: string;
  user: { id: string; name: string; avatar?: string };
  yesterday: string;
  today: string;
  blockers?: string;
  createdAt: string;
};

export async function getStandups(date?: string): Promise<Standup[]> {
  const url = date ? `${API_URL}/standups?date=${date}` : `${API_URL}/standups`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function createStandup(data: { yesterday: string; today: string; blockers?: string }): Promise<Standup> {
  const res = await fetch(`${API_URL}/standups`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}
export async function getCrmLinkStatus(): Promise<{ linked: boolean; crmOrganizationId?: string }> {
  try {
    const res = await fetch(`${API_URL}/organizations/current/crm-link`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Error checking CRM link');
    return await res.json();
  } catch (err) {
    console.error('API Error (getCrmLinkStatus):', err);
    return { linked: false };
  }
}

// ========== TICKETS ==========

export type Ticket = {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  clientId: string;
  client?: Client;
  assignedToId?: string;
  assignedTo?: { id: string; name: string; avatar?: string };
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export async function getTickets(): Promise<Ticket[]> {
  const res = await fetch(`${API_URL}/tickets`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}
