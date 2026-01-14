import express from "express";
import cors from "cors";

type Role = "ADMIN" | "DEV";

type User = {
  id: string;
  name: string;
  role: Role;
  rateInternal?: number;
  rateClient?: number;
};

type Project = {
  id: string;
  name: string;
  client: string;
  budgetClient: number;
  currency: string;
  status: "ACTIVE" | "CLOSED";
};

type ProjectAssignment = {
  projectId: string;
  userId: string;
  rateInternal: number;
  rateClient: number;
};

type Task = {
  id: string;
  projectId: string;
  title: string;
  status: "BACKLOG" | "IN_PROGRESS" | "DONE";
};

type TimeLog = {
  id: string;
  taskId: string;
  userId: string;
  start: Date;
  end?: Date;
  hours?: number;
  costInternal?: number;
  costClient?: number;
  status: "RUNNING" | "STOPPED";
  note?: string;
};

// Datos en memoria (seed)
const users: User[] = [
  { id: "u-admin", name: "Admin", role: "ADMIN" },
  { id: "u-juan", name: "Juan", role: "DEV", rateInternal: 20, rateClient: 50 },
];

const projects: Project[] = [
  {
    id: "p-ecommerce-x",
    name: "E-commerce Cliente X",
    client: "Cliente X",
    budgetClient: 5000,
    currency: "USD",
    status: "ACTIVE",
  },
];

const assignments: ProjectAssignment[] = [
  {
    projectId: "p-ecommerce-x",
    userId: "u-juan",
    rateInternal: 20,
    rateClient: 50,
  },
];

const tasks: Task[] = [
  { id: "t-home", projectId: "p-ecommerce-x", title: "Crear Home", status: "BACKLOG" },
];

const timeLogs: TimeLog[] = [];

const app = express();
app.use(cors());
app.use(express.json());

function uuid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function getUser(req: express.Request): User | undefined {
  const userId = req.header("x-user-id");
  if (!userId) return undefined;
  return users.find((u) => u.id === userId);
}

function requireUser(req: express.Request, res: express.Response): User | undefined {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: "Falta header x-user-id" });
    return undefined;
  }
  return user;
}

function getRates(projectId: string, user: User) {
  const assignment = assignments.find((a) => a.projectId === projectId && a.userId === user.id);
  const rateInternal = assignment?.rateInternal ?? user.rateInternal ?? 0;
  const rateClient = assignment?.rateClient ?? user.rateClient ?? 0;
  return { rateInternal, rateClient };
}

// Crear proyecto
app.post("/projects", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role !== "ADMIN") return res.status(403).json({ error: "Solo admin" });

  const { name, client, budgetClient, currency = "USD" } = req.body;
  if (!name || !client || typeof budgetClient !== "number") {
    return res.status(400).json({ error: "name, client, budgetClient requeridos" });
  }
  const project: Project = {
    id: uuid("p"),
    name,
    client,
    budgetClient,
    currency,
    status: "ACTIVE",
  };
  projects.push(project);
  res.json(project);
});

// Asignar dev y tarifas a proyecto
app.post("/projects/:id/assignments", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role !== "ADMIN") return res.status(403).json({ error: "Solo admin" });

  const project = projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
  const { userId, rateInternal, rateClient } = req.body;
  if (!userId || typeof rateInternal !== "number" || typeof rateClient !== "number") {
    return res.status(400).json({ error: "userId, rateInternal, rateClient requeridos" });
  }
  const target = users.find((u) => u.id === userId);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

  const existingIdx = assignments.findIndex((a) => a.projectId === project.id && a.userId === userId);
  if (existingIdx >= 0) {
    assignments[existingIdx] = { projectId: project.id, userId, rateInternal, rateClient };
  } else {
    assignments.push({ projectId: project.id, userId, rateInternal, rateClient });
  }
  res.json({ ok: true });
});

// Listar tareas
app.get("/tasks", (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  let filtered = tasks;
  if (projectId) {
    filtered = tasks.filter((t) => t.projectId === projectId);
  }
  // Enriquecer con tiempo acumulado
  const enriched = filtered.map((task) => {
    const taskLogs = timeLogs.filter((tl) => tl.taskId === task.id && tl.status === "STOPPED");
    const totalHours = taskLogs.reduce((acc, tl) => acc + (tl.hours ?? 0), 0);
    return { ...task, totalHours };
  });
  res.json(enriched);
});

// Crear tarea
app.post("/tasks", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const { projectId, title } = req.body;
  if (!projectId || !title) return res.status(400).json({ error: "projectId y title requeridos" });
  const project = projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

  const task: Task = { id: uuid("t"), projectId, title, status: "BACKLOG" };
  tasks.push(task);
  res.json(task);
});

