// shared folder route for handling the shared folder API
// Debashish Buragohain

import { prisma } from "../lib/prisma/index.js";
import { Router, raw } from "express";
import { authorizedPk } from "../middleware/auth/authHandler.js"

// models before and after aggregation are not allowed to be shared in the shared folder
const prohibitedKeys = ['model_before_aggregation', 'model_after_aggregation'];
const sharedFolderRouter = Router();

// the model parameters are created using this route
sharedFolderRouter.put('/files/keras/:committerAddress/:key',
    // this route needs to be a binary route
    raw({ type: 'application/octet-stream', limit: '50mb' }),
    async (req, res) => {
        const { branchId } = req;
        const pk = authorizedPk(res);
        const { committerAddress, key } = req.params;
        // model metrics are sent
        const modelMetrics = req.body;        
        if (!modelMetrics) {
            res.status(400).send({ error: { message: "Model metrics are required." } });
            return;
        }
        if (!branchId) {
            res.status(400).send({ error: { message: "Branch ID is required." } });
            return;
        }
        if (!committerAddress || !key) {
            res.status(400).send({ error: { message: "Committer address and key are required." } });
            return;
        }
        // the commiter address should be the same as the public key of the user
        if (committerAddress !== pk) {
            res.status(403).send({ error: { message: "You are not authorized to access this file." } });
            return;
        }
        if (prohibitedKeys.some(prohibitedKey => key.includes(prohibitedKey))) {
            res.status(400).send({ error: { message: "This file is not allowd to be stored." } });
            return;
        }

        let folder;
        const existingSharedFolder = await prisma.sharedFolderFile.findFirst({
            where: {
                branchId,
                committerAddress,
            }
        });
        // if the folder does not exist we create a new one with blank fields and update it later
        if (!existingSharedFolder) {
            const newSharedFolder = await prisma.sharedFolderFile.create({
                data: {
                    branchId,
                    committerAddress,
                    metrics_before_aggregation: [],
                    metrics_after_aggregation: [],
                }
            });
            if (!newSharedFolder) {
                res.status(500).send({ error: { message: "Error in creating shared folder." } });
                return;
            }
            folder = newSharedFolder;
        }
        else {
            folder = existingSharedFolder;
        }

        if (!folder) {
            res.status(500).send({ error: { message: "Error in retrieving shared folder." } });
            return;
        }

        // the field name that has been provided in the request
        const fieldName = key.includes('metrics_before_aggregation') ? 'metrics_before_aggregation' : 'metrics_after_aggregation';
        // if folder exists, simply update it or else create a new one
        // check which parameter is provided to be stored
        const updatedSharedFolder = await prisma.sharedFolderFile.update({
            where: {
                id: folder.id,
            },
            data: {
                // update either the metrics_before_aggregation or the model_after_aggregation
                [fieldName]: {
                    set: folder[fieldName].map((item, index) =>
                        // basically if it matches with the padded zeroed index then we are going to update it else not
                        key.includes(`_${index.toString().padStart(5, '0')}.json`) ? modelMetrics : item)
                }
            },
        });
        res.status(200).json(updatedSharedFolder);
    })

// the pickled model is stored in in this route
sharedFolderRouter.put('/files/:committerAddress',
    raw({ type: 'application/octet-stream', limit: '50mb' }),
    async (req, res) => {
        const { branchId } = req;
        const pk = authorizedPk(res);
        const { committerAddress } = req.params;
        const model = req.body; // the model is sent in the request body
        if (!model) {
            res.status(400).send({ error: { message: "Model is required." } });
            return;
        }
        if (!branchId) {
            res.status(400).send({ error: { message: "Branch ID is required." } });
            return;
        }
        if (!committerAddress) {
            res.status(400).send({ error: { message: "Committer address is required." } });
            return;
        }
        // the committer address should be the same as the public key of the user
        if (committerAddress !== pk) {
            res.status(403).send({ error: { message: "You are not authorized to access this file." } });
            return;
        }

        let folder;
        const existingSharedFolder = await prisma.sharedFolderFile.findFirst({
            where: {
                branchId,
                committerAddress,
            }
        });
        // if the folder does not exist, create a new one with blank fields and update it later
        if (!existingSharedFolder) {
            const newSharedFolder = await prisma.sharedFolderFile.create({
                data: {
                    branchId,
                    committerAddress,
                    metrics_before_aggregation: [],
                    metrics_after_aggregation: [],
                }
            });
            if (!newSharedFolder) {
                res.status(500).send({ error: { message: "Error in creating shared folder." } });
                return;
            }
            folder = newSharedFolder;
        }
        else {
            folder = existingSharedFolder;
        }

        if (!folder) {
            res.status(500).send({ error: { message: "Error in retrieving shared folder." } });
            return;
        }

        // Update the model field in the shared folder
        const updatedSharedFolder = await prisma.sharedFolderFile.update({
            where: { id: folder.id, },
            data: {
                model, // Store the model sent in the request body
            },
        });
        res.status(200).json(updatedSharedFolder);
    });



