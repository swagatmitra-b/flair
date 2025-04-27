// code for the pinata IPFS upload handling
// Debashish Buragohain

import { PinataSDK, PinResponse } from 'pinata-web3';
import path from 'path';
import fs, { stat } from 'fs';
import { computeCID } from './cid.js';
import { prisma } from '../prisma/index.js';

export const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.GATEWAY_URL!,
});

// upload the file given in the model path to IPFS, update in prisma and then delete the temporary file instance
// the optimization function happens here itself it does not need to be informed to the user for this
export async function uploadToIpfs(modelPath: string): Promise<string | undefined> {
    try {
        const inputFile = fs.readFileSync(modelPath);
        // check here itself if the model ealready exists in ipfs
        const cid = await computeCID(inputFile);
        if (!cid) {
            throw new Error('Failed to compte CID of uploaded file.');
        }
        const existingRepo = await prisma.repository.findFirst({
            where: { baseModelHash: cid }
        });
        let upload: Partial<PinResponse> = {};
        // if the model does not already exist
        if (!existingRepo) {
            // upload newly now to IPFS
            const blob = new Blob([inputFile]);
            const fileName = path.basename(modelPath);
            const file = new File([blob], fileName, { type: "application/octet-stream" });
            upload = await pinata.upload.file(file);
        }
        else {
            // if the base model is the same as another repository we just return the url of the previous repository
            // this is already happening in IPFS. But since we are using Pinata, we need to upload the entire model first to Pinata
            // thus local cid searching will make things much faster        
            upload.IpfsHash = existingRepo.baseModelHash!;
            // use the other parameters at a later time... not required now        
        }
        // model Uri needs to be updated in the repository
        fs.unlinkSync(modelPath);
        return upload.IpfsHash!;
    }
    catch (err) {
        console.error('Error uploading Base Model to IPFS:', err);
        return undefined;
    }
}

// unpin the model from the IPFS and returns the cid if successfully deleted
export async function unpinFromIpfs(cid: string): Promise<string> {
    const unpin = await pinata.unpin([cid]);
    return unpin[0].status;
}

export async function fetchModel(cid: string) {
    const file = await pinata.gateways.get(cid);
}