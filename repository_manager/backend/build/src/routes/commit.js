import { prisma } from '../lib/prisma/index.js';
import { Router } from 'express';
import { authorizedPk } from '../middleware/auth/authHandler.js';
import { convertCommitToNft,
// fetchCnft, 
// fetchCNftFromSignature
 } from '../lib/nft/nft.js';
import { umi } from '../lib/nft/umi.js';
import { v4 as uuidV4 } from 'uuid';
import { sharedFolderRouter } from './sharedFolder.js';
import { extractMetricsAfter } from '../lib/sharedFolder/index.js';
const commitRouter = Router();
// Get all commits for a specific branch (exluding the parameters and the merged parameters)
commitRouter.get('/', async (req, res) => {
    const { branchId } = req;
    try {
        const commits = await prisma.commit.findMany({ where: { branchId } });
        res.status(200).json({ data: commits });
        return;
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
        console.error('Error retrieving commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});
// pull the latest commit
commitRouter.get('/latest', async (req, res) => {
    try {
        const { branchId } = req;
        // latest commit in this branch
        const latestCommit = await prisma.commit.findFirst({
            where: { branchId },
            orderBy: { createdAt: 'desc', },
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
        if (!latestCommit) {
            res.status(404).send({ error: { message: 'No commits found.' } });
            return;
        }
        res.status(200).json({ data: latestCommit });
    }
    catch (err) {
        console.error('Error retrieving the latest commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});
// create the new commit to the branch
// no merger commit in this version
// all commits are accepted commits
commitRouter.post('/create', async (req, res) => {
    try {
        const pk = authorizedPk(res); // Get the contributor's wallet address
        const { branchId } = req; // Branch ID where the commit is being made
        const { message, paramHash, // param hash will be needed
        params, architecture, // architecture of the model is a new requied field now
         } = req.body;
        // --------------------------------- Commit Parameter validation section ----------------------------------------------------- //            
        let warnings = []; // in case a warning needs to be sent along with the response            
        // cannot create a commit if the base model is not uploaded
        const repo = await prisma.repository.findUnique({ where: { id: req.repoId } });
        if (!repo.baseModel || !repo.baseModel) {
            res.status(400).send({ error: { message: 'Base model not uploaded. Cannot create commit.' } });
            return;
        }
        if (!message) {
            res.status(400).send({ error: { message: 'Commit message is required.' } });
            return;
        }
        if (!branchId) {
            throw new Error('Criticial Error: branchId not attached to response.');
        }
        // Validate input fields
        // in this version the metrics is an optional field
        if (!paramHash ||
            !params ||
            !architecture) {
            res.status(400).send({ error: { message: 'Complete commit information not provided.' } });
            return;
        }
        const commitHash = uuidV4(); // Generate a unique commit hash
        // get the committer id        
        const committer = await prisma.user.findFirst({
            where: { wallet: pk }
        });
        // committer needs to be registered first
        if (!committer) {
            res.status(401).send({ error: { message: 'User not found.' } });
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
        const hasWriteAccess = repository.ownerAddress === pk || repository.writeAccessIds.includes(pk);
        if (!hasWriteAccess) {
            res.status(403).send({
                error: { message: 'Unauthorized. You do not have write access to this repository.' },
            });
            return;
        }
        if (!params.params) {
            res.status(400).send({ error: { message: 'Error: No parameters (weights) provided.' } });
            return;
        }
        const { zkmlProof } = params;
        if (!zkmlProof) {
            warnings.push('No ZKML proof provided for commit.');
            // res.status(400).send({ error: { message: 'Error: No ZKML proof provided as params.' } });
            // return;
        }
        else {
            // ------------------- Uncomment if you want the ZKML field to be mandatory -------------------------
            // // extract the zkml proof for this commit
            const { proof, settings, verification_key } = zkmlProof;
            // ZKML fields are not mandatory but if provided they must be unique
            if (proof && settings && verification_key) {
                const sameZKMLProofs = await prisma.zKMLProof.count({
                    where: {
                        proof,
                        settings,
                        verification_key
                    }
                });
                // if same zkml proofs are found the commit cannot be created
                if (sameZKMLProofs) {
                    res.status(400).send({ error: { message: 'ZKML proof already exists. ZKML proof must be unique.' } });
                    return;
                }
            }
        }
        // maintaing uniqueness of the commits
        // finally we need to make sure that the paramHash commitHash and parameters are unique for each commit
        const sameHashCommits = await prisma.commit.count({ where: { commitHash } });
        if (sameHashCommits) {
            res.status(400).send({ error: { message: 'Commit hash already exists. Commit hash must be unique.' } });
            return;
        }
        const sameParamHashCommits = await prisma.commit.count({ where: { paramHash } });
        if (sameParamHashCommits) {
            res.status(400).send({ error: { message: 'Paremeter hash of commit already exists. Parameter hash must be unique.' } });
            return;
        }
        // merger commit structure removed
        // now before this we need to fetch the shared folder from the shared folder model
        // fetch the latest shared folder of this branch by this person
        const sharedFolder = await prisma.sharedFolderFile.findFirst({
            where: {
                branchId: req.branchId,
                committerAddress: pk,
            },
            orderBy: { createdAt: 'desc' }
        });
        if (!sharedFolder) {
            res.status(400).send({ error: { message: 'Shared folder for the commit not found. Please train and commit again.' } });
            return;
        }
        // now that we have the shared folder we extract the metrics from it
        const metricsRaw = extractMetricsAfter(sharedFolder);
        const metricsExtracted = metricsRaw.at(-1);
        if (!metricsExtracted) {
            res.status(400).send({ error: { message: 'Metrics not found in the shared folder.' } });
            return;
        }
        const metricsFinal = {
            accuracy: parseFloat(metricsExtracted.accuracy),
            loss: parseFloat(metricsExtracted.loss),
        };
        // Finally create the commit
        const commit = await prisma.commit.create({
            data: {
                committerAddress: pk,
                message,
                // in the current version we have removed the local and merged parameters
                // for an accepted commit it is the local parameters and for a merger commit it is the merged parameters
                metrics: metricsFinal,
                branchId: branchId, // makes the necessary updates in the branch model
                commitHash,
                status: 'MERGED', // for this version this is always merged
                verified: true, // since we are mandating the zkml proof, therefore its always verified
                architecture, // architecuture is required in the current version                
                paramHash, // hash of the parameters for this commit       
                params: {
                    // create a new ZKML proof entry for this params
                    create: {
                        params: params.params, // Assumes params is an object with base64 encoded data
                        // here we fetch the shared folder instance from the shared folder model
                        ...(params.zkmlProof.proof &&
                            params.zkmlProof.settings &&
                            params.zkmlProof.verification_key &&
                            {
                                ZKMLProof: {
                                    create: {
                                        verification_key: params.zkmlProof.verification_key,
                                        proof: params.zkmlProof.proof,
                                        settings: params.zkmlProof.settings,
                                    }
                                }
                            })
                    },
                },
                committerId: committer.id // makes the necessary updates in the user schema
            },
        });
        // update the updated at fields of both the branch and repository schemas
        await prisma.$transaction([
            prisma.branch.update({
                where: { id: req.branchId },
                data: { updatedAt: new Date() }
            }),
            prisma.repository.update({
                where: { id: req.repoId },
                data: { updatedAt: new Date() }
            }),
        ]);
        res.status(201).json({ data: commit, warnings });
    }
    catch (error) {
        console.error('Error creating commit:', error);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});
// the shared folder creation route goes here
commitRouter.use('/sharedFolder/', sharedFolderRouter);
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
// commit nft view route
// not included in the current version
// commitRouter.get('/hash/:commitHash/viewNft', async (req, res, next) => {
//     try {
//         const { commitHash } = req.params;
//         const commit = await prisma.commit.findUnique({
//             where: { commitHash },
//             include: {
//                 nft: true
//             }
//         });
//         if (!commit) {
//             res.status(400).send({ error: { message: 'Commit does not exist.' } });
//             return;
//         }
//         if (!commit.nftId || !commit.nft || !commit.nft.signature || !commit.nft.merkleTreeAddress) {
//             res.status(400).send({ error: { message: 'Commit is not an Nft' } });
//             return;
//         }
//         const asset = await fetchCNftFromSignature(umi, commit.nft.merkleTreeAddress, commit.nft.signature);
//         // const asset = await fetchCnft(umi, commit.nft.assetId);
//         res.status(200).json(asset);
//     }
//     catch (err) {
//         res.status(400).send({ error: { message: `${err}` } });
//         return;
//     }
// })
export { commitRouter };