// binary file routes
// the route for the keras folder (metrics before and after aggregation)
sharedFolderRouter.get("/files/keras/:committerAddress/:key(*)", async (req, res) => {
    const { branchId } = req;
    const pk = authorizedPk(res);
    const { committerAddress, key } = req.params;
    try {
        if (!committerAddress || !key) {
            res.status(400).send({ error: { message: "Committer address and key are required." } });
            return;
        }
        // the commiter address should be the same as the public key of the user
        if (committerAddress !== pk) {
            res.status(403).send({ error: { message: "You are not authorized to access this file." } });
            return;

        }
        // find the shared folder for this branch and this user
        const matchedSharedFolder = await prisma.sharedFolderFile.findFirst({
            where: {
                branchId,
                committerAddress: pk,
            }
        });
        if (!matchedSharedFolder) {
            res.status(400).send({ error: { message: "Shared folder does not exist for this branch and user." } });
            return;
        }
        // prohibited key comes first            
        if (prohibitedKeys.some(prohibitedKey => key.includes(prohibitedKey))) {
            res.status(400).send({ error: { message: "Access to this file is not allowed." } });
            return;
        }

        let file;           // file to be sent in the response
        // metrics after aggregation
        if (!key.includes('.json')) {
            res.status(400).send({ error: { message: "File name should end with .json" } });
            return;
        }
        if (key.includes('metrics_after_aggregation_')) {
            const indexMatch = key.match(/metrics_after_aggregation_(\d+)\.json/);
            if (indexMatch) {
                const index = parseInt(indexMatch[1], 10);
                file = matchedSharedFolder.metrics_after_aggregation?.[index];
            }
        }
        // metric before aggregation
        else if (key.includes('metrics_before_aggregation_')) {
            const indexMatch = key.match(/metrics_before_aggregation_(\d+)\.json/);
            if (indexMatch) {
                const index = parseInt(indexMatch[1], 10);
                file = matchedSharedFolder.metrics_before_aggregation?.[index];
            }
        }

        if (file) {
            // check if we just have to check for the success flag
            if (key.endsWith('success')) {
                res.status(200).send();            // just send a 200 response if the file is found                
                return;
            }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.status(200).send(file);
        } else {
            // if we only have to send the success flag
            if (key.endsWith('success')) {
                res.status(404).send();           // if the file is not found, send a 404 response
                return;
            }
            res.status(404).send({ error: { message: "File not found." } });
        }
    }
    catch (err) {
        console.error("Error in shared folder retrieval:", err);
        res.status(500).send({ error: { message: `${err}` } });
    }
});


// the route for the saved model for the user
sharedFolderRouter.get("/files/:committerAddress(*)", async (req, res) => {
    const { branchId } = req;
    const pk = authorizedPk(res);
    const { committerAddress } = req.params;
    if (!committerAddress) {
        res.status(400).send({ error: { message: "committerAddress is required." } });
        return;
    }
    // the committerAddress of the file is the public key of the user
    if (!committerAddress.includes(pk)) {
        res.status(403).send({ error: { message: "You are not authorized to access this file." } });
        return;
    }
    try {
        // find the shared folder for this branch and this user
        const matchedSharedFolder = await prisma.sharedFolderFile.findFirst({
            where: {
                branchId,
                committerAddress: pk,
            }
        });
        if (!matchedSharedFolder) {
            res.status(400).send({ error: { message: "Shared folder does not exist for this branch and user." } });
            return;
        }
        // check if the file exists in the shared folder
        const file = matchedSharedFolder.model;
        if (file) {
            if (committerAddress.endsWith('success')) {
                res.status(200).send();            // just send a 200 response if the file is found
                return;
            }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.status(200).send(file);
        } else {
            // if we only have to send the success flag
            if (committerAddress.endsWith('success')) {
                res.status(404).send();           // if the file is not found, send a 404 response
                return;
            }
            // if the file is not found, send a 404 response
            res.status(404).send({ error: { message: "File not found." } });
        }
    }
    catch (err) {
        console.error("Error in shared folder retrieval:", err);
        res.status(500).send({ error: { message: `${err}` } });
    }
});


