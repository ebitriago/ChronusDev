import express from "express";
import cors from "cors";
import {
  users,
  clients,
  organizations,
  projects,
  projectMembers,
  tasks,
  taskComments,
  timeLogs,
  invitations,
  payments,
} from "./data.js";
import type {
  User,
  Client,
  Organization,
  Project,
  ProjectMember,
  Task,
  TaskComment,
  TimeLog,
  UserRole,
  TaskStatus,
  ProjectStatus,
  Payment,
} from "./types.js";
import { uuid, generateToken, getAuthToken } from "./utils.js";

const app = express();
app.use(cors());
app.use(express.json());

// Health check for Render
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========

import { verifyJWT, hashPassword, verifyPassword, generateJWT, hashPasswordSync, type JWTPayload } from "./auth.js";

function getUserFromToken(token: string | undefined): User | undefined {
  if (!token) return undefined;

  // Intentar verificar como JWT primero
  const payload = verifyJWT(token);
  if (payload) {
    return users.find((u) => u.id === payload.id);
  }

  // Fallback: buscar token legacy
  return users.find((u) => u.token === token || u.id === token);
}

function requireAuth(req: express.Request, res: express.Response): User | undefined {
  const token = getAuthToken(req);
  const user = getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: "No autenticado" });
    return undefined;
  }
  (req as any).user = user;
  return user;
}

// SUPER_ADMIN siempre tiene acceso a todo
function requireRole(allowedRoles: UserRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = requireAuth(req, res);
    if (!user) return;

    // SUPER_ADMIN puede hacer todo
    if (user.role === "SUPER_ADMIN") {
      next();
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ error: "Sin permisos" });
      return;
    }
    next();
  };
}

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = requireAuth(req, res);
  if (user) {
    next();
  }
};

// ========== AUTENTICACIÓN ==========

// Registro de nuevos usuarios
app.post("/auth/register", async (req, res) => {
  const { email, password, name, organizationId } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password y name requeridos" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password debe tener al menos 6 caracteres" });
  }

  if (users.some((u) => u.email === email)) {
    return res.status(400).json({ error: "Email ya registrado" });
  }

  const passwordHash = await hashPassword(password);
  const user: User = {
    id: uuid("u"),
    email,
    name,
    role: "DEV", // Por defecto son DEV, ADMIN promueve
    organizationId: organizationId || undefined,
    defaultPayRate: 25,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.push(user);

  const token = generateJWT(user);
  res.json({
    user: { ...user, passwordHash: undefined, password: undefined },
    token
  });
});

// Login con email y password
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) return res.status(400).json({ error: "email requerido" });

  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  // Verificar password si existe hash, sino aceptar cualquiera (compatibilidad)
  if (user.passwordHash) {
    if (!password) {
      return res.status(400).json({ error: "password requerido" });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
  }

  const token = generateJWT(user);

  // Guardar token para compatibilidad
  user.token = token;

  res.json({
    user: { ...user, passwordHash: undefined, password: undefined, token: undefined },
    token
  });
});

// Obtener usuario actual
app.get("/auth/me", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  res.json({ ...user, passwordHash: undefined, password: undefined, token: undefined });
});

// ========== CLIENTES (CRUD) ==========

app.get("/clients", authMiddleware, (req: express.Request, res: express.Response) => {
  res.json(clients);
});

app.get("/clients/:id", authMiddleware, (req: express.Request, res: express.Response) => {
  const client = clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(client);
});

app.post("/clients", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const { name, email, contactName, phone, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name requerido" });

  const client: Client = {
    id: uuid("c"),
    name,
    email,
    contactName,
    phone,
    notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  clients.push(client);
  res.json(client);
});

app.put("/clients/:id", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const client = clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

  const { name, email, contactName, phone, notes } = req.body;
  if (name) client.name = name;
  if (email !== undefined) client.email = email;
  if (contactName !== undefined) client.contactName = contactName;
  if (phone !== undefined) client.phone = phone;
  if (notes !== undefined) client.notes = notes;
  client.updatedAt = new Date();

  res.json(client);
});

