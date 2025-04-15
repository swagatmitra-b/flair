// the verification function for the general workflow sign in
// Debashish Buragohain
import b58 from 'bs58';
import { DateTime } from 'luxon';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
export const verifyGenSignIn = (authHeader, action = 'signin') => {
    const [, authToken] = authHeader.split(' ');
    const [pk, msg, sig] = authToken.split('.');
    // first step is to verify the signature
    // verifiying the hash here
    const hasValidSig = nacl.sign.detached.verify(b58.decode(msg), b58.decode(sig), new PublicKey(pk).toBytes());
    if (!hasValidSig) {
        console.error(`Invalid signature.`);
        return false;
    }
    // if signature valid then check whether the token is expired or not
    const contents = JSON.parse(new TextDecoder().decode(b58.decode(msg)));
    if (DateTime.local().toUTC().toUnixInteger() > contents.exp) {
        console.error('Expired token.');
        return false;
    }
    // the skip action check is the last check and checks whether the action that has been signed matches the action that is provided to be performed
    // skip action check skips this action though. so we can essentially do a skip action on every action, but we have allowed the skip action to be
    // available only for the GET request from the server.
    if (contents.action !== action) {
        console.error('Invalid action.');
        return false;
    }
    // come till here means everything is alright
    return true;
};
