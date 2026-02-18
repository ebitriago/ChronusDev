'use client';

import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { getCurrentTimer, startTimer, stopTimer, addNoteToTimer, getTasks, createTimeLog, getProjects, type TimeLog, type Task, type Project } from '../app/api';
import { useToast } from './Toast';

export default function Timer() {
  const [currentTimer, setCurrentTimer] = useState<TimeLog | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState('');

  // Tasks & Projects for selection
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);

  // Modals state
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Manual Entry Form
  const [manualProjectId, setManualProjectId] = useState('');
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  // Anti-Spam / Loading State
  const [loading, setLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const stoppedTimelogId = useRef<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    loadCurrentTimer();
    loadTasks();
    // Optimized Polling: 10s for better responsiveness
    const interval = setInterval(() => {
      loadCurrentTimer();
    }, 10000);
    return () => clearInterval(interval);
  }, [mounted]);

  useEffect(() => {
    // Timer is running if currentTimer exists and end is null (no status field from API)
    const isRunning = currentTimer && !currentTimer.end;

    if (isRunning) {
      const start = new Date(currentTimer.start).getTime();
      const update = () => {
        const now = Date.now();
        setElapsed((now - start) / 1000);
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsed(0);
    }
  }, [currentTimer]);

  async function loadCurrentTimer() {
    try {
      const timer = await getCurrentTimer();
      setCurrentTimer(timer);
    } catch (err) {
      console.error('Error loading timer:', err);
    }
  }

  async function loadTasks() {
    try {
      const tasks = await getTasks();
      const tasksArray = Array.isArray(tasks) ? tasks : [];
      setAvailableTasks(tasksArray.filter(t => t.status !== 'DONE'));
    } catch (err) {
      console.error('Error cargando tareas:', err);
      setAvailableTasks([]);
    }
  }

  async function loadProjects() {
    try {
      const projs = await getProjects();
      const projsArray = Array.isArray(projs) ? projs : [];
      setAvailableProjects(projsArray.filter(p => p.status === 'ACTIVE'));
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }

  async function handleStart(taskId: string) {
    try {
      setLoading(true);
      const task = availableTasks.find(t => t.id === taskId);
      if (!task) {
        showToast('Tarea no encontrada', 'error');
        return;
      }

      await startTimer(taskId, task.projectId);
      showToast('Timer iniciado', 'success');
      await loadCurrentTimer();
      await loadTasks();
      setShowTaskSelector(false);
    } catch (err: any) {
      console.error('Error starting timer:', err);
      showToast(err.message || 'Error al iniciar timer', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!currentTimer) return;
    try {
      setLoading(true);
      stoppedTimelogId.current = currentTimer.id;
      await stopTimer(currentTimer.id);
      showToast('Timer detenido', 'info');
      setCurrentTimer(null);
      // Force reload to sync state with server
      await loadCurrentTimer();
      setShowNoteModal(true);
      setNote('');
    } catch (err) {
      console.error('Error stopping timer:', err);
      showToast('Error al detener timer', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNote() {
    if (!stoppedTimelogId.current) return;
    try {
      setLoading(true);
      await addNoteToTimer(stoppedTimelogId.current, note);
      showToast('Nota guardada', 'success');
      setShowNoteModal(false);
      setNote('');
      stoppedTimelogId.current = null;
      await loadCurrentTimer();
      // Force refresh tasks too in case status changed
      loadTasks();
    } catch (err) {
      console.error('Error saving note:', err);
      showToast('Error al guardar nota', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleSkipNote() {
    setShowNoteModal(false);
    setNote('');
    stoppedTimelogId.current = null;
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async function openManualEntry() {
    await loadProjects();
    await loadTasks();
    // Set default times (last hour)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    setManualEnd(now.toISOString().slice(0, 16));
    setManualStart(oneHourAgo.toISOString().slice(0, 16));

    setShowManualEntry(true);
  }

  async function handleManualSubmit() {
    if (!manualProjectId || !manualStart || !manualEnd) {
      showToast('Faltan campos requeridos', 'error');
      return;
    }

    // Validate dates
    const startDate = new Date(manualStart);
    const endDate = new Date(manualEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      showToast('Fechas inválidas', 'error');
      return;
    }

    if (endDate <= startDate) {
      showToast('La fecha fin debe ser posterior al inicio', 'error');
      return;
    }
    try {
      setLoading(true);
      await createTimeLog({
        projectId: manualProjectId,
        taskId: manualTaskId || undefined,
        start: new Date(manualStart).toISOString(),
        end: new Date(manualEnd).toISOString(),
        description: manualDesc
      });
      showToast('Log manual creado', 'success');
      setShowManualEntry(false);
      // Reset form
      setManualProjectId('');
      setManualTaskId('');
      setManualDesc('');
    } catch (err: any) {
      showToast(err.message || 'Error creando log', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  // Manual Entry Modal
  if (showManualEntry) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">⏱️ Carga Manual</h3>
            <button onClick={() => setShowManualEntry(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proyecto *</label>
              <select
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={manualProjectId}
                onChange={(e) => setManualProjectId(e.target.value)}
              >
                <option value="" className="text-gray-500">Seleccionar Proyecto</option>
                {availableProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tarea (Opcional - Busque en todos los proyectos o seleccione uno arriba)</label>
              <select
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={manualTaskId}
                onChange={(e) => {
                  const tid = e.target.value;
                  setManualTaskId(tid);
                  if (tid) {
                    const task = availableTasks.find(t => t.id === tid);
                    if (task && task.projectId !== manualProjectId) {
                      setManualProjectId(task.projectId);
                    }
                  }
                }}
              >
                <option value="">Sin tarea específica</option>
                {/* Si no hay proyecto seleccionado, mostrar tareas agrupadas por proyecto */}
                {!manualProjectId ? (
                  availableProjects.map(proj => {
                    const projectTasks = availableTasks.filter(t => t.projectId === proj.id);
                    if (projectTasks.length === 0) return null;
                    return (
                      <optgroup key={proj.id} label={`📂 ${proj.name}`}>
                        {projectTasks.map(t => (
                          <option key={t.id} value={t.id}>{t.title} ({t.status})</option>
                        ))}
                      </optgroup>
                    );
                  })
                ) : (
                  <>
                    <optgroup label="⚡ En Progreso">
                      {availableTasks
                        .filter(t => t.projectId === manualProjectId && t.status === 'IN_PROGRESS')
                        .map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </optgroup>
                    <optgroup label="📋 Por Hacer">
                      {availableTasks
                        .filter(t => t.projectId === manualProjectId && t.status === 'TODO')
                        .map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </optgroup>
                    <optgroup label="👀 En Revisión">
                      {availableTasks
                        .filter(t => t.projectId === manualProjectId && t.status === 'REVIEW')
                        .map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </optgroup>
                    <optgroup label="📥 Backlog">
                      {availableTasks
                        .filter(t => t.projectId === manualProjectId && t.status === 'BACKLOG')
                        .map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </optgroup>
                  </>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inicio *</label>
                <input
                  type="datetime-local"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-lg"
                  value={manualStart}
                  onChange={e => setManualStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fin *</label>
                <input
                  type="datetime-local"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-lg"
                  value={manualEnd}
                  onChange={e => setManualEnd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción (¿Qué trabajo realizaste?)</label>
              <textarea
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-slate-700 rounded-lg placeholder-gray-400 dark:placeholder-gray-500"
                rows={2}
                value={manualDesc}
                onChange={e => setManualDesc(e.target.value)}
                placeholder="Describe el trabajo realizado..."
              />
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-slate-800 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={() => setShowManualEntry(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg" disabled={loading}>Cancelar</button>
            <button onClick={handleManualSubmit} disabled={loading} className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {loading ? 'Guardando...' : 'Guardar Log'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal para agregar nota
  if (showNoteModal) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-fadeIn bg-transparent">
        <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 p-6 w-96 overflow-hidden">
          {/* Gradiente decorativo */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-1">✨ ¿Cómo te fue?</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Agrega una nota sobre lo que trabajaste</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Corregí el bug del login..."
            className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl mb-4 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            rows={3}
            autoFocus
          />
          <div className="flex gap-3">
            <button onClick={handleSaveNote} disabled={loading} className={`flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25 ${loading ? 'opacity-70 cursor-wait' : ''}`}>
              {loading ? 'Guardando...' : '💾 Guardar'}
            </button>
            <button onClick={handleSkipNote} disabled={loading} className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-gray-600">Omitir</button>
          </div>
        </div>
      </div>
    );
  }

  // Selector de tareas
  if (showTaskSelector) {
    return (
      <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 z-50 flex items-center justify-center md:block animate-fadeIn">
        <div className="absolute inset-0 bg-black/50 md:hidden backdrop-blur-sm" onClick={() => setShowTaskSelector(false)} />
        <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 p-6 w-[90vw] md:w-96 max-h-[70vh] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">🎯 Seleccionar tarea</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">¿En qué vas a trabajar?</p>
            </div>
            <button onClick={() => setShowTaskSelector(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {availableTasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-500 text-sm">No hay tareas disponibles</p>
              </div>
            ) : (
              availableTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => !loading && handleStart(task.id)}
                  disabled={loading}
                  className={`w-full text-left p-4 border border-gray-100 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-200 transition-all group ${loading ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <div className="font-medium text-gray-800 group-hover:text-blue-700 transition-colors">{task.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${task.status === 'BACKLOG' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
                      {task.status === 'BACKLOG' ? '📋 Backlog' : '🔄 En progreso'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
          {/* Footer with Manual Entry Link */}
          <div className="mt-4 pt-3 border-t border-gray-100 text-center">
            <button onClick={() => { setShowTaskSelector(false); openManualEntry(); }} className="text-sm text-blue-600 font-medium hover:underline">
              o carga una entrada manual 📝
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== RENDER ==========

  // 1. Mobile FAB (Visible only on mobile)
  const mobileFab = (
    <div className="fixed bottom-24 right-4 z-40 md:hidden flex flex-col items-end gap-3">
      {currentTimer && !currentTimer.end ? (
        <button
          onClick={() => setIsExpanded(true)} // Opens the main widget modal style
          className="flex items-center gap-2 bg-red-500 text-white px-4 py-3 rounded-full shadow-lg shadow-red-500/30 font-bold animate-pulse"
        >
          <span className="w-2 h-2 bg-white rounded-full" />
          {formatTime(elapsed)}
        </button>
      ) : (
        <button
          onClick={() => { loadTasks(); setShowTaskSelector(true); }}
          className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-purple-600 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center text-2xl"
        >
          ▶
        </button>
      )}
    </div>
  );

  // 2. Desktop Widget (Hidden on mobile)
  const desktopWidget = (
    <div className="hidden md:block fixed bottom-6 right-6 z-50 animate-fadeIn" data-tour="timer">
      <div className={`relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden transition-all duration-300 ${isExpanded ? 'w-80' : 'w-auto'}`}>
        <div className={`absolute top-0 left-0 right-0 h-1 ${currentTimer && !currentTimer.end ? 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 animate-pulse' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'}`} />

        {isExpanded ? (
          <div className="p-6">
            {currentTimer && !currentTimer.end ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Grabando
                    </div>
                    <div className="font-bold text-lg text-gray-800 dark:text-slate-100 line-clamp-1">{currentTimer.task?.title || 'Sin tarea'}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500">{currentTimer.project?.name}</div>
                  </div>
                  <button onClick={() => setIsExpanded(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">−</button>
                </div>
                <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 mb-4">
                  <div className="text-4xl font-mono font-bold text-center bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">{formatTime(elapsed)}</div>
                </div>
                <button onClick={handleStop} disabled={loading} className={`w-full bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3.5 rounded-xl font-bold hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-wait' : ''}`}>
                  <span className="w-3 h-3 bg-white rounded-sm" /> Detener
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">Timer</div>
                    <div className="font-bold text-gray-800 dark:text-slate-100">Sin actividad</div>
                  </div>
                  <button onClick={() => setIsExpanded(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">−</button>
                </div>
                <div className="bg-gray-100 rounded-xl p-4 mb-4">
                  <div className="text-4xl font-mono font-bold text-center text-gray-300">00:00:00</div>
                </div>
                <button onClick={() => { loadTasks(); setShowTaskSelector(true); }} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3.5 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                  <span className="text-lg">▶</span> Iniciar Timer
                </button>
                <div className="mt-3 text-center">
                  <button onClick={openManualEntry} className="text-xs text-blue-600 hover:underline">
                    + Carga Manual
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button onClick={() => setIsExpanded(true)} className="p-4 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
            {currentTimer && !currentTimer.end ? (
              <>
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono font-bold text-gray-800 dark:text-slate-200">{formatTime(elapsed)}</span>
              </>
            ) : (
              <>
                <span className="w-3 h-3 bg-gray-300 dark:bg-slate-600 rounded-full" />
                <span className="font-medium text-gray-500 dark:text-slate-400">Timer</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {mobileFab}
      {desktopWidget}

      {/* Mobile-only Modal for Expanded View when FAB is clicked while Running */}
      {isExpanded && currentTimer && !currentTimer.end && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setIsExpanded(false)}>
          <div className="bg-white dark:bg-slate-900 w-full rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Timer Activo</h3>
              <button onClick={() => setIsExpanded(false)} className="text-gray-400">✕</button>
            </div>
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 mb-6">
              <div className="text-5xl font-mono font-bold text-center bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">{formatTime(elapsed)}</div>
              <div className="text-center text-gray-400 mt-2">{currentTimer.task?.title}</div>
            </div>
            <button onClick={handleStop} disabled={loading} className={`w-full bg-red-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-red-500/30 ${loading ? 'opacity-70' : ''}`}>
              Detener Timer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
