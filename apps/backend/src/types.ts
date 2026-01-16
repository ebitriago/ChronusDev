// Tipos y modelos de datos

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "DEV";

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export type TimeLogStatus = "RUNNING" | "STOPPED";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string; // Null/undefined para SUPER_ADMIN
  defaultPayRate?: number; // Tarifa default por hora
  passwordHash?: string; // bcrypt hash
  password?: string; // Solo para creación (no se guarda)
  token?: string; // Token legacy (para compatibilidad)
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  contactName?: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string; // URL-friendly name
  ownerId: string; // User ID del dueño
  isActive: boolean; // Para habilitar/deshabilitar
  members: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  organizationId?: string;
  budget: number;
  currency: string;
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  payRate?: number; // Tarifa que se le paga al dev (Pay Rate)
  billRate?: number; // Tarifa que se cobra al cliente (Bill Rate)
  role: "LEAD" | "DEV" | "VIEWER";
  joinedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo?: string; // User ID
  createdBy: string; // User ID
  estimatedHours?: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: Date;
  activeWorkers?: { id: string; name: string }[]; // Usuarios con timer activo
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  start: Date;
  end?: Date;
  hours?: number;
  payRate?: number; // Tarifa pagada
  billRate?: number; // Tarifa cobrada
  payCost?: number; // Costo interno
  billCost?: number; // Costo cliente
  status: TimeLogStatus;
  note?: string;
  createdAt: Date;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId?: string;
  projectId?: string;
  role: UserRole | "PROJECT_MEMBER";
  invitedBy: string; // User ID
  status: InvitationStatus;
  token: string; // Token único para aceptar
  expiresAt: Date;
  createdAt: Date;
}

// Sistema de Pagos
export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  month: string; // YYYY-MM del periodo que cubre
  note?: string;
  createdBy: string; // Admin que registró el pago
  createdAt: Date;
}
