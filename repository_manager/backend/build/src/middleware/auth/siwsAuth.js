// Authentication script for the Sign In With Solana
// Only for apps that support the SIWS function
// Debashish Buragohain
import { verifySIWSsignin } from "../../lib/auth/siws/verifySignIn";
export const siwsAuth = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        res.status(401)
            .send({ error: { message: 'Missing authorization header.' } });
        return;
    }
    // get the verifiers now
    const { input, output } = JSON.parse(Buffer.from(authHeader, 'base64').toString('utf-8'));
    const formattedInput = input;
    const formattedOutput = output;
    if (!verifySIWSsignin(formattedInput, formattedOutput)) {
        res.status(401).send({ error: { message: 'Sign In Verification failed!' } });
        return;
    }
    // if authorized, attach the authorized public key in the locals property of the response
    res.locals.pubKey = formattedInput.address?.toString();
    next();
};
// get the authorized public key for
export const authorizedPkSiws = (res) => res.locals.pubKey;
