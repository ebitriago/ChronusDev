"use client";

import { useState, useEffect } from "react";

interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: string;
    subscriptionStatus: string;
    trialEndsAt: string | null;
    _count?: { users: number };
}

export default function SubscriptionManager() {
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

    const fetchOrgs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/organizations`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("crm_token")}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOrgs(data);
            }
        } catch (error) {
            console.error("Error fetching orgs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrgs();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrg) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/organizations/${editingOrg.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem("crm_token")}`
                },
                body: JSON.stringify({
                    plan: editingOrg.plan,
                    subscriptionStatus: editingOrg.subscriptionStatus,
                    trialEndsAt: editingOrg.trialEndsAt
                })
            });

            if (res.ok) {
                setEditingOrg(null);
                fetchOrgs();
                alert("Subscription updated successfully!");
            } else {
                alert("Failed to update subscription");
            }
        } catch (error) {
            console.error(error);
            alert("Error updating subscription");
        }
    };

    if (loading && orgs.length === 0) return <div className="p-8 text-center text-gray-500">Loading subscriptions...</div>;

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-6">Subscription Management</h2>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trial Ends</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {orgs.map((org) => (
                            <tr key={org.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{org.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{org.slug}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${org.plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800' :
                                            org.plan === 'PRO' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {org.plan}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${org.subscriptionStatus === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                            org.subscriptionStatus === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                                                org.subscriptionStatus === 'TRIALING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {org.subscriptionStatus}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {org.trialEndsAt ? new Date(org.trialEndsAt).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => setEditingOrg(org)}
                                        className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-400"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editingOrg && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-fadeIn">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Edit Subscription: {editingOrg.name}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan</label>
                                <select
                                    value={editingOrg.plan}
                                    onChange={(e) => setEditingOrg({ ...editingOrg, plan: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    <option value="FREE">FREE</option>
                                    <option value="BASIC">BASIC</option>
                                    <option value="PRO">PRO</option>
                                    <option value="ENTERPRISE">ENTERPRISE</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                <select
                                    value={editingOrg.subscriptionStatus}
                                    onChange={(e) => setEditingOrg({ ...editingOrg, subscriptionStatus: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="TRIALING">TRIALING</option>
                                    <option value="PAST_DUE">PAST_DUE</option>
                                    <option value="CANCELED">CANCELED</option>
                                    <option value="SUSPENDED">SUSPENDED</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trial Ends At</label>
                                <input
                                    type="date"
                                    value={editingOrg.trialEndsAt ? new Date(editingOrg.trialEndsAt).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setEditingOrg({ ...editingOrg, trialEndsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setEditingOrg(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
