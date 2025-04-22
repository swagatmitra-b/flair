// SIWS authentication router
// Debashish Buragohain
import { Router } from "express";
import { createSignInData, verifySIWSsignin } from '../lib/auth/siws/index.js';
import { verifyGenSignIn } from "../lib/auth/general/index.js";
const authRouter = Router();
// similar to JWT and the way we did with the general Solana authentication we need to send the sign in token every time we send
// a request to the backend.
// this needs to be a get request
authRouter.get('/signin', async (req, res) => {
    const signInInputData = createSignInData();
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
            if (!verifyGenSignIn(token)) {
                console.error('Sign In Verification Failed!');
                res.status(400).json({ success: false });
                return;
            }
            res.status(200).json({ success: true });
            return;
        }
        catch (err) {
            console.error('Error in Authentication: ', err);
            res.status(400).json({ success: false });
        }
    }
    // siws sign in
    else if (body.input) {
        try {
            const deconstructPayload = body;
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
});
export { authRouter };
