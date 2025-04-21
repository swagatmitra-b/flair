// the verification function for the general workflow sign in
// Debashish Buragohain

import b58 from 'bs58';
import { DateTime } from 'luxon';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
// user creation function exists
import { userExists, createUser } from '../user';

export const verifyGenSignIn = (authHeader: string, action: string = 'signin'): boolean => {
    const [, authToken] = authHeader.split(' ');
    const [pk, msg, sig] = authToken.split('.');

    // first step is to verify the signature
    // verifiying the hash here
    const hasValidSig = nacl.sign.detached.verify(
        b58.decode(msg),
        b58.decode(sig),
        new PublicKey(pk).toBytes(),
    );

    if (!hasValidSig) {
        console.error(`Invalid signature.`);
        return false;
    }

    // if signature valid then check whether the token is expired or not
    const contents = JSON.parse(new TextDecoder().decode(b58.decode(msg))) as {
        action: string;
        exp: number;
    };

    if (DateTime.local().toUTC().toUnixInteger() > contents.exp) {
        console.error('Expired token.')
        return false;
    }

    // the skip action check is the last check and checks whether the action that has been signed matches the action that is provided to be performed
    // skip action check skips this action though. so we can essentially do a skip action on every action, but we have allowed the skip action to be
    // available only for the GET request from the server.
    if (contents.action !== action) {
        console.error('Invalid action.');
        return false;
    }

    // create a user if he does not exist
    userExists(pk)
        .then(async yes => {
            if (!yes) await createUser(pk);
        })
        .catch(err => console.error(`Error creating user: ${err}`));

    return true;
};