import { prisma } from '../lib/prisma';
import { Router } from 'express';
import { authHandler, authorizedPk } from '../middleware/auth';
import { signInContext } from '../middleware/auth/context';;
import { RepositoryMetdata } from '../lib/types/repo';
import { branchRouter } from './branch';

const repoRouter = Router();

// get all the repositories for the particular user
repoRouter.get('/', authHandler(signInContext),
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

// get a specific repository given the repository name
repoRouter.get('/name/:name', authHandler(signInContext), async (req, res) => {
    const { name } = req.params;
    const matchRepo = await prisma.repository.findFirst({ where: { name } });
    if (!matchRepo) {
        res.status(404).send({ error: { message: 'Repository not found.' } });
        return;
    }
    res.status(200).json({ data: matchRepo });
});

// get a specific repository given the repository hash
// Example route to get a repository
repoRouter.get('/:repoHash', authHandler(signInContext), async (req, res) => {
    const { repoHash } = req.params;
    const matchRepo = await prisma.repository.findFirst({ where: { repoHash } });
    if (!matchRepo) {
        res.status(404).send({ error: { message: 'Repository not found.' } });
        return;
    }
    res.status(200).json({ data: matchRepo });
});

// create an empty repository
repoRouter.post('/create', authHandler(signInContext),
    async (req, res) => {
        try {
            // create a repository
            const pk = authorizedPk(res);
            const { metadata, 
                repoHash, 
                name,
             }: { metadata?: RepositoryMetdata, repoHash: string, name: string } = req.body;
            if (!metadata || !repoHash || !name) {
                res.status(400).send({ error: { message: 'Required fields are not provided.' } });
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
                    metadata: JSON.parse(JSON.stringify(metadata)),
                    repoHash,
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


repoRouter.put('/update/:repoHash', authHandler(signInContext), async (req, res) => {
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
            baseModelUri,
            baseModelHash,
        }= req.body;

        if (!repoHash) {
            res.status(400).send({ error: { message: 'Repository hash not provided to update.' } });
            return;
        }

        if (!metadata && !baseModelUri && !addContributorIds.length && !removeContributorIds.length && !addAdminIds.length && !removeAdminIds.length && !addWriteAccessIds.length && !removeWriteAccessIds.length) {
            res.status(400).send({ error: { message: 'No fields provided to update.' } });
            return;
        }

        // Find the repository
        const match = await prisma.repository.findFirst({ where: { repoHash } });
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
                ...(baseModelUri && { baseModelUri }),
                ...(baseModelHash && {baseModelHash}),
                ...(name && {name}),        // in case we want to change the name of the repository
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

// mounting the branch router here
repoRouter.use('/:repoHash/branch', async (req, res, next) => {
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

export { repoRouter };