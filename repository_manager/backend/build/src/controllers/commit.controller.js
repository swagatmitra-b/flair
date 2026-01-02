import { prisma } from '../lib/prisma/index.js';
import { authorizedPk } from '../middleware/auth/authHandler.js';
import { extractMetricsAfter } from '../lib/sharedFolder/index.js';
import storageProvider from '../lib/storage/index.js';
import { constructIPFSUrl } from '../lib/ipfs/ipfs.js';
import jwt from 'jsonwebtoken';
import config from '../../config.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidV4 } from 'uuid';
import { convertCommitToNft } from '../lib/nft/nft.js';
import { umi } from '../lib/nft/umi.js';
const ZKP_JWT_SECRET = process.env.ZKP_JWT_SECRET || 'super-secret-commit-generation';
const COMMIT_JWT_SECRET = process.env.COMMIT_JWT_SECRET || 'another-super-secret-commit-generation';
const SESSION_EXPIRY_MINUTES = config.commit.session.expiryMinutes || 10;
const BLOCK_DURATION_MINUTES = config.commit.session.blockDurationMinutes || 2;
// Helper: Block user for 2 minutes
async function blockUser(pk) {
    const blockedUntil = new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000);
    await prisma.initiationBlock.upsert({
        where: { pk },
        update: { blockedUntil },
        create: { pk, blockedUntil }
    });
}
// Helper: Record session error and block user
async function recordSessionError(sessionId, pk) {
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
export const getAllCommits = async (req, res) => {
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
};
export const getCommitForPull = async (req, res) => {
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
    }
    catch (err) {
        console.error('Error retrieving commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
};
export const getCommitByHash = async (req, res) => {
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
};
export const getLatestCommit = async (req, res) => {
    try {
        const { branchId } = req;
        const latestCommit = await prisma.commit.findFirst({
            where: { branchId },
            orderBy: { createdAt: 'desc' },
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
    }
    catch (err) {
        console.error('Error retrieving the latest commit:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
};
export const initiateCommitSession = async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { repoId, branchId } = req;
        const block = await prisma.initiationBlock.findUnique({ where: { pk } });
        if (block && block.blockedUntil > new Date()) {
            const remainingSeconds = Math.ceil((block.blockedUntil.getTime() - Date.now()) / 1000);
            res.status(403).json({
                error: { message: `Initiation blocked. Please try again in ${remainingSeconds} seconds.` }
            });
            return;
        }
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
        const jti = uuidV4();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000);
        const session = await prisma.commitCreationSession.create({
            data: {
                jti,
                pk,
                repoId: repoId,
                branchId: branchId,
                expiresAt,
                status: 'INITIATED'
            }
        });
        const initiateToken = jwt.sign({
            type: 'commit_initiate',
            sessionId: session.id,
            jti,
            pk,
            repoId: repoId,
            branchId: branchId
        }, COMMIT_JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_MINUTES}m` });
        res.status(200).json({
            sessionId: session.id,
            initiateToken,
            expiresAt: expiresAt.toISOString()
        });
    }
    catch (err) {
        console.error('Error initiating commit session:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
};
export const checkZKMLProof = async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { sessionId, initiateToken, proofCid, settingsCid, vkCid } = req.body;
        if (!sessionId || !initiateToken || !proofCid || !settingsCid || !vkCid) {
            res.status(400).json({ error: { message: 'All fields (sessionId, initiateToken, proofCid, settingsCid, vkCid) are required.' } });
            return;
        }
        let decoded;
        try {
            decoded = jwt.verify(initiateToken, COMMIT_JWT_SECRET);
        }
        catch (err) {
            res.status(403).json({ error: { message: 'Invalid or expired initiate token.' } });
            return;
        }
        if (decoded.type !== 'commit_initiate' || decoded.sessionId !== sessionId || decoded.pk !== pk) {
            res.status(403).json({ error: { message: 'Token mismatch or unauthorized.' } });
            return;
        }
        const session = await prisma.commitCreationSession.findUnique({ where: { id: sessionId } });
        if (!session || session.consumed || session.status !== 'INITIATED' || (session.expiresAt && session.expiresAt < new Date())) {
            await blockUser(pk);
            res.status(403).json({ error: { message: 'Invalid or expired session.' } });
            return;
        }
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
            return;
        }
        await prisma.commitCreationSession.update({
            where: { id: sessionId },
            data: { status: 'ZKML_VERIFIED' }
        });
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
    }
    catch (err) {
        console.error('Error checking ZKML:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
};
export const uploadZKMLProofs = async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { sessionId, initiateToken, zkmlToken, proof, settings, verification_key } = req.body;
        if (!sessionId || !initiateToken || !zkmlToken || !proof || !settings || !verification_key) {
            res.status(400).json({
                error: { message: 'All fields (sessionId, initiateToken, zkmlToken, proof, settings, verification_key) are required.' }
            });
            return;
        }
        let sessionJwt;
        try {
            sessionJwt = jwt.verify(initiateToken, COMMIT_JWT_SECRET);
        }
        catch {
            res.status(403).json({ error: { message: 'Invalid or expired initiateToken.' } });
            return;
        }
        if (sessionJwt.type !== 'commit_initiate' || sessionJwt.sessionId !== sessionId || sessionJwt.pk !== pk) {
            res.status(403).json({ error: { message: 'Initiate token mismatch or unauthorized.' } });
            return;
        }
        let zkmlJwt;
        try {
            zkmlJwt = jwt.verify(zkmlToken, ZKP_JWT_SECRET);
        }
        catch {
            res.status(403).json({ error: { message: 'Invalid or expired zkmlToken.' } });
            return;
        }
        if (zkmlJwt.type !== 'commit_zkml' || zkmlJwt.sessionId !== sessionId || zkmlJwt.pk !== pk) {
            await recordSessionError(sessionId, pk);
            res.status(403).json({ error: { message: 'ZKML token mismatch or unauthorized.' } });
            return;
        }
        const session = await prisma.commitCreationSession.findUnique({ where: { id: sessionId } });
        if (!session || session.consumed || session.status !== 'ZKML_VERIFIED' || (session.expiresAt && session.expiresAt < new Date())) {
            await recordSessionError(sessionId, pk);
            res.status(403).json({ error: { message: 'Invalid or expired session.' } });
            return;
        }
        const proofUpload = await storageProvider.add(proof, { pin: true });
        const settingsUpload = await storageProvider.add(settings, { pin: true });
        const vkUpload = await storageProvider.add(verification_key, { pin: true });
        const allowed = zkmlJwt.allowedCids || {};
        if (proofUpload.cid.toString() !== allowed.proofCid ||
            settingsUpload.cid.toString() !== allowed.settingsCid ||
            vkUpload.cid.toString() !== allowed.vkCid) {
            await recordSessionError(sessionId, pk);
            res.status(403).json({
                error: { message: 'Security Mismatch: Uploaded ZKML files do not match the CIDs authorized in the token.' }
            });
            return;
        }
        const proofIpfs = await prisma.ipfsObject.upsert({
            where: { cid: proofUpload.cid.toString() },
            update: {},
            create: {
                cid: proofUpload.cid.toString(),
                uri: constructIPFSUrl(proofUpload.cid),
                extension: 'json',
                size: proofUpload.size || 0
            }
        });
        const settingsIpfs = await prisma.ipfsObject.upsert({
            where: { cid: settingsUpload.cid.toString() },
            update: {},
            create: {
                cid: settingsUpload.cid.toString(),
                uri: constructIPFSUrl(settingsUpload.cid),
                extension: 'json',
                size: settingsUpload.size || 0
            }
        });
        const vkIpfs = await prisma.ipfsObject.upsert({
            where: { cid: vkUpload.cid.toString() },
            update: {},
            create: {
                cid: vkUpload.cid.toString(),
                uri: constructIPFSUrl(vkUpload.cid),
                extension: 'json',
                size: vkUpload.size || 0
            }
        });
        const existingProof = await prisma.zKMLProof.findFirst({
            where: {
                proofIpfsId: proofIpfs.id,
                settingsIpfsId: settingsIpfs.id,
                verificationKeyIpfsId: vkIpfs.id
            }
        });
        if (existingProof) {
            await recordSessionError(sessionId, pk);
            res.status(409).json({ error: { message: 'ZKML proof already exists.' } });
            return;
        }
        await prisma.commitCreationSession.update({
            where: { id: sessionId },
            data: {
                status: 'ZKML_UPLOADED',
                zkmlProofIpfsId: proofIpfs.id,
                zkmlSettingsIpfsId: settingsIpfs.id,
                zkmlVkIpfsId: vkIpfs.id
            }
        });
        const zkmlReceiptToken = jwt.sign({
            type: 'commit_zkml_receipt',
            sessionId,
            pk,
            repoId: sessionJwt.repoId,
            branchId: sessionJwt.branchId,
            proofIpfsId: proofIpfs.id,
            settingsIpfsId: settingsIpfs.id,
            vkIpfsId: vkIpfs.id
        }, ZKP_JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_MINUTES}m` });
        res.status(200).json({
            success: true,
            message: 'ZKML files uploaded successfully. Proceed to finalize.',
            zkmlReceiptToken,
            proofCid: proofIpfs.cid,
            settingsCid: settingsIpfs.cid,
            vkCid: vkIpfs.cid
        });
    }
    catch (err) {
        console.error('Error uploading ZKML params:', err);
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
};
export const uploadParameters = async (req, res) => {
    let paramsCid = null;
    try {
        const pk = authorizedPk(res);
        const { sessionId, initiateToken, zkmlReceiptToken } = req.body;
        if (!sessionId || !initiateToken || !zkmlReceiptToken) {
            res.status(400).json({
                error: { message: 'All fields (sessionId, initiateToken, zkmlReceiptToken) are required.' }
            });
            return;
        }
        if (!req.file) {
            res.status(400).json({ error: { message: 'No parameters file uploaded.' } });
            return;
        }
        let sessionJwt;
        try {
            sessionJwt = jwt.verify(initiateToken, COMMIT_JWT_SECRET);
        }
        catch {
            res.status(403).json({ error: { message: 'Invalid or expired initiateToken.' } });
            return;
        }
        if (sessionJwt.type !== 'commit_initiate' || sessionJwt.sessionId !== sessionId || sessionJwt.pk !== pk) {
            res.status(403).json({ error: { message: 'Initiate token mismatch or unauthorized.' } });
            return;
        }
        let receiptJwt;
        try {
            receiptJwt = jwt.verify(zkmlReceiptToken, ZKP_JWT_SECRET);
        }
        catch {
            res.status(403).json({ error: { message: 'Invalid or expired zkmlReceiptToken.' } });
            return;
        }
        if (receiptJwt.type !== 'commit_zkml_receipt' || receiptJwt.sessionId !== sessionId || receiptJwt.pk !== pk) {
            res.status(403).json({ error: { message: 'ZKML receipt mismatch or unauthorized.' } });
            return;
        }
        const session = await prisma.commitCreationSession.findUnique({ where: { id: sessionId } });
        if (!session || session.consumed || session.status !== 'ZKML_UPLOADED' || (session.expiresAt && session.expiresAt < new Date())) {
            await recordSessionError(sessionId, pk);
            res.status(403).json({ error: { message: 'Invalid or expired session. Expected ZKML_UPLOADED status.' } });
            return;
        }
        if (session.paramsIpfsId) {
            res.status(409).json({ error: { message: 'Parameters already uploaded for this commit. Cannot upload multiple parameter sets.' } });
            return;
        }
        const paramsPath = path.join(req.file.destination, req.file.filename);
        if (!fs.existsSync(paramsPath)) {
            console.error('Error: Params file does not exist for uploading to IPFS.');
            res.status(500).json({ error: { message: 'Internal Server Error: File not found.' } });
            return;
        }
        const fileSize = req.file.size;
        if (!fileSize) {
            res.status(400).json({ error: { message: 'Invalid file size.' } });
            return;
        }
        const paramsUploadRes = await storageProvider.add(paramsPath, { pin: true });
        paramsCid = paramsUploadRes?.cid?.toString();
        if (!paramsCid) {
            res.status(500).json({ error: { message: 'Could not upload parameters to IPFS.' } });
            return;
        }
        const paramsIpfs = await prisma.ipfsObject.upsert({
            where: { cid: paramsCid },
            update: {},
            create: {
                cid: paramsCid,
                uri: constructIPFSUrl(paramsCid),
                extension: req.fileExtension || 'bin',
                size: fileSize
            }
        });
        await prisma.commitCreationSession.update({
            where: { id: sessionId },
            data: {
                status: 'PARAMS_UPLOADED',
                paramsIpfsId: paramsIpfs.id
            }
        });
        const paramsReceiptToken = jwt.sign({
            type: 'commit_params_receipt',
            sessionId,
            pk,
            repoId: sessionJwt.repoId,
            branchId: sessionJwt.branchId,
            paramsIpfsId: paramsIpfs.id
        }, ZKP_JWT_SECRET, { expiresIn: `${SESSION_EXPIRY_MINUTES}m` });
        res.status(200).json({
            success: true,
            message: 'Parameters uploaded successfully. Proceed to finalize.',
            paramsReceiptToken,
            paramsCid: paramsIpfs.cid,
            paramsIpfsId: paramsIpfs.id
        });
    }
    catch (err) {
        console.error('Error uploading parameters:', err);
        if (paramsCid) {
            try {
                console.log('Cleaning up orphaned parameters file from IPFS...');
                await storageProvider.remove(paramsCid);
                console.log('Successfully removed orphaned parameters file.');
            }
            catch (cleanupErr) {
                console.error('Error cleaning up parameters file from IPFS:', cleanupErr);
            }
        }
        res.status(500).json({ error: { message: 'Internal Server Error' } });
    }
};
export const finalizeCommit = async (req, res) => {
    let sessionId;
    let zkmlCids = null;
    let paramsCid = null;
    try {
        const pk = authorizedPk(res);
        const { branchId, repoId } = req;
        const { message, paramHash, architecture, initiateToken, zkmlReceiptToken, paramsReceiptToken } = req.body;
        if (!initiateToken) {
            res.status(401).json({ error: { message: 'Missing initiateToken. Call /create/initiate first.' } });
            return;
        }
        let sessionJwt;
        try {
            sessionJwt = jwt.verify(initiateToken, COMMIT_JWT_SECRET);
        }
        catch {
            res.status(403).json({ error: { message: 'Invalid or expired initiateToken.' } });
            return;
        }
        if (sessionJwt.pk !== pk || sessionJwt.repoId !== repoId || sessionJwt.branchId !== branchId) {
            res.status(403).json({ error: { message: 'Initiate token does not match user/repo/branch.' } });
            return;
        }
        sessionId = sessionJwt.sessionId;
        if (!zkmlReceiptToken) {
            res.status(400).json({ error: { message: 'Missing zkmlReceiptToken. Upload ZKML proofs before finalizing.' } });
            return;
        }
        let zkmlReceiptJwt;
        try {
            zkmlReceiptJwt = jwt.verify(zkmlReceiptToken, ZKP_JWT_SECRET);
        }
        catch {
            res.status(403).json({ error: { message: 'Invalid or expired zkmlReceiptToken.' } });
            return;
        }
        if (zkmlReceiptJwt.type !== 'commit_zkml_receipt' || zkmlReceiptJwt.sessionId !== sessionId || zkmlReceiptJwt.pk !== pk || zkmlReceiptJwt.repoId !== repoId || zkmlReceiptJwt.branchId !== branchId) {
            res.status(403).json({ error: { message: 'ZKML receipt does not match current session/context.' } });
            return;
        }
        if (!paramsReceiptToken) {
            res.status(400).json({ error: { message: 'Missing paramsReceiptToken. Upload parameters before finalizing.' } });
            return;
        }
        let paramsReceiptJwt;
        try {
            paramsReceiptJwt = jwt.verify(paramsReceiptToken, ZKP_JWT_SECRET);
        }
        catch {
            res.status(403).json({ error: { message: 'Invalid or expired paramsReceiptToken.' } });
            return;
        }
        if (paramsReceiptJwt.type !== 'commit_params_receipt' || paramsReceiptJwt.sessionId !== sessionId || paramsReceiptJwt.pk !== pk || paramsReceiptJwt.repoId !== repoId || paramsReceiptJwt.branchId !== branchId) {
            res.status(403).json({ error: { message: 'Params receipt does not match current session/context.' } });
            return;
        }
        const zkmlRelationInput = {
            create: {
                proofIpfsId: zkmlReceiptJwt.proofIpfsId,
                settingsIpfsId: zkmlReceiptJwt.settingsIpfsId,
                verificationKeyIpfsId: zkmlReceiptJwt.vkIpfsId
            }
        };
        try {
            const [proofObj, settingsObj, vkObj] = await Promise.all([
                prisma.ipfsObject.findUnique({ where: { id: zkmlReceiptJwt.proofIpfsId } }),
                prisma.ipfsObject.findUnique({ where: { id: zkmlReceiptJwt.settingsIpfsId } }),
                prisma.ipfsObject.findUnique({ where: { id: zkmlReceiptJwt.vkIpfsId } })
            ]);
            if (proofObj && settingsObj && vkObj) {
                zkmlCids = {
                    proofCid: proofObj.cid,
                    settingsCid: settingsObj.cid,
                    vkCid: vkObj.cid
                };
            }
            const paramsObj = await prisma.ipfsObject.findUnique({ where: { id: paramsReceiptJwt.paramsIpfsId } });
            if (paramsObj) {
                paramsCid = paramsObj.cid;
            }
        }
        catch (err) {
            console.error('Error fetching CIDs for cleanup tracking:', err);
        }
        const session = await prisma.commitCreationSession.findUnique({ where: { id: sessionId } });
        if (!session || session.consumed || session.status !== 'PARAMS_UPLOADED' || (session.expiresAt && session.expiresAt < new Date())) {
            await recordSessionError(sessionId, pk);
            res.status(403).json({ error: { message: 'Invalid or expired session. Expected PARAMS_UPLOADED status.' } });
            return;
        }
        const repo = await prisma.repository.findUnique({ where: { id: repoId }, include: { baseModel: true } });
        if (!repo?.baseModelId) {
            res.status(400).json({ error: { message: 'Base model not uploaded. Cannot create commit.' } });
            return;
        }
        if (!message) {
            res.status(400).json({ error: { message: 'Commit message is required.' } });
            return;
        }
        if (!branchId) {
            throw new Error('Critical Error: branchId not attached to response.');
        }
        if (!paramHash || !architecture) {
            res.status(400).json({ error: { message: 'paramHash and architecture are required.' } });
            return;
        }
        const commitHash = uuidV4();
        const committer = await prisma.user.findFirst({ where: { wallet: pk } });
        if (!committer) {
            res.status(401).json({ error: { message: 'User not found.' } });
            return;
        }
        const branch = await prisma.branch.findFirst({ where: { id: branchId }, include: { repository: true } });
        if (!branch) {
            res.status(404).json({ error: { message: 'Branch does not exist.' } });
            return;
        }
        // Determine parent commit hash
        const parentCommitHashInput = req.body?.parentCommitHash?.trim();
        let parentCommitHash;
        if (parentCommitHashInput && parentCommitHashInput.length > 0) {
            // User provided explicit parent
            parentCommitHash = parentCommitHashInput;
        }
        else {
            // Not provided: default to latest commit in branch, or genesis if none exist
            const latestCommit = await prisma.commit.findFirst({
                where: { branchId, isDeleted: false },
                orderBy: { createdAt: 'desc' }
            });
            parentCommitHash = latestCommit ? latestCommit.commitHash : '_GENESIS_COMMIT_';
        }
        const hasWriteAccess = branch.repository.ownerAddress === pk || branch.repository.writeAccessIds.includes(pk);
        if (!hasWriteAccess) {
            res.status(403).json({ error: { message: 'Unauthorized. You do not have write access to this repository.' } });
            return;
        }
        // Ensure parent commit exists in this branch (unless genesis)
        if (parentCommitHash !== '_GENESIS_COMMIT_') {
            const parentCommit = await prisma.commit.findFirst({
                where: { commitHash: parentCommitHash, branchId }
            });
            if (!parentCommit) {
                res.status(404).json({ error: { message: 'Parent commit not found in this branch.' } });
                return;
            }
        }
        if (await prisma.commit.count({ where: { commitHash } })) {
            res.status(400).json({ error: { message: 'Commit hash already exists.' } });
            return;
        }
        if (await prisma.commit.count({ where: { paramHash } })) {
            res.status(400).json({ error: { message: 'Parameter hash already exists.' } });
            return;
        }
        // Check for existing children of the parent in this branch
        const existingChildren = await prisma.commit.count({
            where: { branchId, previousCommitHash: parentCommitHash }
        });
        const forkNeeded = existingChildren > 0;
        let targetBranchId = branchId;
        let forkedBranch = null;
        const sharedFolder = await prisma.sharedFolderFile.findFirst({
            where: { branchId, committerAddress: pk },
            orderBy: { createdAt: 'desc' }
        });
        if (!sharedFolder) {
            res.status(400).json({ error: { message: 'Shared folder not found. Please train and commit again.' } });
            return;
        }
        const metricsRaw = extractMetricsAfter(sharedFolder);
        const metricsExtracted = metricsRaw.at(-1);
        if (!metricsExtracted) {
            res.status(400).json({ error: { message: 'Metrics not found in the shared folder.' } });
            return;
        }
        const metricsFinal = {
            accuracy: parseFloat(metricsExtracted.accuracy),
            loss: parseFloat(metricsExtracted.loss),
        };
        const paramsIpfs = await prisma.ipfsObject.findUnique({
            where: { id: paramsReceiptJwt.paramsIpfsId }
        });
        if (!paramsIpfs) {
            res.status(404).json({ error: { message: 'Parameters IPFS object not found. Please re-upload parameters.' } });
            return;
        }
        const commit = await prisma.$transaction(async (tx) => {
            if (zkmlRelationInput) {
                const duplicateProof = await tx.zKMLProof.findFirst({
                    where: {
                        proofIpfsId: zkmlRelationInput.create.proofIpfsId,
                        settingsIpfsId: zkmlRelationInput.create.settingsIpfsId,
                        verificationKeyIpfsId: zkmlRelationInput.create.verificationKeyIpfsId
                    }
                });
                if (duplicateProof) {
                    throw new Error('ZKML Proof combination already exists in database.');
                }
            }
            const paramsCreateInput = {
                ipfsObjectId: paramsIpfs.id
            };
            if (zkmlRelationInput) {
                paramsCreateInput.ZKMLProof = zkmlRelationInput;
            }
            if (forkNeeded) {
                const forkBranchName = `${branch.name}-fork-${uuidV4().split('-')[0]}`;
                forkedBranch = await tx.branch.create({
                    data: {
                        name: forkBranchName,
                        description: `Forked from ${branch.name} at ${parentCommitHash}`,
                        repositoryId: branch.repositoryId,
                        branchHash: uuidV4(),
                        ...(branch.latestParamsId && { latestParamsId: branch.latestParamsId })
                    }
                });
                targetBranchId = forkedBranch.id;
            }
            const newCommit = await tx.commit.create({
                data: {
                    committerAddress: pk,
                    message,
                    metrics: metricsFinal,
                    branchId: targetBranchId,
                    commitHash,
                    previousCommitHash: parentCommitHash,
                    status: 'MERGED', // the status is set to MERGED directly for simplicity for now
                    verified: !!zkmlRelationInput,
                    architecture,
                    paramHash,
                    params: {
                        create: paramsCreateInput,
                    },
                    committerId: committer.id
                },
                include: {
                    params: {
                        include: { ZKMLProof: true }
                    }
                }
            });
            await tx.branch.update({ where: { id: targetBranchId }, data: { updatedAt: new Date() } });
            await tx.repository.update({ where: { id: repoId }, data: { updatedAt: new Date() } });
            await tx.commitCreationSession.update({ where: { id: sessionId }, data: { consumed: true, status: 'FINALIZED' } });
            return newCommit;
        });
        res.status(201).json({
            data: commit,
            forkedBranch: forkedBranch ? { branchHash: forkedBranch.branchHash, name: forkedBranch.name } : null,
            message: forkedBranch
                ? `Parent already used. Commit created on new branch ${forkedBranch.name}.`
                : 'Commit created successfully.'
        });
    }
    catch (error) {
        console.error('Error creating commit:', error);
        if (sessionId && zkmlCids) {
            try {
                const session = await prisma.commitCreationSession.findUnique({
                    where: { id: sessionId }
                });
                if (session?.zkmlProofIpfsId && session?.zkmlSettingsIpfsId && session?.zkmlVkIpfsId) {
                    const [proofObj, settingsObj, vkObj] = await Promise.all([
                        prisma.ipfsObject.findUnique({ where: { id: session.zkmlProofIpfsId } }),
                        prisma.ipfsObject.findUnique({ where: { id: session.zkmlSettingsIpfsId } }),
                        prisma.ipfsObject.findUnique({ where: { id: session.zkmlVkIpfsId } })
                    ]);
                    if (proofObj && settingsObj && vkObj) {
                        console.log('Cleaning up orphaned ZKML files from IPFS...');
                        await Promise.all([
                            storageProvider.remove(proofObj.cid),
                            storageProvider.remove(settingsObj.cid),
                            storageProvider.remove(vkObj.cid)
                        ]);
                        await Promise.all([
                            prisma.ipfsObject.delete({ where: { id: proofObj.id } }).catch(() => { }),
                            prisma.ipfsObject.delete({ where: { id: settingsObj.id } }).catch(() => { }),
                            prisma.ipfsObject.delete({ where: { id: vkObj.id } }).catch(() => { })
                        ]);
                        console.log('Successfully removed orphaned ZKML files and DB records.');
                    }
                }
            }
            catch (cleanupErr) {
                console.error('Error cleaning up ZKML files:', cleanupErr);
            }
        }
        if (paramsCid) {
            try {
                console.log('Cleaning up orphaned parameters file from IPFS...');
                await storageProvider.remove(paramsCid);
                console.log('Successfully removed orphaned parameters file.');
            }
            catch (cleanupErr) {
                console.error('Error cleaning up parameters file from IPFS:', cleanupErr);
            }
        }
        if (error.message === 'ZKML Proof combination already exists in database.') {
            res.status(409).json({ error: { message: error.message } });
            return;
        }
        res.status(500).send({ error: { message: 'Internal Server Error' } });
    }
};
export const createCommitNft = async (req, res, next) => {
    try {
        const { commitHash } = req.params;
        const asset = await convertCommitToNft(umi, commitHash);
        res.status(200).json({ data: asset });
    }
    catch (err) {
        res.status(400).send({ error: { message: `${err}` } });
        return;
    }
};
