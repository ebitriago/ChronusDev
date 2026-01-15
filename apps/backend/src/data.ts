// Datos en memoria (base de datos simulada)
import type {
  User,
  Client,
  Organization,
  Project,
  ProjectMember,
  Task,
  TaskComment,
  TimeLog,
  Invitation,
} from "./types.js";

export const users: User[] = [
  {
    id: "u-admin",
    email: "admin@chronusdev.com",
    name: "Admin",
    role: "ADMIN",
    token: "token-admin-123",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "u-juan",
    email: "juan@chronusdev.com",
    name: "Juan",
    role: "DEV",
    token: "token-juan-123",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const clients: Client[] = [
  {
    id: "c-client-x",
    name: "Cliente X",
    email: "contacto@clientex.com",
    contactName: "María García",
    phone: "+1 234 567 890",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const organizations: Organization[] = [
  {
    id: "org-main",
    name: "ChronusDev",
    ownerId: "u-admin",
    members: ["u-admin", "u-juan"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const projects: Project[] = [
  {
    id: "p-ecommerce-x",
    name: "E-commerce Cliente X",
    description: "Plataforma de comercio electrónico",
    clientId: "c-client-x",
    organizationId: "org-main",
    budget: 5000,
    currency: "USD",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const projectMembers: ProjectMember[] = [
  {
    id: "pm-1",
    projectId: "p-ecommerce-x",
    userId: "u-juan",
    payRate: 20, // Se le paga $20/hr
    billRate: 50, // Se cobra $50/hr
    role: "DEV",
    joinedAt: new Date(),
  },
];

export const tasks: Task[] = [
  {
    id: "t-home",
    projectId: "p-ecommerce-x",
    title: "Crear Home",
    description: "Diseñar y desarrollar la página principal",
    status: "BACKLOG",
    createdBy: "u-admin",
    priority: "HIGH",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const taskComments: TaskComment[] = [];

export const timeLogs: TimeLog[] = [];

export const invitations: Invitation[] = [];