app.delete("/clients/:id", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const index = clients.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Cliente no encontrado" });
  clients.splice(index, 1);
  res.json({ ok: true });
});

// ========== USUARIOS (CRUD) ==========

app.get("/users", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const safeUsers = users.map((u) => ({ ...u, password: undefined, token: undefined }));
  res.json(safeUsers);
});

app.get("/users/:id", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const targetId = req.params.id;

  // Solo admins pueden ver otros usuarios
  if (user.id !== targetId && user.role !== "ADMIN") {
    return res.status(403).json({ error: "Sin permisos" });
  }

  const target = users.find((u) => u.id === targetId);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

  res.json({ ...target, password: undefined, token: undefined });
});

app.post("/users", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const { email, name, role = "DEV", defaultPayRate = 25 } = req.body;
  if (!email || !name) return res.status(400).json({ error: "email y name requeridos" });

  if (users.some((u) => u.email === email)) {
    return res.status(400).json({ error: "Email ya existe" });
  }

  const user: User = {
    id: uuid("u"),
    email,
    name,
    role: role as UserRole,
    defaultPayRate: Number(defaultPayRate) || 25,
    token: generateToken(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.push(user);
  res.json({ ...user, password: undefined });
});

// Actualizar usuario (tarifa, nombre, rol)
app.put("/users/:id", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const target = users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

  const { name, role, defaultPayRate } = req.body;
  if (name) target.name = name;
  if (role) target.role = role as UserRole;
  if (typeof defaultPayRate === "number") target.defaultPayRate = defaultPayRate;
  target.updatedAt = new Date();

  res.json({ ...target, password: undefined, token: undefined });
});

// Obtener balance de un usuario (deuda - pagos)
app.get("/users/:id/balance", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const target = users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

  // Calcular deuda total (timelogs completados)
  const userLogs = timeLogs.filter((t) => t.userId === target.id && t.status === "STOPPED");
  const totalDebt = userLogs.reduce((acc, t) => acc + (t.payCost ?? 0), 0);
  const totalHours = userLogs.reduce((acc, t) => acc + (t.hours ?? 0), 0);

  // Calcular pagos realizados
  const userPayments = payments.filter((p) => p.userId === target.id);
  const totalPaid = userPayments.reduce((acc, p) => acc + p.amount, 0);

  // Saldo pendiente
  const balance = Math.round((totalDebt - totalPaid) * 100) / 100;

  res.json({
    userId: target.id,
    userName: target.name,
    defaultPayRate: target.defaultPayRate ?? 0,
    totalHours: Math.round(totalHours * 100) / 100,
    totalDebt: Math.round(totalDebt * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    balance,
    payments: userPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  });
});

// Eliminar usuario
app.delete("/users/:id", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const index = users.findIndex((u) => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Usuario no encontrado" });

  const user = users[index];
  // No permitir eliminar SUPER_ADMIN
  if (user.role === "SUPER_ADMIN") {
    return res.status(403).json({ error: "No se puede eliminar al Super Admin" });
  }

  users.splice(index, 1);
  res.json({ ok: true });
});

// ========== ORGANIZACIONES (CRUD - Solo SUPER_ADMIN) ==========

// Listar todas las organizaciones
app.get("/organizations", requireRole(["SUPER_ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const orgsWithDetails = organizations.map((org) => {
    const owner = users.find((u) => u.id === org.ownerId);
    const memberCount = users.filter((u) => u.organizationId === org.id).length;
    const projectCount = projects.filter((p) => p.organizationId === org.id).length;
    return {
      ...org,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
      memberCount,
      projectCount,
    };
  });
  res.json(orgsWithDetails);
});

