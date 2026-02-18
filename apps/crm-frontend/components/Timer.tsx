'use client';

import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { getCurrentTimer, startTimer, stopTimer, addNoteToTimer, getTasks, type TimeLog, type Task } from '../app/api';
import { useToast } from './Toast';

export default function Timer() {
  const [currentTimer, setCurrentTimer] = useState<TimeLog | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState('');
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
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
    const interval = setInterval(() => {
      loadCurrentTimer();
    }, 15000); // Reducido de 1s a 15s
    return () => clearInterval(interval);
  }, [mounted]);

  useEffect(() => {
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
      setAvailableTasks(tasks.filter(t => t.status !== 'DONE'));
    } catch (err) {
      console.error('Error cargando tareas:', err);
      setAvailableTasks([]);
    }
  }

  async function handleStart(taskId: string) {
    try {
      await startTimer(taskId);
      showToast('Timer iniciado', 'success');
      await loadCurrentTimer();
      await loadTasks();
      setShowTaskSelector(false);
    } catch (err) {
      console.error('Error starting timer:', err);
      showToast('Error al iniciar timer', 'error');
    }
  }

  async function handleStop() {
    if (!currentTimer) return;
    try {
      stoppedTimelogId.current = currentTimer.id;
      await stopTimer(currentTimer.id);
      showToast('Timer detenido', 'info');
      setCurrentTimer(null);
      setShowNoteModal(true);
      setNote('');
    } catch (err) {
      console.error('Error stopping timer:', err);
      showToast('Error al detener timer', 'error');
    }
  }

  async function handleSaveNote() {
    if (!stoppedTimelogId.current) return;
    try {
      await addNoteToTimer(stoppedTimelogId.current, note);
      showToast('Nota guardada', 'success');
      setShowNoteModal(false);
      setNote('');
      stoppedTimelogId.current = null;
      await loadCurrentTimer();
    } catch (err) {
      console.error('Error saving note:', err);
      showToast('Error al guardar nota', 'error');
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

  if (!mounted) return null;

  // Modal para agregar nota
  if (showNoteModal) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-fadeIn">
        <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 p-6 w-96 overflow-hidden">
          {/* Gradiente decorativo */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100 mb-1">✨ ¿Cómo te fue?</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Agrega una nota sobre lo que trabajaste</p>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Corregí el bug del login..."
            className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl mb-4 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50/50 dark:bg-slate-800/50 dark:text-slate-200"
            rows={3}
            autoFocus
          />

          <div className="flex gap-3">
            <button
              onClick={handleSaveNote}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              💾 Guardar
            </button>
            <button
              onClick={handleSkipNote}
              className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-gray-600"
            >
              Omitir
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Selector de tareas
  if (showTaskSelector) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-fadeIn">
        <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 p-6 w-96 max-h-[70vh] overflow-hidden">
          {/* Gradiente decorativo */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />

          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">🎯 Seleccionar tarea</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">¿En qué vas a trabajar?</p>
            </div>
            <button
              onClick={() => setShowTaskSelector(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              ✕
            </button>
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
                  onClick={() => handleStart(task.id)}
                  className="w-full text-left p-4 border border-gray-100 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-200 transition-all group"
                >
                  <div className="font-medium text-gray-800 group-hover:text-blue-700 transition-colors">
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${task.status === 'BACKLOG'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-yellow-100 text-yellow-700'
                      }`}>
                      {task.status === 'BACKLOG' ? '📋 Backlog' : '🔄 En progreso'}
                    </span>
                    {task.totalHours && task.totalHours > 0 && (
                      <span className="text-xs text-gray-400">
                        ⏱️ {task.totalHours.toFixed(1)}h
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Timer principal
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fadeIn">
      <div
        className={`relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden transition-all duration-300 ${isExpanded ? 'w-80' : 'w-auto'
          }`}
      >
        {/* Gradiente superior según estado */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${currentTimer && !currentTimer.end
          ? 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 animate-pulse'
          : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
          }`} />

        {isExpanded ? (
          <div className="p-6">
            {currentTimer && !currentTimer.end ? (
              <>
                {/* Timer activo */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Grabando
                    </div>
                    <div className="font-bold text-lg text-gray-800 dark:text-slate-100 line-clamp-1">
                      {currentTimer.task?.title || 'Sin tarea'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-500">{currentTimer.project?.name}</div>
                  </div>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-400"
                  >
                    −
                  </button>
                </div>

                {/* Display del tiempo */}
                <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 mb-4">
                  <div className="text-4xl font-mono font-bold text-center bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {formatTime(elapsed)}
                  </div>
                  <div className="text-center text-gray-400 text-xs mt-1">
                    Desde las {format(new Date(currentTimer.start), 'HH:mm')}
                  </div>
                </div>

                {/* Botón detener */}
                <button
                  onClick={handleStop}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3.5 rounded-xl font-bold hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50 flex items-center justify-center gap-2"
                >
                  <span className="w-3 h-3 bg-white rounded-sm" />
                  Detener
                </button>
              </>
            ) : (
              <>
                {/* Timer inactivo */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">Timer</div>
                    <div className="font-bold text-gray-800 dark:text-slate-100">Sin actividad</div>
                  </div>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-400"
                  >
                    −
                  </button>
                </div>

                {/* Display inactivo */}
                <div className="bg-gray-100 rounded-xl p-4 mb-4">
                  <div className="text-4xl font-mono font-bold text-center text-gray-300">
                    00:00:00
                  </div>
                </div>

                {/* Botón iniciar */}
                <button
                  onClick={() => {
                    loadTasks();
                    setShowTaskSelector(true);
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3.5 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 flex items-center justify-center gap-2"
                >
                  <span className="text-lg">▶</span>
                  Iniciar Timer
                </button>
              </>
            )}
          </div>
        ) : (
          // Vista compacta
          <button
            onClick={() => setIsExpanded(true)}
            className="p-4 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
          >
            {currentTimer && !currentTimer.end ? (
              <>
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                  {formatTime(elapsed)}
                </span>
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
}
