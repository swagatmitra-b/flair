import { useEffect, useState } from 'react';
import { genSignIn, MemoryStoredTokenGen } from '../lib/auth/general';
import { MemoryStoredTokenSiws, siwsSignIn } from '../lib/auth/siws';
import b58 from 'bs58';
import '../styles.css';
import { SolanaSignInInput } from '@solana/wallet-standard-features';
import { createSignInMessageText } from '../lib/createsSignInMessageText';
import { useSiwsSupport } from '../components/SiwsSupportProvider';
import { useWallet } from '@solana/wallet-adapter-react';

interface ConnectedDetails {
  walletAddress: string;
  status: 'Signed In' | 'Not Signed In';
  details: string;
}

export default function Home() {
  const [connectedDetails, setConnectedDetails] = useState<ConnectedDetails | undefined>(undefined);
  const { siwsSupport } = useSiwsSupport();
  const { connect, publicKey, signMessage, signIn } = useWallet();

  // On mount, load any existing token details
  useEffect(() => {
    const memoryStoredToken = MemoryStoredTokenGen.getInstance().token;
    const memoryStoredInput = MemoryStoredTokenSiws.getInstance().input;
    if (memoryStoredToken) {
      const [pk, msg] = memoryStoredToken.split(".");
      const contents = JSON.parse(new TextDecoder().decode(b58.decode(msg))) as SolanaSignInInput;
      setConnectedDetails({
        walletAddress: pk,
        status: 'Signed In',
        details: createSignInMessageText(contents, 'signin')
      });
    } else if (memoryStoredInput && memoryStoredInput.address) {
      setConnectedDetails({
        walletAddress: memoryStoredInput.address,
        status: 'Signed In',
        details: createSignInMessageText(memoryStoredInput, 'signin')
      });
    }
  }, []);

  // When publicKey updates (wallet selected), trigger sign-in logic
  useEffect(() => {
    if (!publicKey) return; // No wallet selected yet
    (async () => {
      try {
        if (siwsSupport && signIn) {
          await siwsSignIn(signIn);
        } else {
          if (!signMessage) {
            console.error('Wallet does not support signMessage.');
            return;
          }
          await genSignIn(publicKey, signMessage);
        }
      } catch (error) {
        console.error("Error during sign-in:", error);
      }
    })();
  }, [publicKey, siwsSupport, signIn, signMessage]);

  // On click, trigger wallet selection modal
  const handleConnect = async () => {
    try {
      await connect();
      // We do not immediately check publicKey here.
      // Instead, the above useEffect will run when publicKey is set.
    } catch (error) {
      console.error("Error connecting to wallet:", error);
    }
  };

  return (
    <div className="home-container">
      <button className="connect-button" onClick={handleConnect}>
        Sign In
      </button>
      <div className="display-board">
        {connectedDetails ? (
          <div>
            <p>
              <strong>Wallet Address:</strong> {connectedDetails.walletAddress}
            </p>
            <p>
              <strong>Status:</strong> {connectedDetails.status}
            </p>
            <p>Details: {connectedDetails.details}</p>
          </div>
        ) : (
          <p>No wallet connected. Click "Sign In" to proceed.</p>
        )}
      </div>
    </div>
  );
}
