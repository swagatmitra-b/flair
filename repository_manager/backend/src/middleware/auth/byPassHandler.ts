import { Keypair } from "@solana/web3.js";
import { Web3AuthHandlerCreator } from "./context"
import { createUser } from "../../lib/auth/user/index.js";
import { prisma } from "../../lib/prisma/index.js";

// bypass the authentication for testing
// generates a temporary public key every authentication

export const ByPassAuth: Web3AuthHandlerCreator = (ctx) => async (req, res, next) => {
    // in the bypass handler, before creating a new anonymous account we remove the previous anonymous accounts

    const prevAnonymousUsers = await prisma.user.findMany({
        where: { wallet: { contains: '_anonymous' } }
    });
    const deletePromises = prevAnonymousUsers.map(user => {
        prisma.user.delete({ where: { wallet: user.wallet } });
    });
    const deletedUsers = await Promise.all(deletePromises);
    if (!deletedUsers) console.log('Deleted previous anonymous users.')

    const keypair = Keypair.generate()
    const pubkey = keypair.publicKey.toBase58();
    console.log('User created through Anonymous public key generation by Auth Bypass Handler: ', pubkey)
    await createUser(pubkey + '_anonymous');
    // after creation we update the user as an anonymous user
    res.locals.pubKey = pubkey;
    next();
}