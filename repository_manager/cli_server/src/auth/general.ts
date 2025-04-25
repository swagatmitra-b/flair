/**
 * Singleton class for storing a valid signature on-memory.
 */
export class MemoryStoredTokenGen {
    private constructor(
        public token: string | null = null,
        public wallet: string | null = null,
    ) { }
    private static instance: MemoryStoredTokenGen;
    static getInstance(): MemoryStoredTokenGen {
        if (!MemoryStoredTokenGen.instance) {
            MemoryStoredTokenGen.instance = new MemoryStoredTokenGen();
        }
        return MemoryStoredTokenGen.instance;
    }
    public setToken(token: string, wallet: string) {
        this.token = token;
        this.wallet = wallet;
    }
}