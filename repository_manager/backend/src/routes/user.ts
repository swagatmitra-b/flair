// the user data manager for Flair managing RUD operations
// Debashish Buragohain

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authorizedPk } from "../middleware/auth";
import { UserMetdata } from "../lib/types/user";
import { JsonObject } from "@prisma/client/runtime/library";

const userRouter = Router();
userRouter.get('/profile', async (req, res) => {
    try {
        const wallet = authorizedPk(res);
        // include the repositories and commits for the user
        const user = await prisma.user.findUnique({
            where: { wallet },
            include: {
                repositories: true,
                commits: true
            }
        });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.status(200).json({ data: user });
    }
    catch (err) {
        console.error(`Error getting profile: ${err}`);
        res.status(500).send({ error: { message: 'Could not update profile.' } });
        return;
    }
});

userRouter.put('/update', async (req, res) => {
    try {
        const wallet = authorizedPk(res);
        const { metadata, username }: { metadata: Partial<UserMetdata>, username: string } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { wallet },
            select: { metadata: true, username: true }
        });

        if (!existingUser) {
            res.status(404).send({ error: { message: "User not found." } });
            return;
        }

        const updatedMetdata = { ...existingUser.metadata as JsonObject, ...metadata };
        const updatedData: Record<string, any> = {
            metadata: updatedMetdata,
            updatedAt: Date()
        }
        if (username) updatedData.username = username;
        await prisma.user.update({
            where: { wallet },
            data: { updatedAt: updatedData }
        })
    }
    catch (err) {
        console.error(`Error updating user profile: ${err}`);
        res.status(500).send({ error: { message: "Could not update profile." } });
        return;
    }
});


// deleting the user also deletes all his repositories
userRouter.delete('/delete', async (req, res) => {
    try {
        const wallet = authorizedPk(res);
        const deletedUser = await prisma.user.delete({
            where: { wallet },
        });
        if (!deletedUser) {
            res.status(404).send({ error: { message: 'User does not exist to delete!' } });
            return;
        }
        // successfully deleted the user here
        res.status(200).json({ data: deletedUser });
    }
    catch (err) {
        console.error(`Error deleting user: ${err}`);
        res.status(500)
    }
});

export { userRouter }