// Obtener una organización
app.get("/organizations/:id", requireRole(["SUPER_ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const org = organizations.find((o) => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: "Organización no encontrada" });

  const orgUsers = users.filter((u) => u.organizationId === org.id);
  const owner = users.find((u) => u.id === org.ownerId);

  res.json({
    ...org,
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
    users: orgUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
  });
});

// Crear organización
app.post("/organizations", requireRole(["SUPER_ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const { name, ownerEmail, ownerName } = req.body;
  if (!name || !ownerEmail || !ownerName) {
    return res.status(400).json({ error: "name, ownerEmail y ownerName requeridos" });
  }

  // Verificar que el email no exista
  if (users.some((u) => u.email === ownerEmail)) {
    return res.status(400).json({ error: "Email ya registrado" });
  }

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const orgId = uuid("org");

  // Crear el usuario owner
  const owner: User = {
    id: uuid("u"),
    email: ownerEmail,
    name: ownerName,
    role: "ADMIN",
    organizationId: orgId,
    defaultPayRate: 0,
    passwordHash: hashPasswordSync("demo123"), // Password default temporal
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.push(owner);

  // Crear la organización
  const org: Organization = {
    id: orgId,
    name,
    slug,
    ownerId: owner.id,
    isActive: true,
    members: [owner.id],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  organizations.push(org);

  res.json({ org, owner: { id: owner.id, name: owner.name, email: owner.email } });
});

// Actualizar organización
app.put("/organizations/:id", requireRole(["SUPER_ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const org = organizations.find((o) => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: "Organización no encontrada" });

  const { name, isActive } = req.body;
  if (name) org.name = name;
  if (typeof isActive === "boolean") org.isActive = isActive;
  org.updatedAt = new Date();

  res.json(org);
});

// Eliminar organización
app.delete("/organizations/:id", requireRole(["SUPER_ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const index = organizations.findIndex((o) => o.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Organización no encontrada" });

  const org = organizations[index];

  // Eliminar usuarios de la org
  const orgUsers = users.filter((u) => u.organizationId === org.id);
  for (const u of orgUsers) {
    const uIndex = users.findIndex((x) => x.id === u.id);
    if (uIndex !== -1) users.splice(uIndex, 1);
  }

  organizations.splice(index, 1);
  res.json({ ok: true });
});

// Usuarios de una organización
app.get("/organizations/:id/users", requireRole(["SUPER_ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const org = organizations.find((o) => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: "Organización no encontrada" });

  const orgUsers = users.filter((u) => u.organizationId === org.id);
  res.json(orgUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    defaultPayRate: u.defaultPayRate,
  })));
});

// ========== PROYECTOS (CRUD) ==========

app.get("/projects", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  let filtered = projects;

  // Devs solo ven proyectos donde son miembros
  if (user.role === "DEV") {
    const memberProjectIds = projectMembers
      .filter((pm) => pm.userId === user.id)
      .map((pm) => pm.projectId);
    filtered = projects.filter((p) => memberProjectIds.includes(p.id));
  }

  // Enriquecer con info del cliente
  const enriched = filtered.map((p) => {
    const client = clients.find((c) => c.id === p.clientId);
    return { ...p, client };
  });

  res.json(enriched);
});

app.get("/projects/:id", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const project = projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

  // Verificar acceso
  if (user.role === "DEV") {
    const isMember = projectMembers.some((pm) => pm.projectId === project.id && pm.userId === user.id);
    if (!isMember) return res.status(403).json({ error: "Sin acceso al proyecto" });
  }

  const client = clients.find((c) => c.id === project.clientId);
  const members = projectMembers
    .filter((pm) => pm.projectId === project.id)
    .map((pm) => {
      const memberUser = users.find((u) => u.id === pm.userId);
      return { ...pm, user: memberUser ? { id: memberUser.id, name: memberUser.name, email: memberUser.email } : undefined };
    });

  res.json({ ...project, client, members });
});

app.post("/projects", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const { name, description, clientId, budget, currency = "USD", status = "ACTIVE" } = req.body;
  if (!name || !clientId || typeof budget !== "number") {
    return res.status(400).json({ error: "name, clientId y budget requeridos" });
  }

  const client = clients.find((c) => c.id === clientId);
  if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

  const project: Project = {
    id: uuid("p"),
    name,
    description,
    clientId,
    organizationId: organizations[0]?.id,
    budget,
    currency,
    status: status as ProjectStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  projects.push(project);
  res.json(project);
});

