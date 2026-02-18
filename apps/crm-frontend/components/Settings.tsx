'use client';

import { useState, useEffect } from 'react';
import SettingsSidebar from './SettingsSidebar';
import GeneralSettings from './GeneralSettings';
import NotificationSettings from './NotificationSettings';
import TagsSettings from './TagsSettings';
import Integrations from './Integrations';
import WhatsAppConfig from './WhatsAppConfig';
import EmailSettings from './EmailSettings';
import TeamSettings from './TeamSettings';
import OrgSettings from './OrgSettings';
import BillingSettings from './BillingSettings';
import ReminderSettings from './ReminderSettings';
import AISettings from './AISettings';
import AutomationSettings from './AutomationSettings';
import { API_URL } from '../app/api'; // Ensure this uses the centralized API URL

export default function Settings() {
    const [activeTab, setActiveTab] = useState<'profile' | 'tags' | 'whatsapp' | 'integrations' | 'notifications' | 'organization' | 'reminders' | 'email' | 'team' | 'billing' | 'ai' | 'automation'>('profile');
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        // Get user role from local storage to determine visibility
        const userStr = localStorage.getItem('crm_user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setUserRole(user.role);
            } catch (e) { console.error(e); }
        }
    }, []);

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return <GeneralSettings />;
            case 'notifications':
                return <NotificationSettings />;
            case 'tags':
                return <TagsSettings />;
            case 'team':
                return <TeamSettings />;
            case 'organization':
                return <OrgSettings />;
            case 'billing':
                return <BillingSettings />;
            case 'integrations':
                return <Integrations onNavigate={setActiveTab} />;
            case 'whatsapp':
                return <WhatsAppConfig />;
            case 'email':
                return <EmailSettings />;
            case 'ai':
                return <AISettings />;
            case 'reminders':
                return <ReminderSettings />;
            default:
                return <GeneralSettings />;
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-140px)] bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Sidebar */}
            <SettingsSidebar
                activeTab={activeTab as any}
                setActiveTab={setActiveTab as any}
                userRole={userRole}
            />

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-4xl min-w-0">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}
