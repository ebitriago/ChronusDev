// Módulo de autenticación con bcrypt y JWT
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { User } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET || "chronusdev-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

// Hash password con bcrypt
export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

// Verificar password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Generar JWT token
export function generateJWT(user: User): string {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verificar JWT token
export function verifyJWT(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
        return null;
    }
}

export interface JWTPayload {
    id: string;
    email: string;
    role: string;
    organizationId?: string;
    iat: number;
    exp: number;
}

// Hash síncrono para datos iniciales
export function hashPasswordSync(password: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
}