app.put("/projects/:id", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const project = projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

  const { name, description, budget, currency, status } = req.body;
  if (name) project.name = name;
  if (description !== undefined) project.description = description;
  if (typeof budget === "number") project.budget = budget;
  if (currency) project.currency = currency;
  if (status) project.status = status as ProjectStatus;
  project.updatedAt = new Date();

  res.json(project);
});

// ========== MIEMBROS DE PROYECTO ==========

// Agregar dev a proyecto con tarifas
app.post("/projects/:projectId/members", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const project = projects.find((p) => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

  const { userId, payRate, billRate, role = "DEV" } = req.body;
  if (!userId || typeof payRate !== "number" || typeof billRate !== "number") {
    return res.status(400).json({ error: "userId, payRate y billRate requeridos" });
  }

  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const existing = projectMembers.find((pm) => pm.projectId === project.id && pm.userId === userId);
  if (existing) {
    existing.payRate = payRate;
    existing.billRate = billRate;
    existing.role = role as any;
    return res.json(existing);
  }

  const member: ProjectMember = {
    id: uuid("pm"),
    projectId: project.id,
    userId,
    payRate,
    billRate,
    role: role as any,
    joinedAt: new Date(),
  };
  projectMembers.push(member);
  res.json(member);
  res.json(member);
});

// Eliminar miembro de proyecto
app.delete("/projects/:projectId/members/:userId", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const index = projectMembers.findIndex((pm) => pm.projectId === req.params.projectId && pm.userId === req.params.userId);
  if (index === -1) return res.status(404).json({ error: "Miembro no encontrado en el proyecto" });

  projectMembers.splice(index, 1);
  res.json({ success: true });
});

// Listar miembros de un proyecto
app.get("/projects/:projectId/members", authMiddleware, (req: express.Request, res: express.Response) => {
  const members = projectMembers.filter((pm) => pm.projectId === req.params.projectId);
  const enriched = members.map((pm) => {
    const user = users.find((u) => u.id === pm.userId);
    return { ...pm, user: user ? { id: user.id, name: user.name, email: user.email } : undefined };
  });
  res.json(enriched);
});

// ========== TAREAS (CRUD mejorado) ==========

app.get("/tasks", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const projectId = req.query.projectId as string | undefined;

  let filtered = tasks;
  if (projectId) {
    filtered = tasks.filter((t) => t.projectId === projectId);

    // Verificar acceso al proyecto
    if (user.role === "DEV") {
      const isMember = projectMembers.some((pm) => pm.projectId === projectId && pm.userId === user.id);
      if (!isMember) return res.status(403).json({ error: "Sin acceso al proyecto" });
    }
  }

  // Enriquecer con tiempo acumulado y comentarios
  const enriched = filtered.map((task) => {
    const taskLogs = timeLogs.filter((tl) => tl.taskId === task.id && tl.status === "STOPPED");
    const totalHours = taskLogs.reduce((acc, tl) => acc + (tl.hours ?? 0), 0);
    const commentsCount = taskComments.filter((tc) => tc.taskId === task.id).length;
    const assignedUser = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : undefined;
    return {
      ...task,
      totalHours,
      commentsCount,
      assignedUser: assignedUser ? { id: assignedUser.id, name: assignedUser.name } : undefined,
    };
  });

  res.json(enriched);
});

app.get("/tasks/:id", authMiddleware, (req: express.Request, res: express.Response) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });

  const comments = taskComments
    .filter((tc) => tc.taskId === task.id)
    .map((tc) => {
      const user = users.find((u) => u.id === tc.userId);
      return { ...tc, user: user ? { id: user.id, name: user.name } : undefined };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const assignedUser = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : undefined;
  res.json({ ...task, comments, assignedUser });
});

app.post("/tasks", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const { projectId, title, description, priority = "MEDIUM", estimatedHours } = req.body;
  if (!projectId || !title) return res.status(400).json({ error: "projectId y title requeridos" });

  const project = projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

  const task: Task = {
    id: uuid("t"),
    projectId,
    title,
    description,
    status: "BACKLOG",
    createdBy: user.id,
    priority: priority as any,
    estimatedHours,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  tasks.push(task);
  res.json(task);
});

