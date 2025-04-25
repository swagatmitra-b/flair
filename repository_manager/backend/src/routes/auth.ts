// SIWS authentication router
// Debashish Buragohain

import { Router } from "express";
import { createSignInData, verifySIWSsignin } from '../lib/auth/siws/index.js';
import { verifyGenSignInFirstTime } from "../lib/auth/general/index.js";
import { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";

const authRouter = Router();

// similar to JWT and the way we did with the general Solana authentication we need to send the sign in token every time we send
// a request to the backend.
// this needs to be a get request
authRouter.get('/signin/:address', async (req, res) => {
    const { address } = req.params;
    const signInInputData = await createSignInData(address);
    res.json(signInInputData);
});

// sign in is the only endpoint where we send the headers as a body for the first time verification
authRouter.post('/signin', (req, res) => {
    // not supporting the special request as of now
    const { body } = req;
    // general connect + sign in workflow
    if (body.token) {
        try {
            const { token } = body;
            if (!token || typeof token !== "string" || !token.includes(".")) {
                res.status(400).json({ success: false, error: "Invalid token format." });
                return;
            }
            if (verifyGenSignInFirstTime(token, 'signin')) {
                res.status(200).json({ success: true });
                return;
            }
        }
        catch (err: any) {
            console.error('Error in Authentication: ', err);
            res.status(400).json({ success: false, error: err.message });
        }
    }
    // siws sign in
    else if (body.input) {
        try {
            const deconstructPayload: { input: SolanaSignInInput, output: SolanaSignInOutput } = body;
            if (!verifySIWSsignin(deconstructPayload.input, deconstructPayload.output)) {
                res.status(400).json({ success: false });
            }
            else {
                res.json({ success: true });
            }
        }
        catch (err) {
            console.error(`Error in SIWS authentication: ${err}`);
            res.status(400).json({ success: false });
        }
    }
    else res.status(400).json({ success: false });
});

export { authRouter };