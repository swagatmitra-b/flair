// SIWS sign in verification
// Debashish Buragohain

import type {
    SolanaSignInInput,
    SolanaSignInOutput
} from '@solana/wallet-standard-features';

import { verifySignIn } from '@solana/wallet-standard-util';

export  function verifySIWSsignin(
    // need both the input and output for the SIWS verification
    input: SolanaSignInInput,
    output: SolanaSignInOutput
): boolean {
    
    // firstly we need to serialize the output since the signedMessage function does not give a serialized output
    const serializedOutput: SolanaSignInOutput = {
        account: {
            ...output.account,
            publicKey: new Uint8Array(output.account.publicKey)
        },
        signature: new Uint8Array(output.account.publicKey),
        signedMessage: new Uint8Array(output.signedMessage)
    };
    
    return verifySignIn(input, serializedOutput);
}