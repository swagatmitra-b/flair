import { prisma } from '../lib/prisma';
import { Router } from 'express';
import { authHandler, authorizedPk } from '../middleware/auth';
import { signInContext } from '../middleware/auth/context';
import { CommittedBy } from '../lib/types/repo';

const commitRouter = Router();

// Get all commits for a specific branch (exluding the parameters and the merged parameters)
commitRouter.get('/', authHandler(signInContext), async (req, res) => {
    const { branchId } = req;
    try {
        const commits = await prisma.commit.findMany({
            where: { branchId }
        });
        res.status(200).json({ data: commits });
    } catch (err) {
        console.error('Error retrieving commits:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

// Get a specific commit by its hash
// getting is done using its hash and not its id
commitRouter.get('/:commitHash', authHandler(signInContext), async (req, res) => {
    const { commitHash } = req.params;
    try {
        const commit = await prisma.commit.findFirst({ where: { commitHash } });
        if (!commit) {
            res.status(404).send({ error: { message: 'Commit not found.' } });
            return;
        }
        res.status(200).json({ data: commit });
    } catch (err) {
        console.error('Error retrieving commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

// pull the latest commit
commitRouter.get('/latest', authHandler(signInContext), async (req, res) => {
    try {
        const latestCommit = await prisma.commit.findFirst({ orderBy: { createdAt: 'desc' } });
        if (!latestCommit) {
            res.status(404).send({ error: { message: 'No commits found.' } });
            return;
        }
        res.status(200).json({ data: latestCommit });
    } catch (err) {
        console.error('Error retrieving the latest commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});


// get all the pending unmerged commits since the last merge
commitRouter.get('/pending', authHandler(signInContext), async (req, res) => {
    try {
        // first get the latest merged commit id
        const latestMergedCommit = await prisma.commit.findFirst({
            where: { status: 'MERGERCOMMIT' },
            orderBy: { createdAt: 'desc' }
        });
        if (!latestMergedCommit) {
            console.error('Unresolved conflict. No merged commits present in the branch.');
            res.status(500).send({ error: { message: 'Internal Server Error' } });
            return;
        }
        const unmergedCommits = await prisma.commit.findMany({
            where: {
                status: 'PENDING',
                previousCommitHash: latestMergedCommit.commitHash
            },
            orderBy: { createdAt: 'asc' }   // sort serially in the order when they were created
        });
        res.status(200).json({ data: unmergedCommits });

    } catch (err) {
        console.error('Error retrieving the latest commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
})

// create the new commit to the branch
commitRouter.post('/create', authHandler(signInContext), async (req, res) => {
    try {
        const pk = authorizedPk(res); // Get the contributor's wallet address
        const { branchId } = req.body; // Branch ID where the commit is being made
        const {
            committedBy, message, paramHash, params, localAccuracy, localLoss, commitHash }:
            { committedBy: CommittedBy, message: string, paramHash: string, params: { params: string, zkmlProof: string }, localAccuracy: string, localLoss: string, commitHash: string } = req.body;

        if (committedBy !== 'SYSTEM' && !message) {
            res.status(400).send({error: {message: 'Commit message is required.'}});
            return;
        }
        // Validate input fields
        if (!branchId || !paramHash || !params || !localAccuracy || !localLoss || !commitHash) {
            res.status(400).send({ error: { message: 'Complete commit information not provided.' } });
            return;
        }
        // Fetch the branch and validate existence
        const branch = await prisma.branch.findFirst({
            where: { id: branchId },
            include: { Repository: true },
        });

        if (!branch) {
            res.status(404).send({ error: { message: 'Branch does not exist.' } });
            return;
        }
        const repository = branch.Repository;
        // Validate write permissions
        const hasWriteAccess =
            repository.creator === pk || repository.writeAccessIds.includes(pk);
        if (!hasWriteAccess) {
            res.status(403).send({
                error: { message: 'Unauthorized. You do not have write access to this repository.' },
            });
            return;
        }

        // get the hash of the latest accepted commit and attach it as the previous hash of this commit
        // for the first commit in the branch, this will return null
        const latestCommit = await prisma.commit.findFirst({
            where: { status: 'MERGERCOMMIT' },
            orderBy: { createdAt: 'desc' }
        });

        const commitLength = (await prisma.commit.findMany({ where: branchId })).length
        // the previous commit hash can never be undefined but only be the genesis hash as defined in the .env file
        const previousCommitHash = (latestCommit !== null) ? latestCommit.commitHash : (commitLength == 0) ? process.env.GENESIS_HASH : undefined;
        if (!previousCommitHash) {
            console.error('Unresolved conflict. Previous commit hash of non-empty branch is undefined.');
            res.status(500).send({ error: { message: 'Internal Server Error' } });
            return;
        }
        // If 
        // Default status for a new commit is pending unless it is the first commit in the branch for which it is the merger commit
        const status = committedBy == 'SYSTEM' ? 'MERGERCOMMIT' : commitLength == 0 ? 'MERGERCOMMIT' : 'PENDING';
        const commitMessage = committedBy == 'SYSTEM' ? '_SYSTEM_COMMIT_' : message;
        // Create the commit
        const commit = await prisma.commit.create({
            data: {
                contributor: pk,
                previousCommitHash,
                message: commitMessage,
                paramHash,
                localAccuracy,
                localLoss,
                // another condition is that if it is the very first commit in the branch, its status will be always accepted
                status,
                branchId: branchId,
                commitHash,
                params: {
                    create: {
                        params: params.params, // Assumes params is an object with base64 encoded data
                        zkmlProof: params.zkmlProof,
                    },
                },
            },
            include: { params: true }, // Include params in the response
        });
        // update the updated at fields of both the branch and repository schemas
        await prisma.$transaction([
            prisma.branch.update({
                where: { id: req.branchId! },
                data: { updatedAt: new Date() }
            }),
            prisma.repository.update({
                where: { id: req.repoId! },
                data: { updatedAt: new Date() }
            })
        ]);
        res.status(201).json({ data: commit });
    } catch (error) {
        console.error('Error creating commit:', error);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

// only updateable property is the status of the commit i.e. from pending to merged or rejected
// if the commit was rejected, we need to delete the model parameters associated with it
commitRouter.put('/update/:commitHash', authHandler(signInContext), async (req, res) => {
    const { commitHash } = req.params;
    const { status,
        // mergedParams, 
        // mergedAccuracy, 
        // mergedLoss, 
        rejectedMessage } = req.body;
    try {
        const pk = authorizedPk(res);
        // Validate input
        if (!status || !['MERGED', 'REJECTED'].includes(status)) {
            // we cannot update the status of a commit to MERGERCOMMIT, the merger commit is automatically created by the system
            res.status(400).send({ error: { message: 'Invalid status. Only MERGED or REJECTED are allowed.' } });
            return;
        }
        // additional rejected message check for the rejected commits
        if (status == 'REJECTED' && !rejectedMessage) {
            res.status(400).send({ error: { message: 'Mandatory rejection message not provided.' } });
            return;
        }
        // Find the commit
        const commit = await prisma.commit.findFirst({ where: { commitHash }, include: { params: true } });
        if (!commit) {
            res.status(404).send({ error: { message: 'Commit not found.' } });
            return;
        }
        // Ensure the commit is in PENDING status
        if (commit.status !== 'PENDING') {
            res.status(400).send({ error: { message: 'Only PENDING commits can be updated.' } });
            return;
        }
        // Verify permissions
        const branch = await prisma.branch.findFirst({
            where: { id: commit.branchId },
        });
        const repo = branch && (await prisma.repository.findFirst({
            where: { id: branch.repositoryId },
        }));
        if (!repo || (repo.creator !== pk && !repo.writeAccessIds.includes(pk))) {
            res.status(401).send({ error: { message: 'Unauthorized. You can only update commits in your own repository or those you have write access.' } });
            return;
        }
        // Prepare data for update
        // if (status === 'MERGED') {
        //     if (!mergedAccuracy || !mergedLoss || !mergedParams) {
        //         res.status(400).send({
        //             error: { message: 'Merged parameters, accuracy, loss must be provided when changing status to MERGED.' },
        //         });
        //         return;
        //     }
        // }
        // if commit is rejected then we remove the associated params
        const deletedParams = (status == 'REJECTED') ? await prisma.params.delete({ where: { id: commit.params?.id } }) : null;

        // Update the commit in a single go and create the merged parameters property for this
        const updatedCommit = await prisma.commit.update({
            where: { id: commit.id },
            data: {
                status,
                // the merged parameters will be included as a totally new commit which would be called a merge commit
                // ...(mergedAccuracy && { mergedAccuracy }),
                // ...(mergedLoss && { mergedLoss }),
                // ...(mergedParams && {
                //     mergedParams: {
                //         create: {
                //             params: mergedParams
                //         }
                //     }
                // }),
                ...(rejectedMessage && { rejectedMessage })     // rejected message attached for the rejected commits
            },
        });

        // update the times in branch and repo schemas
        await prisma.$transaction([
            prisma.branch.update({
                where: { id: req.branchId! },
                data: { updatedAt: new Date() }
            }),
            prisma.repository.update({
                where: { id: req.repoId! },
                data: { updatedAt: new Date() }
            })
        ]);

        res.status(200).json({ data: updatedCommit, deleted: deletedParams });
    } catch (err) {
        console.error('Error updating commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});


// Just like in github when we revert to the previous commit, we just create a new commit where we reference to the previous commit
// similarly to delete in here, we create a new commit which would point to the previous commit
// We cannot just go and delete a specific commit
// Delete a commit from the branch
// commitRouter.delete('/delete/:commitId', authHandler(signInContext), async (req, res) => {
//     const { commitId } = req.params;
//     try {
//         const pk = authorizedPk(res);
//         // Find the commit
//         const commit = await prisma.commit.findFirst({
//             where: { id: commitId },
//         });
//         if (!commit) {
//             res.status(404).send({ error: { message: 'Commit not found.' } });
//             return;
//         }
//         // Verify permissions
//         const branch = await prisma.branch.findFirst({
//             where: { id: commit.branchId },
//         });
//         const repo = branch && (await prisma.repository.findFirst({
//             where: { id: branch.repositoryId },
//         }));
//         if (!repo || (repo.creator !== pk && !repo.adminIds.includes(pk))) {
//             res.status(401).send({ error: { message: 'Unauthorized. You need to be the creator or an admin to delete the repository.' } });
//             return;
//         }
//         // Delete associated params and mergedParams
//         const deletedCommit = await prisma.$transaction([
//             prisma.mergedParams.deleteMany({
//                 where: { commitId },
//             }),
//             prisma.params.deleteMany({
//                 where: { commitId },
//             }),
//             prisma.commit.delete({
//                 where: { id: commitId },
//             }),
//         ]);
//         // update the times in branch and repo schemas
//         await prisma.$transaction([
//             prisma.branch.update({
//                 where: { id: req.branchId! },
//                 data: { updatedAt: new Date() }
//             }),
//             prisma.repository.update({
//                 where: { id: req.repoId! },
//                 data: { updatedAt: new Date() }
//             })
//         ]);
//         res.status(204).json({ data: deletedCommit });
//     } catch (err) {
//         console.error('Error deleting commit:', err);
//         res.status(500).send({ error: { message: 'Internal Server Error' } });
//     }
// });


export { commitRouter };