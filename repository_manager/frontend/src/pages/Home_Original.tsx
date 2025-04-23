import { useEffect, useState } from 'react';
import { genSignIn, MemoryStoredTokenGen } from '../lib/auth/general';
import { MemoryStoredTokenSiws, siwsSignIn } from '../lib/auth/siws';
import b58 from 'bs58';
import '../styles.css';
import { SolanaSignInInput } from '@solana/wallet-standard-features';
import { createSignInMessageText } from '../lib/createsSignInMessageText';      // its coming in handy right here
import { useSiwsSupport } from '../components/SiwsSupportProvider';
import { useWallet } from '@solana/wallet-adapter-react';

interface ConnectedDetails {
    walletAddress: string,
    status: 'Signed In' | 'Not Signed In',
    details: string,            // the details of the connected wallet  in ABNF format
}

export default function Home() {

    const [connectedDetails, setConnectedDetails] = useState<ConnectedDetails | undefined>(undefined);
    const { siwsSupport } = useSiwsSupport();
    const { connect, publicKey, signMessage, signIn } = useWallet();

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
                details: createSignInMessageText(contents, 'signin')
            });
        }
        if (memoryStoredInput && memoryStoredInput.address) {
            // just store and display it now
            setConnectedDetails({
                walletAddress: memoryStoredInput.address,
                status: 'Signed In',
                details: createSignInMessageText(memoryStoredInput, 'signin')
            })
        }
        // useEffect dependency array now makes it run only once when the component mounts so that it does not repeatedly update the connected details
    }, []);


    // Trigger wallet connection if not selected, then perform sign-in
    const handleConnect = async () => {
        // if no walet is selected, call connect to trigger the wallet modal
        if (!publicKey) {
            await connect();
        }
        // after connecting, ensure that the wallet is now selected
        if (!publicKey) {
            // this means that the user cancelled their wallet pop up window

            // ! --> may attach additional warnings or errors here to the user
            console.error("No wallet selected after connect.");
            return;
        }

        // if SIWS is supported and the wallet has a signIn method, use it
        if (siwsSupport && signIn) {
            await siwsSignIn(signIn);
        }
        else {
            // signMessage support is mandatory for the general sign in
            if (!signMessage) {
                console.error('Wallet does not support signMessage.');
                return;
            }
            await genSignIn(publicKey, signMessage);
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
