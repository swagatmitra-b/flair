// middleware to check if the request has a valid signature of the wallet
// Debashish Buragohain
import { verifyGenSignIn } from '../../lib/auth/general/index.js';
export const genAuth = (ctx) => (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        res.status(401).send({ error: { message: 'Authorization header not present.' } });
        return;
    }
    try {
        const authorizedPk = verifyGenSignIn(authHeader, ctx.action);
        // this is an unreachable condition but added for safety
        if (!authorizedPk) {
            res.status(401).send({ error: { message: 'authorization failed.' } });
            return;
        }
        // reaches here means we are authorized
        res.locals.pubKey = authorizedPk;
        next();
    }
    catch (err) {
        res.status(401).send({ error: { message: err.message } });
        return;
    }
};
// extract the authoorized public key that is stored in the locals property
export const authorizedPk = (res) => res.locals.pubKey;
