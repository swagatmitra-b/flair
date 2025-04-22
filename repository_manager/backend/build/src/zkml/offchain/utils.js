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
    serialized.circuitSettingsSer = stringToUint8ClampedArray(deserialized.circuitSettingsSer);
    serialized.proofSer = stringToUint8ClampedArray(deserialized.proofSer);
    serialized.srsSer = stringToUint8ClampedArray(deserialized.srsSer);
    serialized.verifierKey = stringToUint8ClampedArray(deserialized.verifierKey);
    return serialized;
}
export function deserializeZkmlProof(serialized) {
    const deserialized = {};
    deserialized.circuitSettingsSer = uint8ClampedArrayToString(serialized.circuitSettingsSer);
    deserialized.proofSer = uint8ClampedArrayToString(serialized.proofSer);
    deserialized.srsSer = uint8ClampedArrayToString(serialized.srsSer);
    deserialized.verifierKey = uint8ClampedArrayToString(serialized.verifierKey);
    return deserialized;
}
