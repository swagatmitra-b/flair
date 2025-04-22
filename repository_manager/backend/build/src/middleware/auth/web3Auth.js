// middleware to check if the request has a valid signature of the wallet
// Debashish Buragohain
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import b58 from 'bs58';
const extractFromABNF = (message) => {
    const msgArray = message.split('\n');
    let action = '';
    let expiryTime = '';
    for (const field of msgArray) {
        if (field.includes('Action:')) {
            const [, extractedAction] = field.split(' ');
            action = extractedAction;
        }
        if (field.includes('Expiration Time:')) {
            const [, extractedExpiry] = field.split(' ');
            expiryTime = extractedExpiry;
        }
    }
    return { action, expiryTime };
};
// not just the validity of the signature but also its expiry and if the signature matches the action
export const web3Auth = (ctx) => (req, res, next) => {
    const { allowSkipCheck } = ctx;
    const givenAction = ctx.action;
    const authHeader = req.header('Authorization');
    authHeader.replace('universal', ""); // remove the verificaton strategy from the header
    const [, authToken] = authHeader.split(' ');
    const [pk, msg, sig] = authToken.split('.');
    // first step is to verify the signature
    // verifiying the hash here
    const hasValidSig = nacl.sign.detached.verify(b58.decode(msg), b58.decode(sig), new PublicKey(pk).toBytes());
    if (!hasValidSig) {
        res.status(401).send({ error: { message: 'Invalid signature' } });
        return;
    }
    // extract the action and expiry components here itself
    // if signature valid then check whether the token is expired or not
    // const contents = JSON.parse(new TextDecoder().decode(b58.decode(msg))) as {
    //   action: string;
    //   exp: number;
    // };
    const { action, expiryTime } = extractFromABNF(msg);
    if (Date.now() > new Date(expiryTime).getMilliseconds()) {
        res.status(401).send({ error: { message: 'Expired signature' } });
        return;
    }
    const skipActionCheck = allowSkipCheck && action === 'signin';
    console.log('💎', {
        action,
        allowSkipCheck,
        skipActionCheck,
    });
    // the skip action check is the last check and checks whether the action that has been signed matches the action that is provided to be performed
    // skip action check skips this action though. so we can essentially do a skip action on every action, but we have allowed the skip action to be
    // available only for the GET request from the server.
    if (!skipActionCheck && action !== givenAction) {
        res.status(401).send({ error: { message: 'Invalid action' } });
        return;
    }
    // if authorized, store the authorized public key in the local property of the response
    res.locals.pubKey = pk;
    next();
};
// extract the authoorized public key that is stored in the locals property
export const authorizedPk = (res) => res.locals.pubKey;
