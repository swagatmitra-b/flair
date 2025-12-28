// Storage manager: start small and ensure ESM imports include .js suffix for node
// Debashish Buragohain
import { PinataProvider } from '../ipfs/pinata.js';
// Minimal facade for now: export the default provider and helper passthroughs
export function getDefaultProvider() {
    return new PinataProvider();
}
export async function add(content, opts) {
    return getDefaultProvider().add(content, opts);
}
export async function get(cid) {
    const p = getDefaultProvider();
    if (!p.get)
        throw new Error(`${p.name} does not implement get()`);
    return p.get(cid);
}
export async function remove(cid) {
    const p = getDefaultProvider();
    if (!p.remove)
        throw new Error(`${p.name} does not implement remove()`);
    return p.remove(cid);
}
export default {
    getDefaultProvider,
    add,
    get,
    remove,
};
