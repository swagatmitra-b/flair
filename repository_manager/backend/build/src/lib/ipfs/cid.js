// create a CID for the sent file without uploading to IPFS
// Debashish Buragohain
import { sha256 } from 'multiformats/hashes/sha2';
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
export async function computeCID(fileBuffer) {
    const input = new Uint8Array(fileBuffer);
    const digest = await sha256.digest(input);
    const cid = CID.createV1(raw.code, digest);
    return cid.toString();
}
