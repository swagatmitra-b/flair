// the format as is stored in db
export type zkmlDeserialized = {
    verifierKey: string,
    circuitSettingsSer: string,
    proofSer: string,
    srsSer: string,
}

export type zkmlSerialized = {
    verifierKey: Uint8ClampedArray,
    circuitSettingsSer: Uint8ClampedArray,
    proofSer: Uint8ClampedArray,
    srsSer: Uint8ClampedArray,
}