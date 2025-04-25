import { requestParams } from "./types";
import { MemoryStoredTokenGen } from "../auth/general.js";
import { MemoryStoredTokenSiws } from "../auth/siws.js";
import { siwsRequest } from "./siwsRequest.js";
import { genRequest } from "./generalRequest.js";

// a general request involves all the general functionalities
export const request = async (contents: requestParams) => {
    const defaultedContents = { ...contents, action: contents.action || 'signin' };
    // if we are connected using SIWS
    if (MemoryStoredTokenSiws.getInstance().output) {
        return await siwsRequest(defaultedContents);
    }
    // if connected using the general workflow
    else if (MemoryStoredTokenGen.getInstance().token) {
        return await genRequest(defaultedContents);
    }
    else throw new Error('No wallet connected. Cannot make request.');
}