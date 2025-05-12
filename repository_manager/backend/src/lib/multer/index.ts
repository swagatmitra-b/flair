import { Request } from "express";
import multer, { FileFilterCallback } from "multer";

// the allowed file types must be consistent everywhere
export const allowedTypes = ["onnx", "h5", "pt", "pth", 'pkl', 'py'];
const maxSize = process.env.BASEMODEL_MAX_SIZE || 20;       // in MB

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
    const fileExt = file.originalname.split(".").pop()?.toLowerCase();
    if (fileExt && allowedTypes.includes(fileExt)) {
        req.fileExtension = fileExt;        // attach the file extension to the request now
        cb(null, true);
    } else {
        cb(new Error("Invalid file type! Only ONNX, Py, H5, PT, PKL and PTH files are allowed."));
    }
};

// setup the middleware to upload the base model
// the model must be sent under the base model field in the request
export const uploader = multer({
    storage, fileFilter,
    limits: { fileSize: (maxSize as number) * 1024 * 1024 }
}).single('baseModel');