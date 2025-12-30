import { prisma } from '../lib/prisma/index.js';
import { Router } from 'express';
import { authorizedPk } from '../middleware/auth/authHandler.js';
import { commitRouter } from './commit.js';
import { v4 as uuidv4 } from 'uuid';

const branchRouter = Router();
// get all the branches for the particular repository
branchRouter.get('/', async (req, res) => {
    // we do not need the public key for the retrieval of branches
    try {
        const { repoId } = req;
        // find the branches having the specifc repository id
        const matchBranches = await prisma.branch.findMany({
            where: {
                repositoryId: repoId
            }
        });
        res.status(200).json({ data: matchBranches });
        return;
    }
    catch (err) {
        console.error('Error in all branch retrieval:', err);
        res.status(500).send({ error: { message: `${err}` } });
    }
});

// get a specific branch in a repository
branchRouter.get('/hash/:branchHash', async (req, res) => {
    try {
        // find the branches having the specifc repository id
        const { branchHash } = req.params;
        const matchBranches = await prisma.branch.findUnique({
            where: { branchHash }
        });
        // send an empty list if we do not have any branches in the repository
        if (!matchBranches) {
            res.status(200).json({ data: [] });
            return;
        }
        res.status(200).json({ data: matchBranches });
    }
    catch (err) {
        console.error('Error in branch retrieval:', err);
        res.status(500).send({ error: { message: `${err}` } });
    }
});

// create a new branch in a repository
branchRouter.post('/create', async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { repoId } = req;
        const matchRepo = await prisma.repository.findUnique({
            where: { id: repoId },
            include: { 
                branches: true, 
                baseModel: true
             }
        });
        if (!matchRepo) {
            console.error('Criticial Error: Repository does not exist for branch to create.');
            res.status(500).send({ error: { message: 'Repository does not exist for branch to create.' } });
            return;
        }
        // if the user is not the creator of the repo and is not in the write access list
        if (matchRepo!.ownerAddress !== pk && !matchRepo!.writeAccessIds.includes(pk)) {
            res.status(401).send({ error: { message: 'Unauthorized. You can only create a branch in your own repository or those that you have write access.' } });
            return;
        }
        // if the base model is not uploaded we cannot create a branch
        if (!matchRepo!.baseModel || !matchRepo!.baseModelId) {
            res.status(400).send({ error: { message: 'No base model uploaded. Cannot create a new branch.' } });
            return;
        }

        // when we create a new branch, we make a copy of our current working branch
        const { currentBranchHash, name, description }: { currentBranchHash?: string, name: string, description?: string } = req.body;
        if (name.includes(" ")) {
            res.status(400).send({ error: { message: "Name of the branch cannot contain spaces." } });
            return;
        }
        // if this needs to be the first branch in this repository then there will not be any latest parameters in it
        let currentBranch;
        if (!currentBranchHash) {
            // check if this is the first branch in this repository
            if (matchRepo.branches.length !== 0) {
                res.status(400).send({ error: { message: 'Current branch hash is mandatory for repos with more than one existing branches.' } });
                return;
            }
        }
        else {
            currentBranch = await prisma.branch.findFirst({ where: { branchHash: currentBranchHash } });
            if (!currentBranch) {
                res.status(400).send({ error: { message: 'Current branch does not exist in the repository.' } });
                return;
            }
        }

        // create the new branch here
        const newBranch = await prisma.branch.create({
            data: {
                name,
                description,
                // add the parameters of the current branch to this new branch if it is not the first branch in the repository
                ...(currentBranch && currentBranch.latestParamsId && { latestParamsId: currentBranch.latestParamsId }),
                repositoryId: repoId!,
                branchHash: uuidv4()
            }
        });
        res.status(201).json({ data: newBranch });
        return;
    }
    catch (err) {
        console.error('Error creating branch in repository: ', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
        return;
    }
});

