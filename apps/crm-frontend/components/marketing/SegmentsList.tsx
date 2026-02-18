'use client';

import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../app/apiHelper';

export default function SegmentsList() {
    const [segments, setSegments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        loadSegments();
    }, []);

    const loadSegments = async () => {
        try {
            const data = await apiGet('/marketing/segments');
            setSegments(data as any[]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiPost('/marketing/segments', { name: newName, description: 'Created via UI', type: 'STATIC' });
            setNewName('');
            setIsCreating(false);
            loadSegments();
        } catch (error) {
            alert('Error creating segment');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando segmentos...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between mb-4">
                <h3 className="text-lg font-medium">Mis Listas de Contacto</h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                >
                    Nueva Lista
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleCreate} className="mb-6 bg-gray-50 p-4 rounded-lg flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Nombre de la lista</label>
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="Ej. Clientes VIP"
                            autoFocus
                        />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md text-sm">Guardar</button>
                    <button onClick={() => setIsCreating(false)} type="button" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancelar</button>
                </form>
            )}

            <div className="overflow-hidden border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contactos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {segments.map((segment) => (
                            <tr key={segment.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{segment.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{segment.type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{segment._count?.customers || 0}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(segment.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {segments.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    No hay listas creadas aún.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
