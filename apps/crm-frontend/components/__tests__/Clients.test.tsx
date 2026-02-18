import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Clients from '../Clients';
import { getClients } from '../../app/api';

// Mock API
vi.mock('../../app/api', () => ({
    getClients: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
}));

vi.mock('../Toast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

describe('Clients Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders client list', async () => {
        (getClients as any).mockResolvedValue([
            { id: 'c1', name: 'Acme Corp', email: 'info@acme.com', phone: '123' },
            { id: 'c2', name: 'Beta Inc', email: 'contact@beta.com', phone: '456' }
        ]);

        render(<Clients />);

        await waitFor(() => {
            expect(screen.getByText('Acme Corp')).toBeInTheDocument();
            expect(screen.getByText('Beta Inc')).toBeInTheDocument();
        });
    });

    it('shows empty state when no clients', async () => {
        (getClients as any).mockResolvedValue([]);

        render(<Clients />);

        await waitFor(() => {
            expect(screen.getByText(/No hay clientes aún/i)).toBeInTheDocument();
        });
    });

    it('opens modal on new client click', async () => {
        (getClients as any).mockResolvedValue([]);
        render(<Clients />);

        await waitFor(() => screen.getByText(/Nuevo Cliente/i));

        fireEvent.click(screen.getByText(/Nuevo Cliente/i));

        expect(screen.getByText('Nuevo Cliente', { selector: 'h3' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Ej: Acme Corp')).toBeInTheDocument();
    });
});
