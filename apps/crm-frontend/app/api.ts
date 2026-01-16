const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
console.log('🔗 API configured at:', API_URL);

// ========== TIPOS ==========

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DEV';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  defaultPayRate?: number;
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  contactName?: string;
  phone?: string;
  notes?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  budget: number;
  currency: string;
  status: ProjectStatus;
  client?: Client;
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
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo?: string;
  createdBy: string;
  estimatedHours?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  totalHours?: number;
  commentsCount?: number;
  assignedUser?: { id: string; name: string };
  comments?: TaskComment[];
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
  tasksByStatus: Record<TaskStatus, number>;
  progress: number;
};

// ========== HELPERS ==========

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('authToken');
  } catch {
    return null;
  }
}

function getHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-auth-token'] = token;
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
    localStorage.setItem('authToken', data.token);
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
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userId', data.user.id);
  }
  return data;
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
    localStorage.removeItem('userId');
  }
}

// ========== CLIENTES ==========

export async function getClients(): Promise<Client[]> {
  const res = await fetch(`${API_URL}/clients`, { headers: getHeaders() });
  return res.json();
}

export async function getClient(id: string): Promise<Client> {
  const res = await fetch(`${API_URL}/clients/${id}`, { headers: getHeaders() });
  return res.json();
}

export async function createClient(data: Partial<Client>): Promise<Client> {
  const res = await fetch(`${API_URL}/clients`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  const res = await fetch(`${API_URL}/clients/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteClient(id: string): Promise<void> {
  await fetch(`${API_URL}/clients/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
}

// ========== USUARIOS ==========

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
  return res.json();
}

export async function createUser(data: { email: string; name: string; role?: UserRole; defaultPayRate?: number }): Promise<User> {
  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateUser(id: string, data: { name?: string; role?: UserRole; defaultPayRate?: number }): Promise<User> {
  const res = await fetch(`${API_URL}/users/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
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
};

export async function getUserBalance(id: string): Promise<UserBalance> {
  const res = await fetch(`${API_URL}/users/${id}/balance`, { headers: getHeaders() });
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
  const res = await fetch(`${API_URL}/payments/team-summary`, { headers: getHeaders() });
  return res.json();
}

export async function getPayments(userId?: string): Promise<Payment[]> {
  const url = userId ? `${API_URL}/payments?userId=${userId}` : `${API_URL}/payments`;
  const res = await fetch(url, { headers: getHeaders() });
  return res.json();
}

export async function createPayment(data: { userId: string; amount: number; month?: string; note?: string }): Promise<Payment> {
  const res = await fetch(`${API_URL}/payments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deletePayment(id: string): Promise<void> {
  await fetch(`${API_URL}/payments/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
}

// ========== PROYECTOS ==========

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_URL}/projects`, { headers: getHeaders() });
  return res.json();
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${API_URL}/projects/${id}`, { headers: getHeaders() });
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
  return res.json();
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function assignProjectMember(projectId: string, data: { userId: string; payRate: number; billRate: number; role?: 'DEV' | 'MANAGER' | 'ADMIN' }): Promise<any> {
  const res = await fetch(`${API_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function removeProjectMember(projectId: string, userId: string): Promise<any> {
  await fetch(`${API_URL}/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
}


export async function getProjectSummary(id: string): Promise<ProjectSummary> {
  const res = await fetch(`${API_URL}/projects/${id}/summary`, { headers: getHeaders() });
  return res.json();
}

// ========== MIEMBROS DE PROYECTO ==========

export async function addProjectMember(
  projectId: string,
  data: { userId: string; payRate: number; billRate: number; role?: string }
): Promise<ProjectMember> {
  const res = await fetch(`${API_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const res = await fetch(`${API_URL}/projects/${projectId}/members`, { headers: getHeaders() });
  return res.json();
}

// ========== TAREAS ==========

export async function getTasks(projectId?: string): Promise<Task[]> {
  const url = projectId ? `${API_URL}/tasks?projectId=${projectId}` : `${API_URL}/tasks`;
  const res = await fetch(url, { headers: getHeaders() });
  return res.json();
}

export async function getTask(id: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${id}`, { headers: getHeaders() });
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
  return res.json();
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function assignTask(taskId: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/assign`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return res.json();
}

// ========== COMENTARIOS ==========

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, { headers: getHeaders() });
  return res.json();
}

export async function addTaskComment(taskId: string, content: string): Promise<TaskComment> {
  const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  return res.json();
}

// ========== TIMELOGS ==========

export async function getCurrentTimer(): Promise<TimeLog | null> {
  const res = await fetch(`${API_URL}/timelogs/current`, { headers: getHeaders() });
  return res.json();
}

export async function startTimer(taskId: string): Promise<TimeLog> {
  const res = await fetch(`${API_URL}/timelogs/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ taskId }),
  });
  return res.json();
}

export async function stopTimer(timelogId: string): Promise<TimeLog> {
  const res = await fetch(`${API_URL}/timelogs/stop`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ timelogId }),
  });
  return res.json();
}

export async function addNoteToTimer(timelogId: string, note: string): Promise<TimeLog> {
  const res = await fetch(`${API_URL}/timelogs/${timelogId}/note`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ note }),
  });
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
  return res.json();
}

// ========== REPORTES ==========

export function downloadPayrollCSV(projectId: string, month: string) {
  const url = `${API_URL}/reports/${projectId}/payroll.csv?month=${month}`;
  window.open(url, '_blank');
}

// ========== TEAM EARNINGS ==========

export type TeamEarning = {
  userId: string;
  userName: string;
  totalHours: number;
  totalPay: number;
  totalBill: number;
  projects: { projectId: string; projectName: string; hours: number; pay: number }[];
};

export type TeamEarningsResponse = {
  month: string;
  earnings: TeamEarning[];
};

export async function getTeamEarnings(month: string): Promise<TeamEarningsResponse> {
  const res = await fetch(`${API_URL}/reports/team-earnings?month=${month}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Error al cargar reportes de equipo');
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

// ========== DELETE TASK ==========

export async function deleteTask(taskId: string): Promise<void> {
  await fetch(`${API_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
}

