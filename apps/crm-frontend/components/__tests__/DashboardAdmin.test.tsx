import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardAdmin from '../DashboardAdmin';

// Mock API modules
vi.mock('../../app/api', () => ({
    getProjects: vi.fn(),
    getClients: vi.fn(),
    getUsers: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    assignProjectMember: vi.fn(),
    removeProjectMember: vi.fn(),
    getProjectSummary: vi.fn(),
    downloadPayrollCSV: vi.fn(),
    API_URL: 'http://localhost:3000',
}));

vi.mock('../Toast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../AuthProvider', () => ({
    useAuth: () => ({ token: 'mock-token' }),
}));

// Mock Recharts to avoid issues with specialized rendering in JSDOM
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: () => <div>BarChart</div>,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Cell: () => null,
}));

import { getProjects, getClients, getUsers, getProjectSummary } from '../../app/api';

describe('DashboardAdmin Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mock returns
        (getProjects as any).mockResolvedValue([
            { id: 'p1', name: 'Project Alpha', clientId: 'c1', budget: 10000 }
        ]);
        (getClients as any).mockResolvedValue([
            { id: 'c1', name: 'Client A' }
        ]);
        (getUsers as any).mockResolvedValue([]);
        (getProjectSummary as any).mockResolvedValue({
            id: 'p1',
            budget: 10000,
            spent: 2000,
            remaining: 8000,
            progress: 20,
            totalHours: 40,
            currency: '$'
        });

        // Mock fetch for analytics
        // Mock fetch with different responses for different endpoints
        global.fetch = vi.fn().mockImplementation((url) => {
            if (url.toString().includes('/dashboard/summary')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        financials: { totalRevenue: 50000 },
                        counts: { openTickets: 3, leads: 12, pendingOrders: 5 },
                        recentActivity: [
                            { type: 'TICKET', description: 'New ticket from Client A', customer: 'Client A', date: new Date().toISOString() }
                        ]
                    })
                });
            }
            if (url.toString().includes('/projects')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ([
                        { id: 'p1', name: 'Project Alpha', budget: 10000 }
                    ])
                });
            }
            if (url.toString().includes('/analytics/predictions')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        mrr: { current: 5000, forecast: [], projectedAnnual: 60000 },
                        churn: { atRiskCount: 1, atRiskMRR: 500, customers: [] },
                        pipeline: { totalValue: 10000, hotLeadsCount: 5, avgScore: 80 }
                    })
                });
            }
            return Promise.resolve({ ok: false });
        });
    });

    it('renders stats cards correctly', async () => {
        render(<DashboardAdmin />);

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.getByText('Ingresos Totales')).toBeInTheDocument();
        });

        // Check for specific values (formatted)
        const revenue = screen.getAllByText(/\$50,000/);
        expect(revenue.length).toBeGreaterThan(0);
    });

    it('renders project list', async () => {
        render(<DashboardAdmin />);

        await waitFor(() => {
            expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        });

        // Check summary data
        // Check summary data
        const budget = screen.getAllByText(/\$10,000/);
        expect(budget.length).toBeGreaterThan(0);
    });
});
