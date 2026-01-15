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
} from "./data.js";
import type {
  User,
  Client,
  Project,
  ProjectMember,
  Task,
  TaskComment,
  TimeLog,
  UserRole,
  TaskStatus,
  ProjectStatus,
} from "./types.js";
import { uuid, generateToken, getAuthToken } from "./utils.js";

const app = express();
app.use(cors());
app.use(express.json());

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========

function getUserFromToken(token: string | undefined): User | undefined {
  if (!token) return undefined;
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

function requireRole(allowedRoles: UserRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ error: "Sin permisos" });
      return;
    }
    next();
  };
}

// ========== AUTENTICACIÓN ==========

// Login simple (para MVP)
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  // Para MVP, cualquier email funciona, sin password
  if (!email) return res.status(400).json({ error: "email requerido" });

  let user = users.find((u) => u.email === email);
  if (!user) {
    // Crear usuario si no existe (simplificado para MVP)
    user = {
      id: uuid("u"),
      email,
      name: email.split("@")[0],
      role: "DEV",
      token: generateToken(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(user);
  }

  if (!user.token) {
    user.token = generateToken();
  }

  res.json({ user: { ...user, password: undefined }, token: user.token });
});

// Obtener usuario actual
app.get("/auth/me", requireAuth as any, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  res.json({ ...user, password: undefined, token: undefined });
});

// ========== CLIENTES (CRUD) ==========

app.get("/clients", requireAuth as any, (req: express.Request, res: express.Response) => {
  res.json(clients);
});

app.get("/clients/:id", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.get("/users/:id", requireAuth as any, (req: express.Request, res: express.Response) => {
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
  const { email, name, role = "DEV" } = req.body;
  if (!email || !name) return res.status(400).json({ error: "email y name requeridos" });

  if (users.some((u) => u.email === email)) {
    return res.status(400).json({ error: "Email ya existe" });
  }

  const user: User = {
    id: uuid("u"),
    email,
    name,
    role: role as UserRole,
    token: generateToken(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.push(user);
  res.json({ ...user, password: undefined });
});

// ========== PROYECTOS (CRUD) ==========

app.get("/projects", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.get("/projects/:id", requireAuth as any, (req: express.Request, res: express.Response) => {
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
});

// Listar miembros de un proyecto
app.get("/projects/:projectId/members", requireAuth as any, (req: express.Request, res: express.Response) => {
  const members = projectMembers.filter((pm) => pm.projectId === req.params.projectId);
  const enriched = members.map((pm) => {
    const user = users.find((u) => u.id === pm.userId);
    return { ...pm, user: user ? { id: user.id, name: user.name, email: user.email } : undefined };
  });
  res.json(enriched);
});

// ========== TAREAS (CRUD mejorado) ==========

app.get("/tasks", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.get("/tasks/:id", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.post("/tasks", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.put("/tasks/:id", requireAuth as any, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });

  const { title, description, status, assignedTo, priority, estimatedHours, dueDate } = req.body;
  if (title) task.title = title;
  if (description !== undefined) task.description = description;
  if (status) task.status = status as TaskStatus;
  if (assignedTo !== undefined) task.assignedTo = assignedTo || undefined;
  if (priority) task.priority = priority as any;
  if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
  if (dueDate) task.dueDate = new Date(dueDate);
  task.updatedAt = new Date();

  res.json(task);
});

// Tomar tarea (auto-asignación)
app.post("/tasks/:id/assign", requireAuth as any, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });

  task.assignedTo = user.id;
  task.status = "IN_PROGRESS";
  task.updatedAt = new Date();
  res.json(task);
});

// ========== COMENTARIOS EN TAREAS ==========

app.get("/tasks/:taskId/comments", requireAuth as any, (req: express.Request, res: express.Response) => {
  const comments = taskComments
    .filter((tc) => tc.taskId === req.params.taskId)
    .map((tc) => {
      const user = users.find((u) => u.id === tc.userId);
      return { ...tc, user: user ? { id: user.id, name: user.name } : undefined };
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  res.json(comments);
});

app.post("/tasks/:taskId/comments", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.get("/timelogs/current", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.post("/timelogs/start", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.post("/timelogs/stop", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.put("/timelogs/:id/note", requireAuth as any, (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const log = timeLogs.find((t) => t.id === req.params.id);
  if (!log) return res.status(404).json({ error: "Timelog no encontrado" });
  if (log.userId !== user.id && user.role !== "ADMIN") return res.status(403).json({ error: "No permitido" });
  log.note = req.body.note || "";
  res.json(log);
});

// ========== RESUMEN Y PROGRESO DE PROYECTOS ==========

app.get("/projects/:id/summary", requireAuth as any, (req: express.Request, res: express.Response) => {
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

app.get("/reports/:projectId/payroll.csv", requireAuth as any, (req: express.Request, res: express.Response) => {
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ChronusDev API v2 escuchando en http://localhost:${PORT}`);
  console.log(`Login disponible en POST /auth/login`);
});
