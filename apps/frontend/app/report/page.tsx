'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProjectSummary, type ProjectSummary } from '../api';

function ReportContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    if (projectId) {
      loadSummary();
    }
  }, [projectId]);

  async function loadSummary() {
    try {
      const s = await getProjectSummary(projectId);
      setSummary(s);
    } catch (e) {
      console.error('Error cargando resumen:', e);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (!summary) {
    return <div className="p-6">Cargando...</div>;
  }

  const percentage = (summary.spent / summary.budget) * 100;

  return (
    <>
      <div className="hidden print:block">
        <style jsx global>{`
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
            .print-break { page-break-after: always; }
          }
        `}</style>
      </div>

      <div className="max-w-4xl mx-auto p-6 bg-white">
        <div className="no-print mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Reporte Mensual</h1>
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Imprimir / PDF
          </button>
        </div>

        <div className="space-y-6">
          {/* Header */}
          <div className="border-b pb-4">
            <h2 className="text-3xl font-bold mb-2">{summary.project.name}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Cliente:</span>
                <span className="ml-2 font-medium">{summary.project.client?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Mes:</span>
                <span className="ml-2 font-medium">{month}</span>
              </div>
            </div>
          </div>

          {/* Resumen Financiero */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Resumen Financiero</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Presupuesto Total</div>
                <div className="text-2xl font-bold">
                  {summary.currency} {summary.budget.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Consumido</div>
                <div className="text-2xl font-bold text-blue-600">
                  {summary.currency} {summary.spent.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Restante</div>
                <div className={`text-2xl font-bold ${
                  percentage < 75 ? 'text-green-600' :
                  percentage < 90 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {summary.currency} {summary.remaining.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Porcentaje utilizado</span>
                <span className="font-medium">{percentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    percentage < 75 ? 'bg-green-500' :
                    percentage < 90 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="border-t pt-4">
            <p className="text-sm text-gray-600">
              Este reporte muestra el consumo de presupuesto hasta la fecha indicada.
              Para más detalles, consulte el reporte completo en PDF.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <ReportContent />
    </Suspense>
  );
}
