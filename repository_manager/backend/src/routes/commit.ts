import { prisma } from '../lib/prisma/index.js';
import { Router } from 'express';
import { authorizedPk } from '../middleware/auth/authHandler.js';
import { commitMetrics, commitParameters, RejectedCommits } from '../lib/types/commit.js';
import {
    convertCommitToNft,
    // fetchCnft, 
    // fetchCNftFromSignature
} from '../lib/nft/nft.js';
import { umi } from '../lib/nft/umi.js';
import { v4 as uuidV4 } from 'uuid';
import { sharedFolderRouter } from './sharedFolder.js';
import { extractMetricsAfter } from '../lib/sharedFolder/index.js';
import { ZKMLProofCreateObj } from '../lib/types/zkmlproof.js';
import storageProvider from '../lib/storage/index.js';
import { constructIPFSUrl } from '../lib/ipfs/ipfs.js';
import jwt from 'jsonwebtoken';
import config from '../../config.js';

// Short-lived token used to authorize ZKML uploads and commit creation
const ZKP_JWT_SECRET = process.env.ZKP_JWT_SECRET || 'super-secret-commit-generation';
const COMMIT_JWT_SECRET = process.env.COMMIT_JWT_SECRET || 'another-super-secret-commit-generation';
const SESSION_EXPIRY_MINUTES = config.commit.session.expiryMinutes || 10;
const BLOCK_DURATION_MINUTES = config.commit.session.blockDurationMinutes || 2;

const commitRouter = Router();

// Helper: Block user for 2 minutes
async function blockUser(pk: string) {
    const blockedUntil = new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000);
    await prisma.initiationBlock.upsert({
        where: { pk },
        update: { blockedUntil },
        create: { pk, blockedUntil }
    });
}

