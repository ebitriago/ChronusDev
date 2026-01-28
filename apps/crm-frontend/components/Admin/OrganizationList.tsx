"use client";

import { useState, useEffect } from "react";

interface Organization {
    id: string;
    name: string;
    slug: string;
    enabledServices: string; // "CRM,CHRONUSDEV"
    // ... other fields
}

export default function OrganizationList() {
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [newAdminEmail, setNewAdminEmail] = useState("");
    const [newAdminPassword, setNewAdminPassword] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [creationSuccess, setCreationSuccess] = useState<{ email: string; password?: string; name: string } | null>(null);

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

    const toggleService = async (orgId: string, service: string, currentServices: string) => {
        const services = currentServices.split(',');
        let newServices;
        if (services.includes(service)) {
            newServices = services.filter(s => s !== service).join(',');
        } else {
            newServices = [...services, service].join(',');
        }

        // Optimistic update
        setOrgs(orgs.map(o => o.id === orgId ? { ...o, enabledServices: newServices } : o));

        try {
            await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/organizations/${orgId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem("crm_token")}`
                },
                body: JSON.stringify({ enabledServices: newServices })
            });
        } catch (error) {
            console.error(error);
            fetchOrgs();
        }
    };


    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/organizations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem("crm_token")}`
                },
                body: JSON.stringify({
                    name: newOrgName,
                    adminEmail: newAdminEmail,
                    adminPassword: newAdminPassword,
                    enabledServices: "CRM"
                })
            });

            if (res.ok) {
                const data = await res.json();
                setShowCreateModal(false);
                setNewOrgName("");
                setNewAdminEmail("");
                setNewAdminPassword("");
                fetchOrgs();

                // Show success modal if user was created
                if (data.newUserCreated) {
                    setCreationSuccess({
                        name: data.name,
                        email: data.adminEmail,
                        password: data.initialPassword
                    });
                }
            } else {
                alert("Error creando la organización");
            }
        } catch (error) {
            console.error(error);
            alert("Error creando la organización");
        } finally {
            setIsCreating(false);
        }
    };

    const toggleStatus = async (orgId: string, currentStatus: string) => {
        if (!confirm("Are you sure you want to change the status of this organization?")) return;

        const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        // Optimistic
        setOrgs(orgs.map(o => o.id === orgId ? { ...o, subscriptionStatus: newStatus } : o));

        try {
            await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/organizations/${orgId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem("crm_token")}`
                },
                body: JSON.stringify({ subscriptionStatus: newStatus }) // Needs backend support
            });
        } catch (err) {
            console.error(err);
            fetchOrgs(); // Revert
        }
    };

    if (loading) return <div>Loading organizations...</div>;

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Organizations</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    + New Organization
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan / Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Services</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Users</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {orgs.map((org: any) => (
                            <tr key={org.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{org.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{org.slug}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${org.plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800' :
                                            org.plan === 'PRO' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {org.plan || 'FREE'}
                                    </span>
                                    <div className={`text-[10px] font-bold mt-1 ${org.subscriptionStatus === 'SUSPENDED' ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {org.subscriptionStatus || 'ACTIVE'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleService(org.id, 'CRM', org.enabledServices)}
                                            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${org.enabledServices.includes('CRM') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                                        >
                                            CRM
                                        </button>
                                        <button
                                            onClick={() => toggleService(org.id, 'CHRONUSDEV', org.enabledServices)}
                                            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${org.enabledServices.includes('CHRONUSDEV') ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                                        >
                                            ChronusDev
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {org._count?.users || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    <button
                                        className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-3"
                                        onClick={() => alert("Edit not implemented fully yet")}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(org.id, org.subscriptionStatus || 'ACTIVE')}
                                        className={`${org.subscriptionStatus === 'SUSPENDED' ? 'text-emerald-600' : 'text-red-600'} hover:underline`}
                                    >
                                        {org.subscriptionStatus === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Org Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-fadeIn">
                            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Create New Organization</h3>
                            <form onSubmit={handleCreateOrg} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newOrgName}
                                        onChange={(e) => setNewOrgName(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        placeholder="Acme Corp"
                                    />
                                </div>
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                    <p className="text-sm font-semibold mb-2 text-gray-500 uppercase">First Admin User</p>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Email</label>
                                    <input
                                        type="email"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        placeholder="admin@acme.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Password (Optional)</label>
                                    <input
                                        type="text"
                                        value={newAdminPassword}
                                        onChange={(e) => setNewAdminPassword(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono"
                                        placeholder="Leave empty to auto-generate"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreating}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isCreating ? 'Creating...' : 'Create Organization'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Success Modal */}
            {creationSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-fadeIn border-2 border-emerald-500">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🎉</div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Organization Ready!</h3>
                            <p className="text-gray-500 dark:text-gray-400">"{creationSuccess.name}" has been created.</p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin Credentials</p>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Email:</span>
                                    <span className="font-mono font-medium text-slate-900 dark:text-white select-all">{creationSuccess.email}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Password:</span>
                                    <span className="font-mono font-bold text-emerald-600 select-all">{creationSuccess.password}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg flex gap-2 items-start mb-6">
                            <span>⚠️</span>
                            <p>Please copy these credentials and send them to the user securely. Require them to change the password upon first login.</p>
                        </div>

                        <button
                            onClick={() => setCreationSuccess(null)}
                            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
