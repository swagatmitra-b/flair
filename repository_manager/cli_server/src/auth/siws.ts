import { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";

// the singleton memory storage class for siws contains the input and output fields only
export class MemoryStoredTokenSiws {
    private constructor(
        public input: SolanaSignInInput | undefined = undefined,
        public output: SolanaSignInOutput | undefined = undefined,
        public wallet: string | undefined = undefined
    ) { }
    private static instance: MemoryStoredTokenSiws;
    static getInstance(): MemoryStoredTokenSiws {
        if (!MemoryStoredTokenSiws.instance) {
            MemoryStoredTokenSiws.instance = new MemoryStoredTokenSiws();
        }
        return MemoryStoredTokenSiws.instance;
    }
    public setAuth(input: SolanaSignInInput, output: SolanaSignInOutput, wallet: string) {
        this.input = input;
        this.output = output;
        this.wallet = wallet;
    }
}