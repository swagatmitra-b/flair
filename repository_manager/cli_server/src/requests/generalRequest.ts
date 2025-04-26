import { requestParams } from "./types";
import { MemoryStoredTokenGen } from "../auth/general.js";
import { DateTime } from 'luxon';
import b58 from 'bs58';
import { parseSignInMessage } from "./abnf_parser.js";

// general workflow requests
// for the general workflow, the action is incuded in the token itself. Therefore we just do an additional chec
export const genRequest = async (
    contents: requestParams
) => {
    const { method, url, data, action } = contents;

    let authToken;
    // signin is the action equivalent to SIWS authentication in the general workflow. Try to reuse existing token.
    const memoryToken = MemoryStoredTokenGen.getInstance().token;
    if (!memoryToken) {
        throw new Error('User not signed in. Please sign in first.');
    }

    // in the current version we are not re signing the user from here itself
    if (memoryToken) {
        const [, msg] = memoryToken.split(".");         // msg here is contains the ABNF-like string that pops up in the user's wallet

        // check out the expiration time for the token and the associated action
        const decodedSignInMessage = new TextDecoder().decode(b58.decode(msg));
        const parsedDecoded = parseSignInMessage(decodedSignInMessage);
        const actionInToken = parsedDecoded['Action'] as string;
        const expirationTime = parsedDecoded['Expiration Time'] as string;
        if (!actionInToken || !expirationTime)
            throw new Error("Required fields (Action, Expiration Time) are missing from token. Please sign in again.");

        // Check token expiration: Convert the ISO string to a Unix timestamp
        const expUnix = DateTime.fromISO(expirationTime).toUnixInteger();
        if (DateTime.local().toUTC().toUnixInteger() > expUnix) {
            throw new Error("Expired token. Please sign in again");
        }

        if (actionInToken !== action)
            throw new Error(`Action mismatch in token. Desired action: ${action} Action in token: ${actionInToken}`);

        authToken = memoryToken;
    }
    if (!authToken) throw new Error('Auth token not generated for request.');

    // this is the final request for the general workflow request
    return await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer universal${authToken}`
        },
        body: (data) ? JSON.stringify(data) : undefined,
        method: method ? method : data ? "POST" : "GET"
    })
        .then(r => r.json())
        .catch(err => console.error(`Error sending auth token to backend: ${err}`));
};