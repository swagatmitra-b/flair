// authenticated requests gateway for both SIWS and general workflow
// Debashish Buragohain


import { MemoryStoredTokenSiws, siwsSignIn } from "../auth/siws";
import { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";
import { MemoryStoredTokenGen, genSignIn } from "../auth/general";
import b58 from 'bs58';

// SIWS request function
// creating a dedicated request function that sends the authorization headers along with the request
const siwsRequest = async (
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
        // this request exclusively requires that your wallet has the signIn feature enabled
        const signInFailed = await siwsSignIn();
        input = MemoryStoredTokenSiws.getInstance().input;
        output = MemoryStoredTokenSiws.getInstance().output;
        if (signInFailed || !isValidToken(input, output)) {
            throw new Error('Cannot make request as wallet not signed in. Please sign in first.');
        }
    }

    // base64 encode the headers for transmission to the backend
    const token = btoa(JSON.stringify({ input, output, action }));
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


// general workflow requests
// dedicated authenticated request function for general sign in
const genRequest = async (
    contents: requestParams
) => {
    const { method, url, data } = contents;    
    let authToken;
    // signin is the action equivalent to SIWS authentication in the general workflow
    // Try to reuse existing token.
    const memoryToken = MemoryStoredTokenGen.getInstance().token;
    // if token present in memory
    if (memoryToken) {
        const [, msg] = memoryToken.split(".");
        // check out the expiration time for the token
        // if it has expired we request the user to sign in again
        const contents = JSON.parse(
            new TextDecoder().decode(b58.decode(msg))
        ) as { expirationTime: string };

        // if token has expired then create a new token at this point itself
        if (Date.now() > new Date(contents.expirationTime).getTime()) {
            await genSignIn();
            authToken = MemoryStoredTokenGen.getInstance().token;
        }
        // else if the token is valid
        else {
            authToken = memoryToken;
        }
    }
    // don't have a token in memory create a new one.
    else {
        await genSignIn();
        authToken = MemoryStoredTokenGen.getInstance().token;
    }

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

export interface requestParams {
    method?: string,
    url: string,
    data?: string,
    action: string          // action is necessary for all requests now
}

// a general request involves all the general functionalities
export const request = async (contents: requestParams) => {
    // if we are connected using SIWS
    if (MemoryStoredTokenSiws.getInstance().output) {
        return await siwsRequest(contents);
    }
    // if connected using the general workflow
    else if (MemoryStoredTokenGen.getInstance().token) {
        return await genRequest(contents);
    }
    else throw new Error('No wallet connected. Cannot make request.');
}
