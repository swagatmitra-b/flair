import { createSignInData, verifySIWSsignin } from '../lib/auth/siws/index.js';
import { verifyGenSignInFirstTime } from "../lib/auth/general/index.js";
export const getSignInData = async (req, res) => {
    // Wrap in try/catch so we never drop the connection on validation errors (prevents socket hang-ups)
    try {
        const { address } = req.params;
        const signInInputData = await createSignInData(address);
        res.json(signInInputData);
    }
    catch (err) {
        console.error('Error creating SIWS sign-in payload:', err);
        res.status(400).json({ success: false, error: err?.message || 'Failed to create sign-in payload' });
    }
};
export const signIn = (req, res) => {
    const { body } = req;
    // General connect + sign in workflow
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
        catch (err) {
            console.error('Error in Authentication: ', err);
            res.status(400).json({ success: false, error: err.message });
        }
    }
    // SIWS sign in
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
    else
        res.status(400).json({ success: false });
};
