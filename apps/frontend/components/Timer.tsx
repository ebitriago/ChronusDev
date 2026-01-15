'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { getCurrentTimer, startTimer, stopTimer, addNoteToTimer, getTasks, type TimeLog, type Task } from '../app/api';

export default function Timer() {
  const [currentTimer, setCurrentTimer] = useState<TimeLog | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState('');
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      loadCurrentTimer();
      loadTasks();
      const interval = setInterval(() => {
        loadCurrentTimer();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  if (!mounted) return null;

  useEffect(() => {
    if (currentTimer?.status === 'RUNNING') {
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
    const timer = await getCurrentTimer();
    setCurrentTimer(timer);
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
    await startTimer(taskId);
    await loadCurrentTimer();
    await loadTasks();
    setShowTaskSelector(false);
  }

  async function handleStop() {
    if (!currentTimer) return;
    const stopped = await stopTimer(currentTimer.id);
    setCurrentTimer(null);
    setShowNoteModal(true);
    setNote('');
  }

  async function handleSaveNote() {
    if (!currentTimer) return;
    await addNoteToTimer(currentTimer.id, note);
    setShowNoteModal(false);
    setNote('');
    await loadCurrentTimer();
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  if (showNoteModal && currentTimer) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">Agregar nota descriptiva</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: Corrigiendo bug en login..."
          className="w-full p-3 border rounded-lg mb-4 resize-none"
          rows={3}
        />
        <div className="flex gap-2">
          <button
            onClick={handleSaveNote}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Guardar
          </button>
          <button
            onClick={() => {
              setShowNoteModal(false);
              setNote('');
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            Omitir
          </button>
        </div>
      </div>
    );
  }

  if (showTaskSelector) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-6 w-96 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Seleccionar tarea</h3>
          <button
            onClick={() => setShowTaskSelector(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          {availableTasks.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay tareas disponibles</p>
          ) : (
            availableTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleStart(task.id)}
                className="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
              >
                <div className="font-medium">{task.title}</div>
                <div className="text-xs text-gray-500">
                  {task.status === 'BACKLOG' ? 'Backlog' : 'En progreso'}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-6 min-w-[320px]" suppressHydrationWarning>
      {currentTimer?.status === 'RUNNING' ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-600">Tarea activa</div>
              <div className="font-semibold text-lg">{currentTimer.task?.title || 'Sin tarea'}</div>
              <div className="text-xs text-gray-500">{currentTimer.project?.name}</div>
            </div>
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          </div>
          <div className="text-4xl font-mono font-bold text-blue-600 mb-4 text-center">
            {formatTime(elapsed)}
          </div>
          <div className="text-xs text-gray-500 text-center mb-4">
            Iniciado: {format(new Date(currentTimer.start), 'HH:mm:ss')}
          </div>
          <button
            onClick={handleStop}
            className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
          >
            Detener
          </button>
        </>
      ) : (
        <>
          <div className="text-center mb-4">
            <div className="text-sm text-gray-600 mb-2">Sin timer activo</div>
            <div className="text-2xl font-mono font-bold text-gray-400">00:00:00</div>
          </div>
          <button
            onClick={() => {
              loadTasks();
              setShowTaskSelector(true);
            }}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Iniciar Timer
          </button>
        </>
      )}
    </div>
  );
}
