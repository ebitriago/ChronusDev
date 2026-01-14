const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type User = {
  id: string;
  name: string;
  role: 'ADMIN' | 'DEV';
};

export type Project = {
  id: string;
  name: string;
  client: string;
  budgetClient: number;
  currency: string;
  status: 'ACTIVE' | 'CLOSED';
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  status: 'BACKLOG' | 'IN_PROGRESS' | 'DONE';
  totalHours?: number;
};

export type TimeLog = {
  id: string;
  taskId: string;
  userId: string;
  start: string;
  end?: string;
  hours?: number;
  costInternal?: number;
  costClient?: number;
  status: 'RUNNING' | 'STOPPED';
  note?: string;
  task?: { id: string; title: string };
  project?: { id: string; name: string };
};

export type ProjectSummary = {
  project: Project;
  budgetClient: number;
  costClient: number;
  remaining: number;
  currency: string;
};

function getHeaders(): HeadersInit {
  const userId = localStorage.getItem('userId') || 'u-juan';
  return {
    'Content-Type': 'application/json',
    'x-user-id': userId,
  };
}

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_URL}/projects`, { headers: getHeaders() });
  return res.json();
}

export async function getProjectSummary(projectId: string): Promise<ProjectSummary> {
  const res = await fetch(`${API_URL}/projects/${projectId}/summary`, { headers: getHeaders() });
  return res.json();
}

export async function getTasks(projectId?: string): Promise<Task[]> {
  const url = projectId ? `${API_URL}/tasks?projectId=${projectId}` : `${API_URL}/tasks`;
  const res = await fetch(url, { headers: getHeaders() });
  return res.json();
}

export async function createTask(projectId: string, title: string): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ projectId, title }),
  });
  return res.json();
}

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

export function downloadReportPDF(projectId: string, month: string) {
  const url = `${API_URL}/reports/${projectId}/monthly.pdf?month=${month}`;
  window.open(url, '_blank');
}

export function downloadPayrollCSV(projectId: string, month: string) {
  const url = `${API_URL}/reports/${projectId}/payroll.csv?month=${month}`;
  window.open(url, '_blank');
}
