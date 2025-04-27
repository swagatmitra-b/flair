import { prisma } from '../lib/prisma/index.js';
import { Router } from 'express';
import { authorizedPk } from '../middleware/auth/authHandler.js';
import { RepositoryMetdata } from '../lib/types/repo';
import { branchRouter } from './branch.js';
import { modelRouter } from './basemodel.js';
import { convertRepoToCollection } from '../lib/nft/nft.js';
import { umi } from '../lib/nft/umi.js';
import { v4 as uuidv4 } from 'uuid';

const repoRouter = Router();

// get all the repositories for the particular user
repoRouter.get('/',
    async (req, res) => {
        // extract the authorized public key
        const pk = authorizedPk(res);
        prisma.repository.findMany({
            where: { ownerAddress: pk }
        }).then(repos => {
            res.status(200).json({ data: repos });
            return;
        }).catch(err => {
            console.error('Error fetching repositories:', err);
            res.status(400).send({ error: err });
            return;
        })
    });

// get a specific repository given the repository name for the current user
repoRouter.get('/name/:name', async (req, res) => {
    const { name } = req.params;
    const pk = authorizedPk(res);
    const matchRepo = await prisma.repository.findFirst({ where: { ownerAddress: pk, name } });
    if (!matchRepo) {
        res.status(404).send({ error: { message: 'Repository not found.' } });
        return;
    }
    res.status(200).json({ data: matchRepo });
});

// getting the repository by the owneraddress/repo_name as is done in gihub
repoRouter.get('/owner/:ownerAddress/name/:name', async (req, res) => {
    const { ownerAddress, name } = req.params
    const matchRepo = await prisma.repository.findFirst({ where: { ownerAddress, name } });
    if (!matchRepo) {
        res.status(404).send({ error: { message: 'Repository not found.' } });
        return;
    }
    res.status(200).json({ data: { matchRepo } });
});

// get a specific repository given the repository hash
// Example route to get a repository
repoRouter.get('/hash/:repoHash', async (req, res) => {
    const { repoHash } = req.params;
    const matchRepo = await prisma.repository.findUnique({
        where: { repoHash },
    });
    if (!matchRepo) {
        res.status(404).send({ error: { message: 'Repository not found.' } });
        return;
    }
    res.status(200).json({ data: matchRepo });
});

// create an empty repository
repoRouter.post('/create',
    async (req, res) => {
        try {
            // create a repository
            const pk = authorizedPk(res);
            const { metadata,
                name,
            }: { metadata?: RepositoryMetdata, name: string } = req.body;
            if (!metadata || !name) {
                res.status(400).send({ error: { message: 'Name and metadata are required fields.' } });
                return;
            }
            if (name.includes(" ")) {
                res.status(400).send({ error: { message: 'Name of a repository cannot contain spaces.' } });
                return;
            }
            if (name !== metadata.name) {
                res.status(400).send({ error: { message: 'Mismatch in name of repo and name in metadata.' } });
                return;
            }
            if (metadata.creator !== pk) {
                res.status(400).send({ error: { message: 'Name of creator in metadata does not match the currently signed in user.' } });
                return;
            }
            // check to ensure that the combination of the user and the repository name is unique
            const existingRepo = await prisma.repository.findFirst({
                where: {
                    ownerAddress: pk,
                    name: name
                }
            });
            if (existingRepo) {
                res.status(400).send({ error: { message: 'You already have a repository with this name.' } });
                return;
            }

            const owner = await prisma.user.findFirst({
                where: { wallet: pk }
            });
            if (!owner) {
                res.status(401).send({ error: { message: 'User not found!' } });
                return;
            }
            const repository = await prisma.repository.create({
                data: {
                    name,
                    ownerAddress: pk,
                    contributorIds: [pk],
                    writeAccessIds: [pk],
                    adminIds: [pk],
                    metadata: JSON.parse(JSON.stringify(metadata)),
                    repoHash: uuidv4(),
                    ownerId: owner.id
                }
            });

            res.status(201).json({ data: repository });
            return;
        }
        catch (err) {
            console.error('Error creating repository:', err);
            res.status(500).send({ error: { message: 'Internal server error' } });
            return;
        }
    });


