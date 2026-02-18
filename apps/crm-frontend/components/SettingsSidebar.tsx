import React from 'react';

type SettingsTab = 'profile' | 'notifications' | 'team' | 'tags' | 'organization' | 'integrations' | 'whatsapp' | 'email' | 'reminders' | 'ai' | 'automation';

type SettingsSidebarProps = {
    activeTab: SettingsTab;
    setActiveTab: (tab: SettingsTab) => void;
    userRole?: string | null;
};

export default function SettingsSidebar({ activeTab, setActiveTab, userRole }: SettingsSidebarProps) {
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    const menuItems = [
        {
            category: 'General',
            items: [
                { id: 'profile', label: 'Mi Perfil', icon: '👤' },
                { id: 'notifications', label: 'Notificaciones', icon: '🔔' },
            ]
        },
        {
            category: 'Espacio de Trabajo',
            items: [
                { id: 'team', label: 'Equipo', icon: '👥', hidden: !isAdmin },
                { id: 'organization', label: 'Organización', icon: 'Building' },
                { id: 'billing', label: 'Facturación', icon: 'CreditCard' },
                { id: 'tags', label: 'Etiquetas', icon: 'Tag' },
            ]
        },
        {
            category: 'Comunicación',
            items: [
                { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
                { id: 'email', label: 'Email SMTP', icon: '📧' },
                { id: 'integrations', label: 'Integraciones', icon: '🔌' },
                { id: 'ai', label: 'Inteligencia Artificial', icon: '✨' },
            ]
        },
        {
            category: 'Automatización',
            items: [
                { id: 'reminders', label: 'Recordatorios', icon: '⏰', hidden: !isAdmin },
                { id: 'automation', label: 'Reglas Auto', icon: '⚡', hidden: !isAdmin },
            ]
        }
    ];

    return (
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-100 flex-shrink-0 md:h-full p-4 overflow-y-auto">
            <nav className="flex md:flex-col gap-2 md:gap-8 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-hide">
                {menuItems.map((group, idx) => (
                    <div key={idx} className="flex-shrink-0">
                        <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 hidden md:block">
                            {group.category}
                        </h3>
                        <div className="flex md:flex-col gap-1">
                            {group.items.filter(item => !item.hidden).map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id as SettingsTab)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    <span className="text-base">{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
