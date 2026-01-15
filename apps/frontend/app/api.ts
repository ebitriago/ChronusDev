const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ========== TIPOS ==========

export type UserRole = 'ADMIN' | 'DEV' | 'CLIENT';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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

export async function login(email: string): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userId', data.user.id);
  }
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Not authenticated');
  const data = await res.json();
  return data;
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

export async function createUser(data: { email: string; name: string; role?: UserRole }): Promise<User> {
  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
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

// ========== REPORTES ==========

export function downloadPayrollCSV(projectId: string, month: string) {
  const url = `${API_URL}/reports/${projectId}/payroll.csv?month=${month}`;
  window.open(url, '_blank');
}
