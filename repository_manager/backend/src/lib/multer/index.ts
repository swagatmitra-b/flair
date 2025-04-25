import { Request } from "express";
import multer, { FileFilterCallback } from "multer";


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
    const allowedTypes = ["onnx", "h5", "pt", "pth", 'pkl'];
    const fileExt = file.originalname.split(".").pop()?.toLowerCase();
    if (fileExt && allowedTypes.includes(fileExt)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type! Only ONNX, H5, PT, PKL and PTH files are allowed."));
    }
};

// setup the middleware to upload the base model
// the model must be sent under the base model field in the request
export const uploader = multer({ storage, fileFilter }).single('baseModel');