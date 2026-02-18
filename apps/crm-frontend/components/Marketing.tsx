'use client';

import React, { useState } from 'react';
import SegmentsList from './marketing/SegmentsList';
import CampaignsList from './marketing/CampaignsList';

export default function Marketing() {
    const [activeTab, setActiveTab] = useState<'campaigns' | 'segments'>('campaigns');

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn min-h-[600px]">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Gestión de Campañas</h2>
                    <p className="text-sm text-gray-500">Envía correos masivos a tus segmentos de clientes</p>
                </div>
                <div className="flex space-x-1 bg-white p-1 rounded-lg border border-gray-200">
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'campaigns'
                                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        Campañas
                    </button>
                    <button
                        onClick={() => setActiveTab('segments')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'segments'
                                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        Segmentos
                    </button>
                </div>
            </div>

            <div className="bg-white">
                {activeTab === 'campaigns' ? <CampaignsList /> : <SegmentsList />}
            </div>
        </div>
    );
}