// only thing we can update or change in a branch is its description and the write access ids
branchRouter.patch('/hash/:branchHash/update', async (req, res) => {
    const { repoId } = req;
    const { branchHash } = req.params;  // repo id is in the params
    const pk = authorizedPk(res);
    // first check if the public key belongs to this repository
    const matchRepo = await prisma.repository.findFirst({
        where: {
            id: repoId
        }
    });
    if (!matchRepo) {
        res.status(404).send({ error: { message: 'Repository not found.' } });
        return;
    }
    if (matchRepo.ownerAddress !== pk && !matchRepo.writeAccessIds.includes(pk)) {
        res.status(401).send({ error: { message: 'Unauthorized. You can only update your own repository or those you have write access.' } });
        return;
    }
    // now check if the branch exists in the repository
    const matchBranch = await prisma.branch.findFirst({
        where: { branchHash }
    });
    if (!matchBranch) {
        // cannot update a branch that does not exist
        res.status(404).send({ error: { message: 'Branch not found.' } });
        return;
    }
    // description is the only possible updateable entity as of now
    const { description } = req.body;
    const updatedBranch = await prisma.branch.update({
        where: { id: matchBranch.id },
        data: {
            ...(description && { description }),
            updatedAt: new Date()
        },
    });

    // update the repository updated time
    await prisma.repository.update({
        where: { id: repoId },
        data: { updatedAt: new Date() }
    });
    res.status(200).json({ data: updatedBranch });
});

// Delete a branch from a repository
branchRouter.delete('/hash/:branchHash/delete', async (req, res) => {
    const { branchHash } = req.params;
    const pk = authorizedPk(res);
    const { repoId } = req;

    try {
        // Find the repository
        const matchRepo = await prisma.repository.findUnique({
            where: { id: repoId },
        });
        if (!matchRepo) {
            res.status(404).send({ error: { message: 'Repository not found.' } });
            return;
        }
        if (matchRepo.ownerAddress !== pk && !matchRepo.adminIds.includes(pk)) {
            res.status(401).send({ error: { message: 'Unauthorized. Only a creator or an admin can delete the branch.' } });
            return;
        }
        // Find the branch
        const matchBranch = await prisma.branch.findFirst({ where: { branchHash } });
        if (!matchBranch) {
            res.status(404).send({ error: { message: 'Branch not found.' } });
            return;
        }

        // Get all commits associated with the branch
        const commits = await prisma.commit.findMany({
            where: { branchId: matchBranch.id },
            select: { id: true },
        });

        // Extract commit IDs
        const commitIds = commits.map((commit) => commit.id);
        // Perform the deletion within a transaction
        await prisma.$transaction([
            // Delete params associated with the commits
            prisma.params.deleteMany({ where: { commitId: { in: commitIds } } }),
            // Delete the commits themselves
            prisma.commit.deleteMany({ where: { branchId: matchBranch.id } }),

            // soft delete is unnecessary in here go for permanent deletion only
            // soft delete all the commits in the branch
            // prisma.commit.updateMany({
            //     where: { id: matchBranch.id },
            //     data: { isDeleted: true }
            // }),

            // Update the repository's updatedAt field
            prisma.repository.update({
                where: { id: repoId },
                data: { updatedAt: new Date() },
            }),
        ]);
        
        // Delete the branch
        const deletedBranch = await prisma.branch.delete({ where: { id: matchBranch.id } });
        res.status(200).send({ message: 'The branch and its associated commits deleted successfully.', branch: deletedBranch });
        return;

    } catch (err) {
        console.error('Error deleting branch: ', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

branchRouter.use('/hash/:branchHash/commit', async (req, res, next) => {
    const { branchHash } = req.params;
    const matchBranch = await prisma.branch.findFirst({
        where: { branchHash }
    });
    if (!matchBranch) {
        res.status(404).send({ error: { message: 'Branch does not exist' } });
        return;
    }
    req.branchId = matchBranch.id;  // attach the id of the given branch in the request
    next();
}, commitRouter);

export { branchRouter };