app.put("/tasks/:id", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });

  const { title, description, status, assignedTo, priority, estimatedHours, dueDate } = req.body;
  if (title) task.title = title;
  if (description !== undefined) task.description = description;
  if (status) task.status = status as TaskStatus;

  // Validar que assignedTo sea miembro del proyecto
  if (assignedTo !== undefined) {
    if (assignedTo) {
      const isMember = projectMembers.some((pm) => pm.projectId === task.projectId && pm.userId === assignedTo);
      if (!isMember) {
        return res.status(400).json({ error: "El usuario no es miembro del proyecto" });
      }
    }
    task.assignedTo = assignedTo || undefined;
  }

  if (priority) task.priority = priority as any;
  if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
  if (dueDate) task.dueDate = new Date(dueDate);
  task.updatedAt = new Date();

  res.json(task);
});

// Eliminar tarea
app.delete("/tasks/:id", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const index = tasks.findIndex((t) => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Tarea no encontrada" });

  const taskId = tasks[index].id;

  // Eliminar comentarios asociados
  const commentIndices = taskComments
    .map((c, i) => c.taskId === taskId ? i : -1)
    .filter(i => i !== -1)
    .reverse();
  commentIndices.forEach(i => taskComments.splice(i, 1));

  // Eliminar timelogs asociados
  const timelogIndices = timeLogs
    .map((t, i) => t.taskId === taskId ? i : -1)
    .filter(i => i !== -1)
    .reverse();
  timelogIndices.forEach(i => timeLogs.splice(i, 1));

  tasks.splice(index, 1);
  res.json({ success: true });
});

// Tomar tarea (auto-asignación)
app.post("/tasks/:id/assign", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });

  task.assignedTo = user.id;
  task.status = "IN_PROGRESS";
  task.updatedAt = new Date();
  res.json(task);
});

// ========== COMENTARIOS EN TAREAS ==========

app.get("/tasks/:taskId/comments", authMiddleware, (req: express.Request, res: express.Response) => {
  const comments = taskComments
    .filter((tc) => tc.taskId === req.params.taskId)
    .map((tc) => {
      const user = users.find((u) => u.id === tc.userId);
      return { ...tc, user: user ? { id: user.id, name: user.name } : undefined };
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  res.json(comments);
});

app.post("/tasks/:taskId/comments", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const task = tasks.find((t) => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });

  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "content requerido" });

  const comment: TaskComment = {
    id: uuid("tc"),
    taskId: task.id,
    userId: user.id,
    content: content.trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  taskComments.push(comment);
  res.json(comment);
});

// ========== TIMELOGS (mantener funcionalidad existente) ==========

function getRates(projectId: string, userId: string) {
  const member = projectMembers.find((pm) => pm.projectId === projectId && pm.userId === userId);
  return {
    payRate: member?.payRate ?? 0,
    billRate: member?.billRate ?? 0,
  };
}

app.get("/timelogs/current", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const running = timeLogs.find((t) => t.userId === user.id && t.status === "RUNNING");
  if (!running) return res.json(null);

  const task = tasks.find((t) => t.id === running.taskId);
  const project = task ? projects.find((p) => p.id === task.projectId) : undefined;
  res.json({
    ...running,
    task: task ? { id: task.id, title: task.title } : undefined,
    project: project ? { id: project.id, name: project.name } : undefined,
  });
});

app.post("/timelogs/start", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: "taskId requerido" });

  const task = tasks.find((t) => t.id === taskId);
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });

  const running = timeLogs.find((t) => t.userId === user.id && t.status === "RUNNING");
  if (running) return res.status(400).json({ error: "Ya tienes un timer activo" });

  const log: TimeLog = {
    id: uuid("tl"),
    taskId,
    userId: user.id,
    start: new Date(),
    status: "RUNNING",
    createdAt: new Date(),
  };
  timeLogs.push(log);

  if (task.status === "BACKLOG") {
    task.status = "IN_PROGRESS";
    if (!task.assignedTo) task.assignedTo = user.id;
  }

  res.json(log);
});

