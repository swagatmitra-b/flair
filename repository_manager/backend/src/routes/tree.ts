// a particular keypair will be continuously signed in which will sign all the transactions for the nfts
// Debashish Buragohain

import { Router } from "express";
import { createMerkleTree, getCurrentTree } from "../lib/nft/tree.js";
import { umi } from "../lib/nft/umi.js";

const treeRouter = Router();

// the create tree router needs to have an additional signature
treeRouter.post('/create', async (req, res) => {
    const tree = await createMerkleTree(umi);
    if (!tree) {
        res.status(500).send({ error: { message: `Could not create merkle tree.` } });
        return;
    }
    // we have successfully created the merkle tree here at this point
    res.status(200).json({ data: tree });
    return;
});

// route to get the current merkle tree address
treeRouter.get('/current', async (req, res) => {
    try {
        const tree = await getCurrentTree();
        res.status(200).json({ data: tree });
    }
    catch (err) {
        console.error('Error getting current merkle tree:', err);
        res.status(500).send({ error: { message: `Could not get current merkle tree: ${err}` } });
    }
});

export { treeRouter };