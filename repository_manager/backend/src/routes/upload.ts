// route to handle base model uploads
// Debashish Buragohain

import { PinataSDK, PinResponse } from 'pinata-web3';
import { Request, Router } from 'express';
import path from 'path';
import multer, { FileFilterCallback, MulterError } from "multer";
import { prisma } from '../lib/prisma';
import fs from 'fs';
import { computeCID } from '../lib/ifps/cid';

const uploadRouter = Router();

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.GATEWAY_URL!,
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, process.env.MULTER_URL!);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix); // Create unique filenames
    },
});

// apply some other filters here
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedTypes = ["onnx", "h5", "pt", "pth"];
    const fileExt = file.originalname.split(".").pop()?.toLowerCase();
    if (fileExt && allowedTypes.includes(fileExt)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type! Only ONNX, H5, PT, and PTH files are allowed."));
    }
};

// setup the middleware to upload the base model
// the model must be sent under the base model field in the request
const uploader = multer({ storage, fileFilter }).single('baseModel');

// sends a model to the backend for uploading to the frontend
uploadRouter.post('/upload', uploader, async (req, res) => {
    if (!req.file) {
        console.error('File not saved to /tmp/uploads.');
        res.status(500).send({ error: { message: 'No file uploaded!' } });
        return;
    }
    // reached here means the file is saved in the folder
    const modelPath = path.join(req.file.destination, req.file.filename);
    if (!fs.existsSync(modelPath)) {
        console.error('Error: File does not exists for uploading to IPFS.');
        res.status(500).send({ error: { message: 'Internal Server Error.' } });
        return;
    }
    // start the uploading of the model
    const cid = await uploadToIpfs(modelPath);
    if (!cid) {
        res.status(500).send({ error: { message: `Could not upload to IPFS.` } });
        return;
    }
    res.json(200).json({ data: { cid } });    
});

// upload the file given in the model path to IPFS, update in prisma and then delete the temporary file instance
// the optimization function happens here itself it does not need to be informed to the user for this
async function uploadToIpfs(modelPath: string): Promise<string | undefined> {
    try {
        const inputFile = fs.readFileSync(modelPath);
        // check here itself if the model already exists in ipfs
        const cid = await computeCID(inputFile);
        if (!cid) {
            throw new Error('Failed to compte CID of uploaded file.');
        }
        const existingRepo = await prisma.repository.findFirst({
            where: { baseModelHash: cid }
        });
        let upload: Partial<PinResponse> = {};
        // if the model does not already exist
        if (!existingRepo || !existingRepo.baseModelUri || !existingRepo.baseModelUri) {
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
        console.error('Error uploading to IPFS:', err);
        return undefined;
    }
}

export async function fetchModel(cid: string) {
    const file = await pinata.gateways.get(cid);
}

export { uploadRouter };