// Start
app.post("/timelogs/start", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
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
  };
  timeLogs.push(log);
  // mover tarea a InProgress
  task.status = "IN_PROGRESS";
  res.json(log);
});

// Obtener timer activo del usuario
app.get("/timelogs/current", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const running = timeLogs.find((t) => t.userId === user.id && t.status === "RUNNING");
  if (!running) {
    return res.json(null);
  }
  const task = tasks.find((t) => t.id === running.taskId);
  const project = task ? projects.find((p) => p.id === task.projectId) : undefined;
  res.json({
    ...running,
    task: task ? { id: task.id, title: task.title } : undefined,
    project: project ? { id: project.id, name: project.name } : undefined,
  });
});

// Stop
app.post("/timelogs/stop", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
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
  const { rateInternal, rateClient } = getRates(project.id, user);
  log.hours = rounded;
  log.costInternal = Math.round(rounded * rateInternal * 100) / 100;
  log.costClient = Math.round(rounded * rateClient * 100) / 100;
  log.status = "STOPPED";

  // cerrar tarea si no tiene otros timers abiertos
  const stillRunning = timeLogs.some((t) => t.taskId === task.id && t.status === "RUNNING");
  if (!stillRunning) task.status = "DONE";

  res.json(log);
});

// Agregar nota a timelog
app.put("/timelogs/:id/note", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const log = timeLogs.find((t) => t.id === req.params.id);
  if (!log) return res.status(404).json({ error: "Timelog no encontrado" });
  if (log.userId !== user.id && user.role !== "ADMIN") return res.status(403).json({ error: "No permitido" });
  log.note = req.body.note || "";
  res.json(log);
});

// Listar proyectos
app.get("/projects", (req, res) => {
  res.json(projects);
});

// Resumen proyecto
app.get("/projects/:id/summary", (req, res) => {
  const project = projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const projectTimeLogs = timeLogs.filter((t) => projectTasks.some((pt) => pt.id === t.taskId) && t.status === "STOPPED");
  const costClient = projectTimeLogs.reduce((acc, t) => acc + (t.costClient ?? 0), 0);
  res.json({
    project,
    budgetClient: project.budgetClient,
    costClient,
    remaining: Math.round((project.budgetClient - costClient) * 100) / 100,
    currency: project.currency,
  });
});

// Reporte mensual (placeholder PDF)
app.get("/reports/:projectId/monthly.pdf", (req, res) => {
  const { projectId } = req.params;
  const project = projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
  const month = req.query.month as string | undefined;
  const monthPrefix = month ?? new Date().toISOString().slice(0, 7); // YYYY-MM

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const logs = timeLogs.filter((t) => {
    if (t.status !== "STOPPED") return false;
    if (!t.end) return false;
    const task = projectTasks.find((pt) => pt.id === t.taskId);
    if (!task) return false;
    return t.end.toISOString().startsWith(monthPrefix);
  });

  const grouped = logs.map((l) => {
    const user = users.find((u) => u.id === l.userId);
    const task = tasks.find((t) => t.id === l.taskId);
    return {
      timelogId: l.id,
      task: task?.title,
      user: user?.name,
      hours: l.hours,
      costClient: l.costClient,
      date: l.end?.toISOString(),
    };
  });

  res.json({
    project: project.name,
    client: project.client,
    month: monthPrefix,
    entries: grouped,
    totalCostClient: grouped.reduce((acc, g) => acc + (g.costClient ?? 0), 0),
    note: "Placeholder de PDF; generar PDF real en implementación completa",
  });
});

// Payroll CSV
app.get("/reports/:projectId/payroll.csv", (req, res) => {
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

  const header = "timelogId,usuario,tarea,horas,costo_interno,fecha";
  const rows = logs.map((l) => {
    const user = users.find((u) => u.id === l.userId);
    const task = tasks.find((t) => t.id === l.taskId);
    return [
      l.id,
      user?.name ?? "",
      task?.title ?? "",
      l.hours ?? 0,
      l.costInternal ?? 0,
      l.end?.toISOString() ?? "",
    ].join(",");
  });

  res.header("Content-Type", "text/csv");
  res.send([header, ...rows].join("\n"));
});

// Seed info
app.get("/seed", (_req, res) => {
  res.json({
    users,
    projects,
    assignments,
    tasks,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ChronusDev API escuchando en http://localhost:${PORT}`);
  console.log("Header x-user-id disponible. Ej: x-user-id: u-juan");
});
