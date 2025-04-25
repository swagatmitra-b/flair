import { useEffect, useState } from 'react';
import { genSignIn, MemoryStoredTokenGen } from '../lib/auth/general';
// import {
//   MemoryStoredTokenSiws,
//   // siwsSignIn 
// } from '../lib/auth/siws';
// import b58 from 'bs58';
import '../styles.css';
// import { SolanaSignInInput } from '@solana/wallet-standard-features';
// import { createSignInMessageText } from '../lib/createsSignInMessageText';
// import { useSiwsSupport } from '../components/SiwsSupportProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface ConnectedDetails {          // details of the connection with the wallet
  walletAddress: string;
  status: 'Signed In' | 'Not Signed In';
  details: string;
}

export default function Home() {
  const [connectedDetails, setConnectedDetails] = useState<ConnectedDetails | undefined>(undefined);
  // const { siwsSupport, setSiwsSupport } = useSiwsSupport();
  const { publicKey, signMessage, signIn } = useWallet();

  // On mount, load any stored token details
  useEffect(() => {
    const memoryStoredToken = MemoryStoredTokenGen.getInstance().token;   // for the general sign in pathway

    // const memoryStoredInput = MemoryStoredTokenSiws.getInstance().input;  // for the siws sign in pathway
    // if we have the general workflow token

    if (memoryStoredToken) {
      console.log('Found an initiated general sign workflow token. Authenticating using it.');
      const [pk] = memoryStoredToken.split(".");
      setConnectedDetails({
        walletAddress: pk,
        status: 'Signed In',
        details: 'Signed in using existing general token.'
      });
    }

    // // if we have the siws workflow token
    // else if (memoryStoredInput && memoryStoredInput.address) {
    //   console.log('Found an siws token. Authenticating using it.')
    //   setConnectedDetails({
    //     walletAddress: memoryStoredInput.address,
    //     status: 'Signed In',
    //     details: 'Signed in using existing siws token.'
    //   });
    // }

  }, []);

  // When publicKey updates, trigger sign-in logic automatically
  useEffect(() => {
    if (!publicKey) return; // No wallet selected yet
    console.log('Wallet selected address:', publicKey.toBase58());
    (async () => {
      try {

        if (signIn && false) {

          // for this version of the code we are not using the sign in with solana method
          // because the general sign in method is working perfectly for all kinds of wallets

          // set the siws support true
          // setSiwsSupport(true);
          // console.log('Wallet supports SIWS. Signing using it.');
          // const siwsSuccess = await siwsSignIn(publicKey, signIn);
          // if (siwsSuccess) console.log('Wallet signed in through siws.')
        }
        else {
          console.log('signing in using general auth workflow.');
          
          // dont sign in again if already sign in
          if (!connectedDetails || connectedDetails?.status == 'Not Signed In') {
            if (!signMessage) {
              console.error('Wallet does not support signMessage.');
              return;
            }
            console.log('Signing using general workflow.');
            await genSignIn(publicKey, signMessage);
            setConnectedDetails({
              walletAddress: publicKey.toBase58(),
              status: 'Signed In',
              details: 'Signed in using general workflow'
            })
          }

        }
      } catch (error) {
        console.error("Error during sign-in:", error);
      }
    })();
  }, [
    publicKey,
    // siwsSupport, 
    // signIn,
    // signMessage
  ]);

  return (
    <div className="home-container">
      {/* WalletMultiButton triggers the wallet modal for selection */}
      <WalletMultiButton />

      <div className="display-board">
        {connectedDetails ? (
          <div>
            <p><strong>Wallet Address:</strong> {connectedDetails?.walletAddress}</p>
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
