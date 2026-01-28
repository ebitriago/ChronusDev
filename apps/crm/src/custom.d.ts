import { User as PrismaUser } from "@prisma/client";

declare global {
    namespace Express {
        interface User extends PrismaUser {
            organizationId: string;
        }

        interface Request {
            user?: User;
        }
    }
}
