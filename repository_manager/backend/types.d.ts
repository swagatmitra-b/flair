import { Request } from "express";

declare global {
    namespace Express {
        interface Request {
            repoId?: string;
            branchId?: string;
        }
    }
}