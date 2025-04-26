import { allowedTypes } from '../../lib/multer/index.js';
// check if the file extension is properly specifed in the body
const fileExtensionCheck = async (req, res, next) => {
    const { fileExtension } = req.body;
    if (!fileExtension || typeof fileExtension !== 'string') {
        res.status(400).send({ error: { message: 'file extension field is mandatory.' } });
        return;
    }
    if (!allowedTypes.includes(fileExtension)) {
        res.status(400).send({ error: { message: 'file extension not supported.' } });
        return;
    }
    next();
};
