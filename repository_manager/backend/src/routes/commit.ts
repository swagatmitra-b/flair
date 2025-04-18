import { prisma } from '../lib/prisma';
import { Router } from 'express';
import { authHandler, authorizedPk } from '../middleware/auth';
import { signInContext } from '../middleware/auth/context';
import { CommittedBy } from '../lib/types/repo';
import { commitMetrics, commitParameters, RejectedCommits } from '../lib/types/commit';

const commitRouter = Router();

// Get all commits for a specific branch (exluding the parameters and the merged parameters)
commitRouter.get('/', authHandler(signInContext), async (req, res) => {
    const { branchId } = req;
    try {
        const commits = await prisma.commit.findMany({ where: { branchId } });
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
                previousMergerCommit: latestMergedCommit.commitHash
            },
            orderBy: { createdAt: 'asc' }   // sort serially in the order when they were created
        });
        res.status(200).json({ data: unmergedCommits });
    } catch (err) {
        console.error('Error retrieving the latest commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

// create the new commit to the branch
// the commit can be a merger commit or a general commit
// this route is also responsible for updating the status of PENDING commits and removing rejected parameters
commitRouter.post('/create', authHandler(signInContext), async (req, res) => {
    try {
        const pk = authorizedPk(res); // Get the contributor's wallet address
        const { branchId } = req.body; // Branch ID where the commit is being made
        // the property of the nextMergerCommit will be defined by the backend itself
        // it will not be sent in the request
        const {
            committedBy,
            message,
            paramHash,
            params,
            metrics,
            commitHash,
            acceptedCommits,         // the hash array of the accepted commits if it is a merger commit
            rejectedCommits,         // the rejected commits with the hash and the reject message
        }:
            {
                committedBy: CommittedBy,
                message: string,
                paramHash: string,
                params: commitParameters,
                metrics: commitMetrics,
                commitHash: string,
                acceptedCommits: string[] | undefined,          // accepted and rejected commits are undefined for general commits
                rejectedCommits: RejectedCommits | undefined,   // only needed in case of system commits 
            } = req.body;

        if (committedBy !== 'SYSTEM' && !message) {
            res.status(400).send({ error: { message: 'Commit message is required.' } });
            return;
        }
        // Validate input fields
        if (!branchId || !paramHash || !params || !metrics || !commitHash) {
            res.status(400).send({ error: { message: 'Complete commit information not provided.' } });
            return;
        }

        // get the committer id
        const committer = await prisma.user.findFirst({
            where: { wallet: pk }
        });
        // committer needs to be registered first
        if (!committer) {
            res.status(401).send({ error: { message: 'User not found.' } })
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
            repository.ownerAddress === pk || repository.writeAccessIds.includes(pk);

        if (!hasWriteAccess) {
            res.status(403).send({
                error: { message: 'Unauthorized. You do not have write access to this repository.' },
            });
            return;
        }

        // get the hash of the latest accepted commit and attach it as the previous hash of this commit
        // for the first commit in the branch, this will return null
        const latestMergerCommit = await prisma.commit.findFirst({
            where: { status: 'MERGERCOMMIT' },
            orderBy: { createdAt: 'desc' }
        });

        // the previous commit hash can never be undefined but only be the genesis hash as defined in the .env file
        // fallback mechanism included if the env file is not loaded
        const previousMergerCommit = latestMergerCommit?.commitHash ?? process.env.GENESIS_HASH ?? "_GENESIS_";

        // const previousMergerCommit = (latestMergerCommit !== null) ? latestMergerCommit.commitHash : (commitLength == 0) ? process.env.GENESIS_HASH : undefined;
        if (!previousMergerCommit) {
            console.error('Unresolved conflict. Previous commit hash of non-empty branch is undefined.');
            res.status(500).send({ error: { message: 'Internal Server Error' } });
            return;
        }

        // Commit message section
        // Default status for a new commit is pending unless it is the first commit in the branch for which it is the merger commit
        const commitLength = await prisma.commit.count({ where: { branchId } });
        const status = committedBy == 'SYSTEM' ? 'MERGERCOMMIT' : commitLength == 0 ? 'MERGERCOMMIT' : 'PENDING';
        const commitMessage = committedBy == 'SYSTEM' ? '_SYSTEM_COMMIT_' : message;


        // if it is a merger commit
        if (committedBy == 'SYSTEM') {
            if (!acceptedCommits || !rejectedCommits) {
                res.status(400).send({ error: { message: 'Accepted and Rejected Commits are mandatory for a merger commit.' } });
                return;
            }
            // if the merger commit is created then first check if the number of accepted and rejected commits is equal to all the commits since the last merger commit
            const pendingCommitCount = await prisma.commit.count({
                where: {
                    previousMergerCommit,
                    status: 'PENDING'
                }
            });
            if (pendingCommitCount !== acceptedCommits.length + rejectedCommits.length) {
                res.status(401).send({ error: { message: "All pending commits must be included creating a merger commit." } })
                return;
            }

            // we update the status of all the pending commits to accepted or rejected
            acceptedCommits.forEach(async cmt => {
                await prisma.commit.update({
                    where: { commitHash: cmt },
                    data: { status: 'MERGED' }
                });
                const rejectedCommitIds: string[] = [];
                rejectedCommits!.forEach(async cmt => {
                    const updatedRejectedCmt = await prisma.commit.update({
                        where: { commitHash: cmt.commit },
                        data: {
                            status: 'REJECTED',
                            rejectedMessage: cmt.message
                        }
                    });
                    rejectedCommitIds.push(updatedRejectedCmt.id);
                });
                // for the rejected commits delete all the parameters for those commits
                rejectedCommitIds.forEach(async id => {
                    await prisma.params.delete({ where: { commitId: id } });
                });
            });
        }

        // Finally create the commit
        const commit = await prisma.commit.create({
            data: {
                committerAddress: pk,
                previousMergerCommit,
                message: commitMessage,
                paramHash,
                // in the current version we have removed the local and merged parameters
                // for an accepted commit it is the local parameters and for a merger commit it is the merged parameters
                metrics: JSON.parse(JSON.stringify(metrics)),
                // another condition is that if it is the very first commit in the branch, its status will be always accepted
                status,
                branchId: branchId,            // makes the necessary updates in the branch model
                commitHash,
                params: {
                    // creates a new entry in the parameter schema containing the parameters for this commit
                    create: {
                        params: params.params, // Assumes params is an object with base64 encoded data
                        zkmlProof: params.zkmlProof,
                    },
                },
                committerId: committer.id      // makes the necessary updates in the user schema
            }
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

export { commitRouter };