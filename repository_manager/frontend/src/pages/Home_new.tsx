import { useEffect, useState } from 'react';
import { genSignIn, MemoryStoredTokenGen } from '../lib/auth/general';
import { MemoryStoredTokenSiws, siwsSignIn } from '../lib/auth/siws';
import b58 from 'bs58';
import '../styles.css';
import { SolanaSignInInput } from '@solana/wallet-standard-features';
import { createSignInMessageText } from '../lib/createsSignInMessageText';
import { useSiwsSupport } from '../components/SiwsSupportProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface ConnectedDetails {
  walletAddress: string;
  status: 'Signed In' | 'Not Signed In';
  details: string;
}

export default function Home() {
  const [connectedDetails, setConnectedDetails] = useState<ConnectedDetails | undefined>(undefined);
  const { siwsSupport } = useSiwsSupport();
  const { publicKey, signMessage, signIn } = useWallet();

  // On mount, load any stored token details
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

  // When publicKey updates, trigger sign-in logic automatically
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

  return (
    <div className="home-container">
      {/* WalletMultiButton triggers the wallet modal for selection */}
      <WalletMultiButton />

      <div className="display-board">
        {publicKey ? (
          <div>
            <p><strong>Wallet Address:</strong> {publicKey.toBase58()}</p>
            <p><strong>Status:</strong> Signed In</p>
            {connectedDetails && (
              <p>Details: {connectedDetails.details}</p>
            )}
          </div>
        ) : (
          <p>No wallet connected. Click the button above to connect.</p>
        )}
      </div>
    </div>
  );
}
