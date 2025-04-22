// the user schema manager for Flair
// Debashish Buragohain

import { prisma } from "../../prisma/index.js";

export async function createUser(wallet: string) {
    return await prisma.user.create({
        data: { wallet }
    });
}

export async function userExists(wallet: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { wallet } })
    return !!user;
}