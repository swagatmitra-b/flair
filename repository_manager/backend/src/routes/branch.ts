import { prisma } from '../lib/prisma';
import { Router } from 'express';
import { authHandler, authorizedPk } from '../middleware/auth';
import { commitRouter } from './commit';
import { signInContext } from '../middleware/auth/context';

const branchRouter = Router();

// get all the branches for the particular repository
branchRouter.get('/', authHandler(signInContext),
    async (req, res) => {
        // we do not need the public key for the retrieval of branches
        const { repoId } = req;
        // find the branches having the specifc repository id
        const matchBranches = await prisma.branch.findMany({
            where: {
                repositoryId: repoId
            }
        });
        // send an empty list if we do not have any branches in the repository
        if (!matchBranches) {
            res.status(200).json({ data: [] });
            return;
        }
        res.status(200).json({ data: matchBranches });
        return;
    });

// get a specific branch in a repository
branchRouter.get('/:branchHash', authHandler(signInContext),
    async (req, res) => {
        // find the branches having the specifc repository id
        const { branchHash } = req.params;
        const matchBranches = await prisma.branch.findMany({
            where: { branchHash }
        });
        // send an empty list if we do not have any branches in the repository
        if (!matchBranches) {
            res.status(200).json({ data: [] });
            return;
        }
        res.status(200).json({ data: matchBranches });
    });

// create a new branch in a repository
branchRouter.post('/create', authHandler(signInContext),
    async (req, res) => {
        try {
            const pk = authorizedPk(res);
            const { repoId } = req;
            const matchRepo = await prisma.repository.findFirst({
                where: { id: repoId }
            });
            // if the user is not the creator of the repo and is not in the write access list
            if (matchRepo!.ownerAddress !== pk && !matchRepo!.writeAccessIds.includes(pk)) {
                res.status(401).send({ error: { message: 'Unauthorized. You can only create a branch in your own repository or those that you have write access.' } });
                return;
            }
            // logic comes till here means we are up for creating a branch
            // when we create a new branch, we make a copy of our current working branch
            const { currentBranchId, name, description, branchHash }: { currentBranchId: string, name: string, description?: string, branchHash: string } = req.body;
            const currentBranch = await prisma.branch.findFirst({
                where: { id: currentBranchId }
            });
            if (!currentBranch) {
                res.status(400).send({ error: { message: 'Current branch does not exist in the repository.' } });
                return;
            }
            // create the new branch here
            const newBranch = await prisma.branch.create({
                data: {
                    name,
                    description,
                    // the parameters of this model
                    latestParams: currentBranch.latestParams,
                    repositoryId: repoId!,
                    branchHash
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
branchRouter.put('/update/:branchHash', authHandler(signInContext), async (req, res) => {
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
            updatedAt: Date()
        },
    });

    // update the repository updated time
    await prisma.repository.update({
        where: { id: repoId },
        data: { updatedAt: Date() }
    });
    res.status(200).json({ data: updatedBranch });
});

// Delete a branch from a repository
branchRouter.delete('/delete/:branchHash', authHandler(signInContext), async (req, res) => {
    const { branchHash } = req.params;
    const pk = authorizedPk(res);
    const { repoId } = req;

    try {
        // Find the repository
        const matchRepo = await prisma.repository.findFirst({
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
            where: { id: matchBranch.id },
            select: { id: true },
        });

        // Extract commit IDs
        const commitIds = commits.map((commit) => commit.id);
        // Perform the deletion within a transaction
        await prisma.$transaction([
            // Delete params associated with the commits
            prisma.params.deleteMany({ where: { commitId: { in: commitIds } } }),
            // Delete the commits themselves
            prisma.commit.deleteMany({ where: { id: matchBranch.id } }),
            // Delete the branch
            prisma.branch.delete({ where: { id: matchBranch.id } }),
            // Update the repository's updatedAt field
            prisma.repository.update({
                where: { id: repoId },
                data: { updatedAt: new Date() },
            }),
        ]);
        res.status(200).send({ message: 'The branch and its associated commits deleted successfully.' });
    } catch (err) {
        console.error('Error deleting branch: ', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

branchRouter.use('/:branchHash/commit', async (req, res, next) => {
    const { branchHash } = req.params;
    const matchBranch = await prisma.branch.findFirst({
        where: { branchHash }
    });
    if (!matchBranch) {
        res.status(404).send({ error: { message: 'Branch does not exist' } });
        return;
    }
    req.branchId = matchBranch.id;  // attach the id of the given branch in the request
}, commitRouter);

export { branchRouter };