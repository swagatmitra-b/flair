import multer from "multer";
import config from "../../../config.js";
// configuration file for the uploader
// the client sends the base model to the uploader in the backend which stores it locally first
// then it is uploaded to IPFS and the local file is deleted
// Debashish Buragohain
// the allowed file types must be consistent everywhere
const allowedTypes = config.upload.baseModel.allowedFileTypes;
const maxSize = config.upload.baseModel.maxSize || 20; // in MB
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, process.env.MULTER_URL);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix); // Create unique filenames
    },
});
// apply some other filters here
const fileFilter = (req, file, cb) => {
    const fileExt = file.originalname.split(".").pop()?.toLowerCase();
    if (fileExt && allowedTypes.includes(fileExt)) {
        req.fileExtension = fileExt; // attach the file extension to the request now
        cb(null, true);
    }
    else {
        cb(new Error(`Invalid file type! Only ${allowedTypes.join(", ").toUpperCase()} files are allowed.`));
    }
};
// setup the middleware to upload the base model
// the model must be sent under the base model field in the request
export const uploader = multer({
    storage, fileFilter,
    limits: { fileSize: maxSize * 1024 * 1024 }
}).single('baseModel');
