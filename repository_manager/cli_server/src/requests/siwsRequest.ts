import { MemoryStoredTokenSiws } from "../auth/siws.js";
import { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";
import { requestParams } from "./types";
import fetch from 'node-fetch';

// SIWS request function. In here, the token does not include the action because the default action in siws is the sign in action
// therefore we send particularly the action for the siws, that must be compared.
export const siwsRequest = async (
    contents: requestParams) => {
    const { method, url, data, action } = contents;
    // try to reuse existing token
    let { input, output } = MemoryStoredTokenSiws.getInstance();
    const isValidToken = (input?: SolanaSignInInput, output?: SolanaSignInOutput): boolean => {
        if (!input || !output) {
            console.warn('Not signed in.');
            return false;
        }
        if (!input.expirationTime) {
            console.warn('Required field exipirationTime not present in sign in input from backend.');
            return false;
        }
        if (Date.now() > new Date(input.expirationTime).getTime()) {
            console.warn('Authentication token expired.');
            return false
        }
        return true;
    }

    if (!isValidToken(input, output)) {
        // in the current version we are not signing in siws from this function itself
        throw new Error('Cannot make request as wallet not signed in. Please sign in first.');
    }

    // this is the final request for the siws workflow request
    // base64 encode the headers for transmission to the backend
    const token = Buffer.from(JSON.stringify({input, output, action})).toString('base64');

    return await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer siws${token}`
        },
        body: (data) ? JSON.stringify(data) : undefined,
        method: method ? method : data ? "POST" : "GET"
    })
        .then(r => r.json())
        .catch(err => console.error(`Error sending SIWS token to backend: ${err}`));
}