// Helper: Record session error and block user
async function recordSessionError(sessionId: string, pk: string) {
    await prisma.commitCreationSession.update({
        where: { id: sessionId },
        data: {
            status: 'ERROR',
            lastErrorAt: new Date(),
            errorCount: { increment: 1 }
        }
    });
    await blockUser(pk);
}

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
                        ipfsObject: true,
                        ZKMLProof: {
                            include: {
                                proof: true,
                                settings: true,
                                verification_key: true
                            }
                        }
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
                        ipfsObject: true,
                        ZKMLProof: {
                            include: {
                                proof: true,
                                settings: true,
                                verification_key: true
                            }
                        }
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
    } catch (err) {
        console.error('Error retrieving the latest commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});


// ========================================
// STEP 1: Initiate commit creation session
// ========================================
commitRouter.post('/create/initiate', async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { repoId, branchId } = req;
        // Check if user is currently blocked
        const block = await prisma.initiationBlock.findUnique({ where: { pk } });
        if (block && block.blockedUntil > new Date()) {
            const remainingSeconds = Math.ceil((block.blockedUntil.getTime() - Date.now()) / 1000);
            res.status(403).json({
                error: { message: `Initiation blocked. Please try again in ${remainingSeconds} seconds.` }
            });
            return;
        }

        // Validate repo and branch access if provided
        if (repoId) {
            const repo = await prisma.repository.findUnique({ where: { id: repoId } });
            if (!repo) {
                res.status(404).json({ error: { message: 'Repository not found.' } });
                return;
            }
            if (repo.ownerAddress !== pk && !repo.writeAccessIds.includes(pk)) {
                res.status(403).json({ error: { message: 'Unauthorized. You do not have write access to this repository.' } });
                return;
            }
        }

        if (branchId) {
            const branch = await prisma.branch.findUnique({ where: { id: branchId } });
            if (!branch) {
                res.status(404).json({ error: { message: 'Branch not found.' } });
                return;
            }
        }

        // Create session
        const jti = uuidV4();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000);

        const session = await prisma.commitCreationSession.create({
            data: {
                jti,
                pk,
                repoId: repoId!,
                branchId: branchId!,
                expiresAt,
                status: 'INITIATED'
            }
        });

        // Issue initiate token
        const initiateToken = jwt.sign({
            type: 'commit_initiate',
            sessionId: session.id,
            jti,
            pk,
            repoId: repoId!,
            branchId: branchId!
        }, COMMIT_JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_MINUTES}m` });

        res.status(200).json({
            sessionId: session.id,
            initiateToken,
            expiresAt: expiresAt.toISOString()
        });

    } catch (err) {
        console.error('Error initiating commit session:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

// ========================================
// STEP 2: Check ZKML proof uniqueness and issue ZKML token
// ========================================
commitRouter.post('/create/zkml-check', async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { sessionId, initiateToken, proofCid, settingsCid, vkCid } = req.body;

        if (!sessionId || !initiateToken || !proofCid || !settingsCid || !vkCid) {
            res.status(400).json({ error: { message: 'All fields (sessionId, initiateToken, proofCid, settingsCid, vkCid) are required.' } });
            return
        }

        // Verify initiate token
        let decoded: any;
        try {
            decoded = jwt.verify(initiateToken, ZKP_JWT_SECRET);
        } catch (err) {
            res.status(403).json({ error: { message: 'Invalid or expired initiate token.' } });
            return
        }

        if (decoded.type !== 'commit_initiate' || decoded.sessionId !== sessionId || decoded.pk !== pk) {
            res.status(403).json({ error: { message: 'Token mismatch or unauthorized.' } });
            return
        }

        // Verify session
        const session = await prisma.commitCreationSession.findUnique({ where: { id: sessionId } });
        if (!session || session.consumed || session.status !== 'INITIATED' || (session.expiresAt && session.expiresAt < new Date())) {
            await blockUser(pk);
            res.status(403).json({ error: { message: 'Invalid or expired session.' } });
            return
        }

        // Check if ZKML proof triple already exists
        const existingProof = await prisma.zKMLProof.findFirst({
            where: {
                proof: { cid: proofCid },
                settings: { cid: settingsCid },
                verification_key: { cid: vkCid }
            }
        });

        if (existingProof) {
            await recordSessionError(sessionId, pk);
            res.status(409).json({ error: { message: 'ZKML proof already exists. Cannot commit duplicate proofs.' } });
            return
        }

        // Update session status
        await prisma.commitCreationSession.update({
            where: { id: sessionId },
            data: { status: 'ZKML_VERIFIED' }
        });

        // Issue ZKML token
        const zkmlToken = jwt.sign({
            type: 'commit_zkml',
            sessionId,
            allowedCids: { proofCid, settingsCid, vkCid },
            pk
        }, ZKP_JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_MINUTES}m` });

        res.status(200).json({
            zkmlToken,
            expiresAt: new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000).toISOString()
        });

    } catch (err) {
        console.error('Error checking ZKML:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
});

