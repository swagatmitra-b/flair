// the user schema manager for Flair
// Debashish Buragohain
import { prisma } from "../../prisma/index.js";
export async function createUser(wallet) {
    return await prisma.user.create({
        data: { wallet }
    });
}
export async function userExists(wallet) {
    const user = await prisma.user.findUnique({ where: { wallet } });
    return !!user;
}
