// reference code to read from directory
// export async function readDataFile(
//     filename: string,
//     directory: string,
// ): Promise<Uint8ClampedArray> {
//     const filePath = path.join(
//         __dirname,
//         '..',
//         'public',
//         'data',
//         directory,
//         filename,
//     )
//     const buffer = await fs.readFile(filePath)
//     return new Uint8ClampedArray(buffer.buffer)
// }
export function uint8ClampedArrayToString(uint8Array) {
    return new TextDecoder().decode(uint8Array);
}
export function stringToUint8ClampedArray(str) {
    return new Uint8ClampedArray(new TextEncoder().encode(str));
}
export function serializeZkmlProof(deserialized) {
    const serialized = {};
    serialized.proof = stringToUint8ClampedArray(deserialized.proof);
    serialized.settings = stringToUint8ClampedArray(deserialized.settings);
    serialized.verification_key = stringToUint8ClampedArray(deserialized.verification_key);
    return serialized;
}
export function deserializeZkmlProof(serialized) {
    const deserialized = {};
    deserialized.proof = uint8ClampedArrayToString(serialized.proof);
    deserialized.settings = uint8ClampedArrayToString(serialized.settings);
    deserialized.verification_key = uint8ClampedArrayToString(serialized.verification_key);
    return deserialized;
}
