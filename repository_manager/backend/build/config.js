// configuration file for the repository manager backend
// Debashish Buragohain
const config = {
    upload: {
        baseModel: {
            allowedFileTypes: ["onnx", "h5", "pt", "pth", 'pkl', 'py'],
            maxSize: 20, // in MB
        }
    },
};
export default config;
