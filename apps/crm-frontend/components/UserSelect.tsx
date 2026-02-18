'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '../app/api';

type User = {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
};

type Props = {
    value?: string;
    onChange: (userId: string) => void;
    label?: string;
};

export default function UserSelect({ value, onChange, label = "Asignar a" }: Props) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('crm_token');
                const res = await fetch(`${API_URL}/organization/users`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    setUsers(await res.json());
                }
            } catch (e) {
                console.error("Error fetching users", e);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const selectedUser = users.find(u => u.id === value);

    return (
        <div>
            {label && <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{label}</label>}
            <div className="relative">
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    disabled={loading}
                >
                    <option value="">Sin asignar</option>
                    {users.map(user => (
                        <option key={user.id} value={user.id}>
                            {user.name}
                        </option>
                    ))}
                </select>
                {/* Avatar / Icon Overlay */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {selectedUser ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                            {selectedUser.name.charAt(0)}
                        </div>
                    ) : (
                        <span className="text-gray-400">👤</span>
                    )}
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                    ▼
                </div>
            </div>
            {selectedUser && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    ✓ Asignado a {selectedUser.name}
                </p>
            )}
        </div>
    );
}
