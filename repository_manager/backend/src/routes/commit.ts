import { prisma } from '../lib/prisma/index.js';
import { Router } from 'express';
import { authorizedPk } from '../middleware/auth/authHandler.js';
import { CommitType } from '../lib/types/repo.js';
import { commitMetrics, commitParameters, RejectedCommits } from '../lib/types/commit.js';
import { convertCommitToNft } from '../lib/nft/nft.js';
import { umi } from '../lib/nft/umi.js';

const commitRouter = Router();

// Get all commits for a specific branch (exluding the parameters and the merged parameters)
commitRouter.get('/', async (req, res) => {
    const { branchId } = req;
    try {
        const commits = await prisma.commit.findMany({ where: { branchId } });
        res.status(200).json({ data: commits });
        return;
    } catch (err) {
        console.error('Error retrieving commits:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
        return;
    }
});


// complete info for the commit for pulling it
commitRouter.get('/hash/:commitHash/pull', async (req, res) => {
    const { commitHash } = req.params;
    try {
        const commit = await prisma.commit.findFirst({
            where: { commitHash },
            include: {
                branch: true,
                committer: true,
                params: {
                    include: {
                        ZKMLProof: true
                    }
                },
                nft: {
                    include: {
                        collection: true
                    }
                },
            }
        });
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

// basic details of a commit
commitRouter.get('/hash/:commitHash', async (req, res) => {
    const { commitHash } = req.params;
    try {
        const commit = await prisma.commit.findFirst({
            where: { commitHash }
        });
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
commitRouter.get('/latest', async (req, res) => {
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
commitRouter.get('/pending', async (req, res) => {
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
commitRouter.post('/create', async (req, res) => {
    try {
        const pk = authorizedPk(res); // Get the contributor's wallet address
        const { branchId } = req; // Branch ID where the commit is being made
        // the property of the nextMergerCommit will be defined by the backend itself
        // it will not be sent in the request

        const {
            commitType,
            message,
            paramHash,
            params,
            metrics,
            commitHash,
            acceptedCommits,         // the hash array of the accepted commits if it is a merger commit
            rejectedCommits,         // the rejected commits with the hash and the reject message
        }:
            {
                commitType: CommitType,
                message: string,
                paramHash: string,
                params: commitParameters,
                metrics: commitMetrics,
                commitHash: string,
                // reserved for the system commits
                acceptedCommits: string[] | undefined,          // accepted and rejected commits are undefined for general commits
                rejectedCommits: RejectedCommits | undefined,   // only needed in case of system commits 
            } = req.body;

        // cannot create a commit if the base model is not uploaded
        const repo = await prisma.repository.findUnique({ where: { id: req.repoId } });
        if (!repo!.baseModelHash) {
            res.status(400).send({ error: { message: 'Base model not uploaded. Cannot create commit.' } });
            return;
        }
        if (commitType !== 'SYSTEM' && !message) {
            res.status(400).send({ error: { message: 'Commit message is required.' } });
            return;
        }

        if (!branchId) {
            throw new Error('Criticial Error: branchId not attached to response.');
        }
        // Validate input fields
        if (!paramHash || !params || !metrics || !commitHash) {
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
            include: { repository: true },
        });

        if (!branch) {
            res.status(404).send({ error: { message: 'Branch does not exist.' } });
            return;
        }

        const repository = branch.repository;
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
            where: { status: 'MERGERCOMMIT', branchId },        // latest merger commit in this branch
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


        // the first commit is the only commit that is committed by the user and still a MERGER_COMMIT

        // Commit message section
        // Default status for a new commit is pending unless it is the first commit in the branch for which it is the merger commit
        const commitLength = await prisma.commit.count({ where: { branchId } });
        const status = commitType == 'SYSTEM' ? 'MERGERCOMMIT' : commitLength == 0 ? 'MERGERCOMMIT' : 'PENDING';
        const commitMessage = commitType == 'SYSTEM' ? '_SYSTEM_COMMIT_' : message;


        // if it is a merger commit
        if (commitType == 'SYSTEM') {
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

            for (const cmt of acceptedCommits) {
                const updatedCommit = await prisma.commit.update({
                    where: { commitHash: cmt },
                    data: {
                        status: 'MERGED',
                        verified: true
                    },
                    include: { params: true }
                });

                // ------------------------------------ ZKML Proof handling --------------------------------------------

                // !-- this deletes the verified proof since we have already verified it
                // !!-- the ZKML proof is a big file to store. Currently we are removing it once the commits are accepted.
                // !!------          But change this later on need            --------------
                if (updatedCommit.params) {

                    // in reality all commits must contain ZKML proofs and its verification cannot be skipped                    
                    // the merger must check if all the ZKML proofs have been verified before creating a Merger Commit !


                    // !! -- For Testing we consider that the ZKML proof may be empty
                    // !! But in production environments this cannot be empty

                    const proofRecordCount = await prisma.zKMLProof.count({ where: { paramId: updatedCommit.params.id } });
                    if (proofRecordCount > 0)
                        await prisma.zKMLProof.delete({
                            where: { paramId: updatedCommit.params.id }
                        });
                    else console.warn(`High Level Warning!! Commit that does not contain ZKML proof has been merged. Commit Details: 
                        \n Commit Hash: ${updatedCommit.commitHash}
                        \n Committed by ID: ${updatedCommit.committerId}
                        \n Commit Message: ${updatedCommit.message}
                        \n Commit Time: ${updatedCommit.createdAt}`)                        
                }
            }

            const rejectedCommitIds: string[] = [];
            for (const cmt of rejectedCommits) {
                const updatedRejectedCmt = await prisma.commit.update({
                    where: { commitHash: cmt.commit },
                    data: {
                        status: 'REJECTED',
                        rejectedMessage: cmt.message
                    }
                });
                rejectedCommitIds.push(updatedRejectedCmt.id);
            }

            // for the rejected commits delete all the parameters for those commits
            for (const id of rejectedCommitIds) {
                const deletedParam = await prisma.params.delete({ where: { commitId: id } });
                
                // also delete the associated zkml proof for this param if it exists 
                
                // For rejected commits it is allowable to have the ZKML proof as optional
                const rejectedZKMLProofCount = await prisma.zKMLProof.count({where: {paramId: deletedParam.id}})
                if (rejectedZKMLProofCount > 0)
                    await prisma.zKMLProof.delete({ where: { paramId: deletedParam.id } });
            }
        }

        if (!params.zkmlProof) {
            res.status(400).send({ error: { message: 'Error: No ZKML proof provided as params.' } });
            return
        }
        // extract the zkml proof for this commit
        const { verifierKey, circuitSettingsSer, proofSer, srsSer } = params.zkmlProof;

        // Finally create the commit
        const commit = await prisma.commit.create({
            data: {
                committerAddress: pk,
                previousMergerCommit,
                message: commitMessage,
                paramHash,
                // in the current version we have removed the local and merged parameters
                // for an accepted commit it is the local parameters and for a merger commit it is the merged parameters
                metrics,
                // another condition is that if it is the very first commit in the branch, its status will be always accepted
                status,
                branchId: branchId,            // makes the necessary updates in the branch model
                commitHash,
                params: {
                    // creates a new entry in the parameter schema containing the parameters for this commit
                    create: {
                        params: params.params, // Assumes params is an object with base64 encoded data
                        ZKMLProof: {
                            create: {
                                verifierKey,
                                circuitSettingsSer,
                                proofSer,
                                srsSer
                            }
                        }
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

// commit nft conversion route
commitRouter.post('/hash/:commitHash/createNft', async (req, res, next) => {
    try {
        const { commitHash } = req.params;
        const asset = await convertCommitToNft(umi, commitHash);
        res.status(200).json({ data: asset });
    }
    catch (err) {
        res.status(400).send({ error: { message: `${err}` } });
        return;
    }
});

export { commitRouter };