app.get("/timelogs/active", authMiddleware, (req: express.Request, res: express.Response) => {
  const active = timeLogs.filter((t) => t.status === "RUNNING").map(log => {
    const user = users.find(u => u.id === log.userId);
    const task = tasks.find(t => t.id === log.taskId);
    const project = task ? projects.find(p => p.id === task.projectId) : undefined;
    return {
      id: log.id,
      user: user ? { id: user.id, name: user.name } : null,
      task: task ? { id: task.id, title: task.title } : null,
      project: project ? { id: project.id, name: project.name } : null,
      start: log.start
    };
  });
  res.json(active);
});

app.post("/timelogs/stop", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const { timelogId } = req.body;
  if (!timelogId) return res.status(400).json({ error: "timelogId requerido" });

  const log = timeLogs.find((t) => t.id === timelogId);
  if (!log) return res.status(404).json({ error: "Timelog no encontrado" });
  if (log.userId !== user.id && user.role !== "ADMIN") return res.status(403).json({ error: "No permitido" });
  if (log.status !== "RUNNING") return res.status(400).json({ error: "Ya estaba detenido" });

  const task = tasks.find((t) => t.id === log.taskId);
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });
  const project = projects.find((p) => p.id === task.projectId);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

  log.end = new Date();
  const hours = Math.max(0, (log.end.getTime() - log.start.getTime()) / 3600000);
  const rounded = Math.round(hours * 100) / 100;
  const { payRate, billRate } = getRates(project.id, user.id);

  log.hours = rounded;
  log.payRate = payRate;
  log.billRate = billRate;
  log.payCost = Math.round(rounded * payRate * 100) / 100;
  log.billCost = Math.round(rounded * billRate * 100) / 100;
  log.status = "STOPPED";

  res.json(log);
});

