'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
    token: string | null;
    user: any | null;
    login: (token: string, user: any) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
    token: null,
    user: null,
    login: () => { },
    logout: () => { },
    isAuthenticated: false
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<any | null>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem('crm_token');
        const storedUser = localStorage.getItem('crm_user');
        if (storedToken) setToken(storedToken);
        if (storedUser) setUser(JSON.parse(storedUser));
    }, []);

    const login = (newToken: string, newUser: any) => {
        localStorage.setItem('crm_token', newToken);
        localStorage.setItem('crm_user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}