repoRouter.patch('/hash/:repoHash/update', async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { repoHash } = req.params;
        const {
            name,
            addContributorIds = [],
            removeContributorIds = [],
            addAdminIds = [],
            removeAdminIds = [],
            addWriteAccessIds = [],
            removeWriteAccessIds = [],
            metadata,
        } = req.body;

        if (!repoHash) {
            res.status(400).send({ error: { message: 'Repository hash not provided to update.' } });
            return;
        }

        if (!metadata && !addContributorIds.length && !removeContributorIds.length && !addAdminIds.length && !removeAdminIds.length && !addWriteAccessIds.length && !removeWriteAccessIds.length) {
            res.status(400).send({ error: { message: 'No fields provided to update.' } });
            return;
        }

        // Find the repository
        const match = await prisma.repository.findUnique({ where: { repoHash } });
        if (!match) {
            res.status(404).send({ error: { message: 'Repository does not exist.' } });
            return;
        }
        // Check if the user is the owner or an admin
        const isAdmin = match.ownerAddress === pk || (match.adminIds && match.adminIds.includes(pk));
        if (!isAdmin) {
            res.status(401).send({ error: { message: 'Unauthorized. Only admins can update repository details.' } });
            return;
        }
        // Prepare updates for contributors and admins
        const updatedContributorIds = Array.from(
            new Set([
                ...(match.contributorIds || []),
                ...addContributorIds
            ].filter(id => !removeContributorIds.includes(id)))
        );

        const updatedAdminIds = Array.from(
            new Set([
                ...(match.adminIds || []),
                ...addAdminIds
            ].filter(id => !removeAdminIds.includes(id)))
        );

        const updatedWriteAccessIds = Array.from(
            new Set([
                ...(match.writeAccessIds || []),
                ...addWriteAccessIds
            ].filter(id => !removeWriteAccessIds.includes(id)))
        );

        const exisingMetadata: Object = match.metadata || {};
        const updatedMetdata: RepositoryMetdata = { ...exisingMetadata, ...metadata };

        // Update the repository
        const updatedRepo = await prisma.repository.update({
            where: { id: match.id },
            data: {
                ...(updatedContributorIds && { contributorIds: updatedContributorIds }),
                ...(updatedAdminIds && { adminIds: updatedAdminIds }),
                ...(updatedWriteAccessIds && { writeAccessIds: updatedWriteAccessIds }),
                ...(updatedMetdata && { metadata: updatedMetdata }),
                ...(name && { name }),        // in case we want to change the name of the repository
                updatedAt: new Date(),
            },
        });
        res.status(200).json(updatedRepo);
        return;

    } catch (error) {
        console.error('Error updating repository:', error);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
        return;
    }
});

// convert to nft collection route
repoRouter.post('/hash/:repoHash/create_collection', async (req, res, next) => {
    const { repoHash } = req.params;
    try {
        const collection = await convertRepoToCollection(umi, repoHash);
        res.status(200).json({ data: collection });
    }
    catch (err) {
        res.status(400).send({ error: { message: `${err}` } });
        return;
    }
});


// delete branch for the repository
repoRouter.delete('/hash/:repoHash/delete', async (req, res) => {
    const { repoHash } = req.params;
    const pk = authorizedPk(res);
    try {
        const matchedRepo = await prisma.repository.findUnique({
            where: { repoHash }
        });
        if (!matchedRepo) {
            res.status(404).send({ error: { message: 'Repository not found.' } });
            return;
        }
        if (matchedRepo.ownerAddress !== pk && !matchedRepo.adminIds.includes(pk)) {
            res.status(401).send({ error: { message: 'Unauthorized. Only a creator or an admin can delete the branch.' } });
            return;
        }

        // get all the branches for this repository
        const branches = await prisma.branch.findMany({
            where: { repositoryId: matchedRepo.id },
            select: { id: true }
        });

        // delete all the commits for each branch and then the branch iself
        for (const branch of branches) {
            // Get all commits associated with the branch
            const commits = await prisma.commit.findMany({
                where: { branchId: branch.id },
                select: { id: true },
            });
            // Extract commit IDs
            const commitIds = commits.map((commit) => commit.id);
            // Perform the deletion within a transaction
            await prisma.$transaction([
                // Delete params associated with the commits
                prisma.params.deleteMany({ where: { commitId: { in: commitIds } } }),

                // permanent deletion is the best action because obviously
                // permanently delete commits
                prisma.commit.deleteMany({ where: { branchId: branch.id } }),

                // soft delete commits
                // prisma.commit.updateMany({
                //     where: { branchId: branch.id },
                //     data: { isDeleted: true }
                // }),

                // Delete the branch finally
                prisma.branch.delete({ where: { id: branch.id } }),
            ]);
        }

        // finaly after all the branches have been deleted we can delete the repository
        // Update the repository's updatedAt field
        const deletedRepo = await prisma.repository.delete({ where: { repoHash } });
        // inform the client that the repo has been deleted successfully
        res.status(200).json({ message: 'The repository and its associated branches and commits deleted successfully.', deleted: deletedRepo })

    } catch (err) {
        console.error('Error deleting branch: ', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

// mounting the branch router here
repoRouter.use('/hash/:repoHash/branch', async (req, res, next) => {
    const { repoHash } = req.params;
    const matchRepo = await prisma.repository.findFirst({
        where: { repoHash }
    });
    if (!matchRepo) {
        res.status(404).send({ error: { message: 'Repository does not exist.' } });
        return;
    }
    // set the repoId in the request object
    req.repoId = matchRepo.id;
    // proceed to the next middleware if the referenced repository exists
    next();
}, branchRouter);

// mount the model upload router here
repoRouter.use('/hash/:repoHash/basemodel', async (req, res, next) => {
    const { repoHash } = req.params;
    const matchRepo = await prisma.repository.findFirst({
        where: { repoHash }
    });
    if (!matchRepo) {
        res.status(404).send({ error: { message: 'Repository does not exist.' } });
        return;
    }
    // cannot upload a new model to the same repository
    req.repoId = matchRepo.id;
    next();
}, modelRouter);

export { repoRouter };