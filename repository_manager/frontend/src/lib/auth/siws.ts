// Requests file for the wallets that support SIWS
// the requests code adds the authentication headers in every request
// as well as stores the tokens that are received from the authentication endpoint
// Debashish Buragohain

import type { SignInMessageSignerWalletAdapter } from '@solana/wallet-adapter-base';
import { useWallet } from '@solana/wallet-adapter-react';
import { SolanaSignInInput, SolanaSignInOutput } from '@solana/wallet-standard-features';
import { useAdapter } from '../../components/AdapterProvider';
import { useUmi } from '../../components/UmiProvider';
import { initializeUmi } from '../nft/umi';

// Singleton class for storing a valid signature on-memory
export class MemoryStoredTokenSiws {
    private constructor(
        public input: SolanaSignInInput | undefined = undefined,
        public output: SolanaSignInOutput | undefined = undefined
    ) { }
    private static instance: MemoryStoredTokenSiws;
    static getInstance(): MemoryStoredTokenSiws {
        if (!MemoryStoredTokenSiws.instance) {
            MemoryStoredTokenSiws.instance = new MemoryStoredTokenSiws();
        }
        return MemoryStoredTokenSiws.instance;
    }
    public setAuth(input: SolanaSignInInput, output: SolanaSignInOutput) {
        this.input = input;
        this.output = output;
    }
}

// fetch the signInInput from the backend
export const getSignInData = async (): Promise<SolanaSignInInput> => {
    const createResponse = await fetch('/auth/signin');
    const input: SolanaSignInInput = await createResponse.json();
    return input;
}

// creates the sign in input and output tokens and stores in memory
export const siwsSignIn = async (signInAdapter?: SignInMessageSignerWalletAdapter): Promise<boolean> => {
    const input = await getSignInData();
    // store this input in memory now
    // send this received sign in input to the wallet and trigger a sign-in request
    // this pops up the message for the user to sign in
    let output: SolanaSignInOutput | null = null;
    if (!signInAdapter) {
        const { signIn } = useWallet();
        if (signIn)
            output = await signIn(input);
        else throw new Error('Wallet does not support Sign In With Solana (SIWS)');
    }
    else {
        // if the signIn function is not null then use that
        output = await signInAdapter.signIn(input);
    }
    // the output is of type SolanaSignInOutput
    const strPayload = JSON.stringify({ input, output });
    const verifyResponse = await fetch('/auth/signin', {
        method: 'POST',
        body: strPayload,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }).then(r => r.json());

    if (!verifyResponse.success) {
        console.error('Sign In Verfication failed!');
        throw new Error('Sign In Verfication failed!');
    }
    // nothing till here means we have successfully signed in 
    // dont need to do auto connect now
    // store the headers in memory now
    console.log('Sign In Successful.');
    
    // creating the Umi object here after a successful sign in
    const { adapter } = useAdapter();
    const { setUmi } = useUmi();
    const umi = await initializeUmi(adapter);
    setUmi(umi);

    MemoryStoredTokenSiws.getInstance().setAuth(input, output);
    return false;
}