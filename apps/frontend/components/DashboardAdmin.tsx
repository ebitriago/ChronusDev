'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getProjects, getProjectSummary, downloadReportPDF, downloadPayrollCSV, type Project, type ProjectSummary } from '../app/api';
import { format } from 'date-fns';

export default function DashboardAdmin() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({});
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const projs = await getProjects();
    setProjects(projs);
    const sums: Record<string, ProjectSummary> = {};
    for (const p of projs) {
      try {
        sums[p.id] = await getProjectSummary(p.id);
      } catch (e) {
        console.error(`Error cargando resumen de ${p.id}:`, e);
      }
    }
    setSummaries(sums);
  }

  function getBudgetColor(percentage: number): string {
    if (percentage < 75) return '#10b981'; // verde
    if (percentage < 90) return '#f59e0b'; // amarillo
    return '#ef4444'; // rojo
  }

  function getBudgetStatus(percentage: number): string {
    if (percentage < 75) return 'Saludable';
    if (percentage < 90) return 'Atención';
    return 'Crítico';
  }

  const chartData = projects.map((p) => {
    const summary = summaries[p.id];
    if (!summary) return null;
    const percentage = (summary.costClient / summary.budgetClient) * 100;
    return {
      name: p.name,
      presupuesto: summary.budgetClient,
      consumido: summary.costClient,
      restante: summary.remaining,
      porcentaje: percentage,
      color: getBudgetColor(percentage),
    };
  }).filter(Boolean);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard Admin</h1>
        <div className="flex gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const summary = summaries[project.id];
          if (!summary) return null;
          const percentage = (summary.costClient / summary.budgetClient) * 100;
          const color = getBudgetColor(percentage);
          const status = getBudgetStatus(percentage);

          return (
            <div key={project.id} className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderLeftColor: color }}>
              <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Presupuesto:</span>
                  <span className="font-medium">{summary.currency} {summary.budgetClient.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Consumido:</span>
                  <span className="font-medium">{summary.currency} {summary.costClient.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Restante:</span>
                  <span className="font-medium">{summary.currency} {summary.remaining.toFixed(2)}</span>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{percentage.toFixed(1)}% usado</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      percentage < 75 ? 'bg-green-100 text-green-800' :
                      percentage < 90 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {status}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
                    ></div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => downloadReportPDF(project.id, selectedMonth)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                  >
                    PDF Cliente
                  </button>
                  <button
                    onClick={() => downloadPayrollCSV(project.id, selectedMonth)}
                    className="flex-1 bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
                  >
                    CSV Nómina
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Comparación Presupuesto vs Consumo</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'presupuesto') return [`$${value.toLocaleString()}`, 'Presupuesto'];
                  if (name === 'consumido') return [`$${value.toFixed(2)}`, 'Consumido'];
                  return [value, name];
                }}
              />
              <Bar dataKey="presupuesto" fill="#94a3b8" name="Presupuesto Total" />
              <Bar dataKey="consumido" name="Consumo Actual">
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