app.put("/timelogs/:id/note", authMiddleware, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const log = timeLogs.find((t) => t.id === req.params.id);
  if (!log) return res.status(404).json({ error: "Timelog no encontrado" });
  if (log.userId !== user.id && user.role !== "ADMIN") return res.status(403).json({ error: "No permitido" });

  const note = req.body.note || "";
  log.note = note;

  // Auto-create comment if note exists
  if (note.trim()) {
    const comment: TaskComment = {
      id: uuid("tc"),
      taskId: log.taskId,
      userId: user.id,
      content: `⏱️ Timer Note: ${note}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    taskComments.push(comment);
  }

  res.json(log);
});

// ========== RESUMEN Y PROGRESO DE PROYECTOS ==========

app.get("/projects/:id/summary", authMiddleware, (req: express.Request, res: express.Response) => {
  const project = projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const projectTimeLogs = timeLogs.filter((t) => projectTasks.some((pt) => pt.id === t.taskId) && t.status === "STOPPED");

  const totalBillCost = projectTimeLogs.reduce((acc, t) => acc + (t.billCost ?? 0), 0);
  const totalPayCost = projectTimeLogs.reduce((acc, t) => acc + (t.payCost ?? 0), 0);
  const totalHours = projectTimeLogs.reduce((acc, t) => acc + (t.hours ?? 0), 0);

  // Progreso basado en tareas
  const tasksByStatus = {
    BACKLOG: projectTasks.filter((t) => t.status === "BACKLOG").length,
    TODO: projectTasks.filter((t) => t.status === "TODO").length,
    IN_PROGRESS: projectTasks.filter((t) => t.status === "IN_PROGRESS").length,
    REVIEW: projectTasks.filter((t) => t.status === "REVIEW").length,
    DONE: projectTasks.filter((t) => t.status === "DONE").length,
  };

  const progress = projectTasks.length > 0 ? (tasksByStatus.DONE / projectTasks.length) * 100 : 0;

  res.json({
    project,
    budget: project.budget,
    spent: totalBillCost,
    remaining: Math.round((project.budget - totalBillCost) * 100) / 100,
    currency: project.currency,
    totalHours,
    totalPayCost,
    tasksByStatus,
    progress: Math.round(progress),
  });
});

// ========== REPORTES (mantener compatibilidad) ==========

app.get("/reports/:projectId/payroll.csv", authMiddleware, (req: express.Request, res: express.Response) => {
  const { projectId } = req.params;
  const project = projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

  const month = req.query.month as string | undefined;
  const monthPrefix = month ?? new Date().toISOString().slice(0, 7);

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const logs = timeLogs.filter((t) => {
    if (t.status !== "STOPPED" || !t.end) return false;
    const task = projectTasks.find((pt) => pt.id === t.taskId);
    if (!task) return false;
    return t.end.toISOString().startsWith(monthPrefix);
  });

  const header = "timelogId,usuario,tarea,horas,pay_rate,pay_cost,fecha";
  const rows = logs.map((l) => {
    const user = users.find((u) => u.id === l.userId);
    const task = tasks.find((t) => t.id === l.taskId);
    return [
      l.id,
      user?.name ?? "",
      task?.title ?? "",
      l.hours ?? 0,
      l.payRate ?? 0,
      l.payCost ?? 0,
      l.end?.toISOString() ?? "",
    ].join(",");
  });

  res.header("Content-Type", "text/csv");
  res.send([header, ...rows].join("\n"));
});

// ========== REPORTES POR EQUIPO ==========

// Reporte de ganancias del equipo completo
app.get("/reports/team-earnings", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const month = req.query.month as string | undefined;
  const monthPrefix = month ?? new Date().toISOString().slice(0, 7);

  // Filtrar timelogs del mes
  const monthLogs = timeLogs.filter((t) => {
    if (t.status !== "STOPPED" || !t.end) return false;
    return t.end.toISOString().startsWith(monthPrefix);
  });

  // Agrupar por usuario
  const userEarnings: Record<string, {
    userId: string;
    userName: string;
    totalHours: number;
    totalPay: number;
    totalBill: number;
    projects: { projectId: string; projectName: string; hours: number; pay: number }[];
  }> = {};

  for (const log of monthLogs) {
    const user = users.find((u) => u.id === log.userId);
    if (!user) continue;

    const task = tasks.find((t) => t.id === log.taskId);
    if (!task) continue;

    const project = projects.find((p) => p.id === task.projectId);
    if (!project) continue;

    if (!userEarnings[user.id]) {
      userEarnings[user.id] = {
        userId: user.id,
        userName: user.name,
        totalHours: 0,
        totalPay: 0,
        totalBill: 0,
        projects: [],
      };
    }

    const entry = userEarnings[user.id];
    entry.totalHours += log.hours ?? 0;
    entry.totalPay += log.payCost ?? 0;
    entry.totalBill += log.billCost ?? 0;

    // Agregar o actualizar proyecto
    let projEntry = entry.projects.find((p) => p.projectId === project.id);
    if (!projEntry) {
      projEntry = { projectId: project.id, projectName: project.name, hours: 0, pay: 0 };
      entry.projects.push(projEntry);
    }
    projEntry.hours += log.hours ?? 0;
    projEntry.pay += log.payCost ?? 0;
  }

  const result = Object.values(userEarnings).map((u) => ({
    ...u,
    totalHours: Math.round(u.totalHours * 100) / 100,
    totalPay: Math.round(u.totalPay * 100) / 100,
    totalBill: Math.round(u.totalBill * 100) / 100,
  }));

  res.json({ month: monthPrefix, earnings: result });
});

// Reporte individual de un miembro (CSV)
app.get("/reports/member/:userId/earnings.csv", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const { userId } = req.params;
  const month = req.query.month as string | undefined;
  const monthPrefix = month ?? new Date().toISOString().slice(0, 7);

  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  // Filtrar timelogs del usuario en el mes
  const userLogs = timeLogs.filter((t) => {
    if (t.status !== "STOPPED" || !t.end) return false;
    if (t.userId !== userId) return false;
    return t.end.toISOString().startsWith(monthPrefix);
  });

  const header = "fecha,proyecto,tarea,horas,pay_rate,pay_cost";
  const rows = userLogs.map((l) => {
    const task = tasks.find((t) => t.id === l.taskId);
    const project = task ? projects.find((p) => p.id === task.projectId) : undefined;
    return [
      l.end?.toISOString().split("T")[0] ?? "",
      project?.name ?? "",
      task?.title ?? "",
      l.hours ?? 0,
      l.payRate ?? 0,
      l.payCost ?? 0,
    ].join(",");
  });

  // Agregar totales
  const totalHours = userLogs.reduce((acc, l) => acc + (l.hours ?? 0), 0);
  const totalPay = userLogs.reduce((acc, l) => acc + (l.payCost ?? 0), 0);
  const summaryRow = `TOTAL,,,${totalHours.toFixed(2)},,${totalPay.toFixed(2)}`;

  res.header("Content-Type", "text/csv");
  res.header("Content-Disposition", `attachment; filename="${user.name.replace(/\s/g, "_")}_${monthPrefix}.csv"`);
  res.send([header, ...rows, "", summaryRow].join("\n"));
});

// ========== PAGOS (Sistema de Nómina) ==========

// Listar todos los pagos
app.get("/payments", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const userId = req.query.userId as string | undefined;

  let filtered = payments;
  if (userId) {
    filtered = payments.filter((p) => p.userId === userId);
  }

  // Enriquecer con nombre de usuario
  const enriched = filtered.map((p) => {
    const user = users.find((u) => u.id === p.userId);
    const createdByUser = users.find((u) => u.id === p.createdBy);
    return {
      ...p,
      userName: user?.name ?? "Desconocido",
      createdByName: createdByUser?.name ?? "Sistema",
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(enriched);
});

// Registrar un nuevo pago
app.post("/payments", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const admin = (req as any).user;
  const { userId, amount, month, note } = req.body;

  if (!userId || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "userId y amount (positivo) requeridos" });
  }

  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const payment: Payment = {
    id: uuid("pay"),
    userId,
    amount: Math.round(amount * 100) / 100,
    currency: "USD",
    month: month ?? new Date().toISOString().slice(0, 7),
    note: note ?? undefined,
    createdBy: admin.id,
    createdAt: new Date(),
  };

  payments.push(payment);
  res.json({
    ...payment,
    userName: user.name,
  });
});

// Eliminar un pago
app.delete("/payments/:id", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const index = payments.findIndex((p) => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Pago no encontrado" });

  payments.splice(index, 1);
  res.json({ success: true });
});

// Resumen de balances de todo el equipo
app.get("/payments/team-summary", requireRole(["ADMIN"]) as any, (req: express.Request, res: express.Response) => {
  const devUsers = users.filter((u) => u.role === "DEV");

  const summary = devUsers.map((user) => {
    // Calcular deuda total
    const userLogs = timeLogs.filter((t) => t.userId === user.id && t.status === "STOPPED");
    const totalDebt = userLogs.reduce((acc, t) => acc + (t.payCost ?? 0), 0);
    const totalHours = userLogs.reduce((acc, t) => acc + (t.hours ?? 0), 0);

    // Calcular pagos realizados
    const userPayments = payments.filter((p) => p.userId === user.id);
    const totalPaid = userPayments.reduce((acc, p) => acc + p.amount, 0);

    // Saldo pendiente
    const balance = totalDebt - totalPaid;

    return {
      userId: user.id,
      userName: user.name,
      defaultPayRate: user.defaultPayRate ?? 0,
      totalHours: Math.round(totalHours * 100) / 100,
      totalDebt: Math.round(totalDebt * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    };
  });

  res.json(summary);
});

// ========== SEED/DEMO ==========

app.get("/seed", (_req, res) => {
  res.json({
    users: users.map((u) => ({ ...u, password: undefined, token: undefined })),
    clients,
    projects,
    tasks,
    projectMembers,
  });
});

// ========== SERVER ==========

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ChronusDev API v2 escuchando en http://0.0.0.0:${PORT}`);
  console.log(`Login disponible en POST /auth/login`);
});