// get list routes
// listing the keys for metrics before and after aggregation
sharedFolderRouter.get('/files/list/keras/:committerAddress', async (req, res) => {
    const { branchId } = req;
    const pk = authorizedPk(res);
    const { committerAddress } = req.params;
    try {
        if (!committerAddress) {
            res.status(400).send({ error: { message: "Committer address is required." } });
            return;
        }
        // the commiter address should be the same as the public key of the user
        if (committerAddress !== pk) {
            res.status(403).send({ error: { message: "You are not authorized to access this file." } });
            return;

        }
        // find the shared folder for this branch and this user
        const matchedSharedFolder = await prisma.sharedFolderFile.findFirst({
            where: {
                branchId,
                committerAddress: pk,
            }
        });
        if (!matchedSharedFolder) {
            res.status(400).send({ error: { message: "Shared folder does not exist for this branch and user." } });
            return;
        }
        const files = [];
        for (let i = 0; i < matchedSharedFolder.metrics_after_aggregation.length; i++) {
            files.push(`metrics_after_aggregation_${i.toString().padStart(5, '0')}.json`);
        }
        for (let i = 0; i < matchedSharedFolder.metrics_before_aggregation.length; i++) {
            files.push(`metrics_before_aggregation_${i.toString().padStart(5, '0')}.json`);
        }
        res.status(200).json(files);
        return;
    }
    catch (err) {
        console.error("Error in shared folder retrieval:", err);
        res.status(500).send({ error: { message: `${err}` } });
    }
});

// the keys for the saved model folder contains a list of all the model.pkl files with the committer addresses as their names
sharedFolderRouter.get('/files/list', async (req, res) => {
    // here we need to find the list of all the committer addresses for the branch and the repo
    const { branchId } = req;
    const matchedSharedFolders = await prisma.sharedFolderFile.findMany({
        where: { branchId },
        select: { committerAddress: true }
    });
    const files = [];
    for (const matchedSharedFolder of matchedSharedFolders) {
        files.push(`${matchedSharedFolder.committerAddress}.pkl`);
    }
    res.status(200).json(files);
});


// delete routes here
sharedFolderRouter.delete("/files/keras/:committerAddress/:key(*)",
    async (req, res) => {
        const { branchId } = req;
        const pk = authorizedPk(res);
        const { committerAddress, key } = req.params;
        if (!branchId) {
            res.status(400).send({ error: { message: "Branch ID is required." } });
            return;
        }
        if (!committerAddress || !key) {
            res.status(400).send({ error: { message: "Committer address and key are required." } });
            return;
        }
        // the commiter address should be the same as the public key of the user
        if (committerAddress !== pk) {
            res.status(403).send({ error: { message: "You are not authorized to access this file." } });
            return;
        }
        // find the shared folder for this branch and this user
        const folder = await prisma.sharedFolderFile.findFirst({ where: { branchId, committerAddress: pk } });
        if (!folder) {
            res.status(404).send({ error: { message: "Folder not found." } });
            return;
        }
        const fieldName = key.includes("before")
            ? "metrics_before_aggregation"
            : "metrics_after_aggregation";


        // actally remove the deleted entries from prisma
        const deleteIndex = parseInt(
            key.match(/_(\d+)\.json/)?.[1] || "-1",
            10
        );
        const updatedArr = folder[fieldName].filter((_, idx) => idx !== deleteIndex);

        await prisma.sharedFolderFile.update({
            where: { id: folder.id },
            data: { [fieldName]: { set: updatedArr } },
        });
        res.status(204).send();
    }
);

sharedFolderRouter.delete("/files/:committerAddress(*)", async (req, res) => {
    const { branchId } = req;
    const pk = authorizedPk(res);
    const { committerAddress } = req.params;

    if (!branchId) {
        res.status(400).send({ error: { message: "Branch ID is required." } });
        return;
    }
    if (!committerAddress) {
        res.status(400).send({ error: { message: "Committer address is required." } });
        return;
    }
    // the committer address should be the same as the public key of the user
    if (committerAddress !== pk) {
        res.status(403).send({ error: { message: "You are not authorized to access this file." } });
        return;
    }
    // find the shared folder for this branch and this user
    const folder = await prisma.sharedFolderFile.findFirst({
        where: { branchId, committerAddress: pk },
    });
    if (!folder) {
        res.status(404).send({ error: { message: "Folder not found." } });
        return;
    }
    // clear the model field
    await prisma.sharedFolderFile.update({
        where: { id: folder.id },
        data: { model: null },
    });
    res.status(204).send();
});



export { sharedFolderRouter }