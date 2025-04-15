import { useEffect, useState } from 'react';
import { genSignIn, MemoryStoredTokenGen } from '../lib/auth/general';
import { MemoryStoredTokenSiws, siwsSignIn } from '../lib/auth/siws';
import b58 from 'bs58';
import '../styles.css';
import { SolanaSignInInput } from '@solana/wallet-standard-features';
import { createSignInMessageText } from '../lib/createsSignInMessageText';      // its coming in handy right here
import { useSiwsSupport } from '../components/SiwsSupportProvider';

interface ConnectedDetails {
    walletAddress: string,
    status: 'Signed In' | 'Not Signed In',
    details: string,            // the details of the connected wallet  in ABNF format
}

export default function Home() {
    const [connectedDetails, setConnectedDetails] = useState<ConnectedDetails | undefined>(undefined);
    useEffect(() => {
        let memoryStoredToken = MemoryStoredTokenGen.getInstance().token;
        let memoryStoredInput = MemoryStoredTokenSiws.getInstance().input;
        if (memoryStoredToken) {
            const [pk, msg] = memoryStoredToken.split(".");
            // check out the expiration time for the token
            // if it has expired we request the user to sign in again
            const contents = JSON.parse(
                new TextDecoder().decode(b58.decode(msg))
            ) as SolanaSignInInput;
            setConnectedDetails({
                walletAddress: pk,
                status: 'Signed In',
                details: createSignInMessageText(contents)
            })
        }
        if (memoryStoredInput) {
            // just store and display it now
            if (memoryStoredInput.address)
                setConnectedDetails({
                    walletAddress: memoryStoredInput.address,
                    status: 'Signed In',
                    details: createSignInMessageText(memoryStoredInput)
                })
        }
    });

    const handleConnect = () => {
        const { siwsSupport } = useSiwsSupport();
        if (siwsSupport) {
            siwsSignIn();
        }
        else {
            genSignIn();
        }
    };

    return (
        <>
            <div className="home-container">
                <button className="connect-button" onClick={handleConnect}>
                    Sign In
                </button>

                <div className="display-board">
                    {connectedDetails ? (
                        <div>
                            <p><strong>Wallet Address:</strong> {connectedDetails.walletAddress}</p>
                            <p><strong>Status:</strong> {connectedDetails.status}</p>
                            <p>Details{connectedDetails.details}</p>
                        </div>
                    ) : (
                        <p>No wallet connected. Click "Sign In" to proceed.</p>
                    )}
                </div>
            </div>
        </>
    );
}