// create the new commit to the branch
// no merger commit in this version
// all commits are accepted commits
commitRouter.post('/create/finalze', async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { branchId, repoId } = req;
        const {
            message,
            paramHash,
            params,
            architecture,
            initiateToken,   // NEW: from /create/initiate
            zkmlToken        // NEW: from /create/zkml-check (required if zkmlProof present)
        }: {
            message: string,
            paramHash: string,
            params: commitParameters,
            architecture: string,
            initiateToken: string,
            zkmlToken?: string
        } = req.body;

        // --- Validate required tokens ---
        if (!initiateToken) {
            res.status(401).json({ error: { message: 'Missing initiateToken. Call /create/initiate first.' } });
            return
        }
        let sessionJwt: any;
        try {
            sessionJwt = jwt.verify(initiateToken, COMMIT_JWT_SECRET);
        } catch {
            res.status(403).json({ error: { message: 'Invalid or expired initiateToken.' } });
            return
        }
        // bind token to context
        if (sessionJwt.pk !== pk || sessionJwt.repoId !== repoId || sessionJwt.branchId !== branchId) {
            res.status(403).json({ error: { message: 'Initiate token does not match user/repo/branch.' } });
            return
        }
        const sessionId = sessionJwt.sessionId as string;

        // --- Basic validations (unchanged) ---
        let warnings: string[] = [];
        const repo = await prisma.repository.findUnique({ where: { id: repoId }, include: { baseModel: true } });
        if (!repo?.baseModelId) {
            res.status(400).json({ error: { message: 'Base model not uploaded. Cannot create commit.' } });
            return
        }
        if (!message) {
            res.status(400).json({ error: { message: 'Commit message is required.' } });
            return
        }
        if (!branchId) throw new Error('Critical Error: branchId not attached to response.');
        if (!paramHash || !params || !architecture) {
            res.status(400).json({ error: { message: 'paramHash, params, and architecture are required.' } });
            return
        }

        const commitHash = uuidV4();
        const committer = await prisma.user.findFirst({ where: { wallet: pk } });
        if (!committer) {
            res.status(401).json({ error: { message: 'User not found.' } });
            return
        }

        const branch = await prisma.branch.findFirst({ where: { id: branchId }, include: { repository: true } });
        if (!branch) {
            res.status(404).json({ error: { message: 'Branch does not exist.' } });
            return
        }
        const hasWriteAccess = branch.repository.ownerAddress === pk || branch.repository.writeAccessIds.includes(pk);
        if (!hasWriteAccess) {
            res.status(403).json({ error: { message: 'Unauthorized. You do not have write access to this repository.' } });
            return
        }

        if (!params.params) {
            res.status(400).json({ error: { message: 'Error: No parameters (weights) provided.' } });
            return
        }

        // uniqueness on commitHash and paramHash
        if (await prisma.commit.count({ where: { commitHash } })) {
            res.status(400).json({ error: { message: 'Commit hash already exists.' } });
            return
        }
        if (await prisma.commit.count({ where: { paramHash } })) {
            res.status(400).json({ error: { message: 'Parameter hash already exists.' } });
            return
        }

        // shared folder / metrics
        const sharedFolder = await prisma.sharedFolderFile.findFirst({
            where: { branchId, committerAddress: pk },
            orderBy: { createdAt: 'desc' }
        });
        if (!sharedFolder) {
            res.status(400).json({ error: { message: 'Shared folder not found. Please train and commit again.' } });
            return
        }
        const metricsRaw = extractMetricsAfter(sharedFolder);
        const metricsExtracted = metricsRaw.at(-1);
        if (!metricsExtracted) {
            res.status(400).json({ error: { message: 'Metrics not found in the shared folder.' } });
            return
        }
        const metricsFinal = {
            accuracy: parseFloat(metricsExtracted.accuracy),
            loss: parseFloat(metricsExtracted.loss),
        };

        // Upload params → IPFS
        const paramsUpload = await storageProvider.add(Buffer.from(params.params, 'base64'), { pin: true });
        const paramsIpfs = await prisma.ipfsObject.upsert({
            where: { cid: paramsUpload.cid },
            update: {},
            create: { cid: paramsUpload.cid, uri: constructIPFSUrl(paramsUpload.cid), extension: 'bin', size: paramsUpload.size || 0 }
        });

        // Handle ZKML (if provided) with zkmlToken
        let zkmlProofCreateObj: ZKMLProofCreateObj | undefined = undefined;
        if (params.zkmlProof && params.zkmlProof.proof && params.zkmlProof.settings && params.zkmlProof.verification_key) {
            if (!zkmlToken) {
                res.status(401).json({ error: { message: 'ZKML proof provided but no zkmlToken. Call /create/zkml-check first.' } });
                return
            }
            let zkmlJwt: any;
            try {
                zkmlJwt = jwt.verify(zkmlToken, ZKP_JWT_SECRET);
            } catch {
                res.status(403).json({ error: { message: 'Invalid or expired zkmlToken.' } });
                return
            }
            // validate token context and type
            if (zkmlJwt.pk !== pk || zkmlJwt.repoId !== repoId || zkmlJwt.branchId !== branchId || zkmlJwt.sessionId !== sessionId || zkmlJwt.type !== 'zkml_upload_auth') {
                res.status(403).json({ error: { message: 'zkmlToken not valid for this user/repo/branch/session.' } });
                return
            }
            const allowed = zkmlJwt.allowedCids || {};

            // Upload proofs
            const proofUpload = await storageProvider.add(params.zkmlProof.proof, { pin: true });
            const settingsUpload = await storageProvider.add(params.zkmlProof.settings, { pin: true });
            const vkUpload = await storageProvider.add(params.zkmlProof.verification_key, { pin: true });

            // CID check
            if (proofUpload.cid.toString() !== allowed.proofCid ||
                settingsUpload.cid.toString() !== allowed.settingsCid ||
                vkUpload.cid.toString() !== allowed.vkCid) {
                res.status(403).json({ error: { message: 'Security Mismatch: Uploaded ZKML files do not match token CIDs.' } });
                return
            }

            // Upsert IPFS objects
            const proofIpfs = await prisma.ipfsObject.upsert({ where: { cid: proofUpload.cid.toString() }, update: {}, create: { cid: proofUpload.cid.toString(), uri: constructIPFSUrl(proofUpload.cid), extension: 'json', size: proofUpload.size || 0 } });
            const settingsIpfs = await prisma.ipfsObject.upsert({ where: { cid: settingsUpload.cid.toString() }, update: {}, create: { cid: settingsUpload.cid.toString(), uri: constructIPFSUrl(settingsUpload.cid), extension: 'json', size: settingsUpload.size || 0 } });
            const vkIpfs = await prisma.ipfsObject.upsert({ where: { cid: vkUpload.cid.toString() }, update: {}, create: { cid: vkUpload.cid.toString(), uri: constructIPFSUrl(vkUpload.cid), extension: 'json', size: vkUpload.size || 0 } });

            // Uniqueness re-check
            const sameZKMLProofs = await prisma.zKMLProof.count({
                where: {
                    proofIpfsId: proofIpfs.id,
                    settingsIpfsId: settingsIpfs.id,
                    verificationKeyIpfsId: vkIpfs.id
                }
            });
            if (sameZKMLProofs) {
                res.status(409).json({ error: { message: 'ZKML proof already exists.' } });
                return
            }

            zkmlProofCreateObj = {
                create: {
                    proofIpfsId: proofIpfs.id,
                    settingsIpfsId: settingsIpfs.id,
                    verificationKeyIpfsId: vkIpfs.id
                }
            };
        } else {
            warnings.push('No ZKML proof provided for commit.');
        }

        // Transaction: create commit + update session/branch/repo
        const commit = await prisma.$transaction(async (tx) => {
            // Build params.create object explicitly
            const paramsCreate: any = {
                ipfsObjectId: paramsIpfs.id
            };
            
            if (zkmlProofCreateObj) {
                paramsCreate.ZKMLProof = zkmlProofCreateObj;
            }

            const newCommit = await tx.commit.create({
                data: {
                    committerAddress: pk,
                    message,
                    metrics: metricsFinal,
                    branchId,
                    commitHash,
                    status: 'MERGED',
                    verified: !!zkmlProofCreateObj,
                    architecture,
                    paramHash,
                    params: {
                        create: paramsCreate,
                    },
                    committerId: committer.id
                },
            });

            await tx.branch.update({ where: { id: branchId }, data: { updatedAt: new Date() } });
            await tx.repository.update({ where: { id: repoId }, data: { updatedAt: new Date() } });
            // mark session consumed/finalized
            await tx.commitCreationSession.update({ where: { id: sessionId }, data: { consumed: true, status: 'FINALIZED' } });
            return newCommit;
        });
        res.status(201).json({ data: commit, warnings });
        return

    } catch (error) {
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