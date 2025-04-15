// middleware to check if the request has a valid signature of the wallet
// Debashish Buragohain
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import b58 from 'bs58';
import { TextDecoder } from 'util';
import { DateTime } from 'luxon';
/**
 * This authentication middleware is used to verify
 * that the request is signed by the owner of the public key.
 * It uses an authorization header with the following format:
 * `Authorization: Bearer pk.msg.sig`
 * Where pk is the base58-encoded public key, msg is the base58-encoded message,
 * and sig is the base58-encoded signature.
 * This middleware does not validate the lifetime of the signature or the
 * contents of the message.
 */
export const web3Auth = (ctx) => (req, res, next) => {
    const { action, allowSkipCheck } = ctx;
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        res
            .status(401)
            .send({ error: { message: 'Missing Authorization header' } });
        return;
    }
    const [, authToken] = authHeader.split(' ');
    const [pk, msg, sig] = authToken.split('.');
    // verifiying the hash here
    const hasValidSig = nacl.sign.detached.verify(b58.decode(msg), b58.decode(sig), new PublicKey(pk).toBytes());
    if (!hasValidSig) {
        res.status(401).send({ error: { message: 'Invalid signature' } });
        return;
    }
    const contents = JSON.parse(new TextDecoder().decode(b58.decode(msg)));
    if (DateTime.local().toUTC().toUnixInteger() > contents.exp) {
        res.status(401).send({ error: { message: 'Expired signature' } });
        return;
    }
    const skipActionCheck = allowSkipCheck && contents.action === 'skip';
    console.log('💎', {
        action: contents.action,
        allowSkipCheck,
        skipActionCheck,
    });
    if (!skipActionCheck && contents.action !== action) {
        res.status(401).send({ error: { message: 'Invalid action' } });
        return;
    }
    res.locals.pubKey = pk;
    next();
};
export const authorizedPk = (res) => res.locals.pubKey;
