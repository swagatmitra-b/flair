// frontend for SIWS authentication
// Debashish Buragohain

import { FC, useCallback, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection
} from "@solana/wallet-adapter-react";
import { Adapter, WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
// this includes a walletModal component that allows users to select a wallet from a list of available and installed wallets
// and manages the state of the connected wallet and if it is currently selected
import { clusterApiUrl } from "@solana/web3.js";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "react-query";
import "@solana/wallet-adapter-react-ui/styles.css";

import { AutoConnectProvider } from './components/AutoConnectProvider';
import { siwsSignIn } from "./lib/auth/siws";
import { useSiwsSupport, SiwsSupportProvider } from "./components/SiwsSupportProvider";

// Umi support has been removed
// import { UmiProvider } from "./components/UmiProvider";
import { AdapterProvider, useAdapter } from "./components/AdapterProvider";
// import { genSignIn } from './lib/auth/general';
// import { TLog } from './types';

// pages
import Home from './pages/Home_Original';

const queryClient = new QueryClient();

export const App: FC = () => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter()
    ],
    [network]
  );

  // if the wallet supports sign in then we ask them to sign into it
  // if not supported or sign in failed, the auto connect feature of the wallet is triggered
  // the autoConnect is the legacy sign + message workflow
  // const autoSignIn = useCallback(async (adapter: Adapter) => {
  //   const { setSiwsSupport } = useSiwsSupport();
  //   const { setAdapter } = useAdapter();    
  //   const {signIn}  = useWallet();
  //   setAdapter(adapter);      // save the adapter in the context
  //   if (!('signIn' in adapter)) {
  //     setSiwsSupport(true);   // the wallet supports siws
  //     return true;
  //   }
  //   // the entire sign in function has been sent to the utility program
  //   return await siwsSignIn(signIn, adapter);
  // }, []);


  // Not specified in the original documentation
  // first try to auto connect.. if it fails then we have to do the sign in
  // wallets that do not have SIWS can connect automatically
  // Phantom wallet since it supports SIWS needs to manually sign the message to be signed in
  // const autoConnect = useCallback(async (adapter: Adapter) => {
  //   adapter.autoConnect().catch(() => {
  //     // call the autoSignIn if the auto connecting to the wallet fails
  //     return autoSignIn(adapter);
  //   });
  //   return false;
  // }, [autoSignIn]);


  const onWalletError = useCallback((error: Error) => {
    console.error(`Error connecting to wallet: ${error}`);
  }, [])

  return (
    <AdapterProvider>
        <SiwsSupportProvider>
          <AutoConnectProvider>
            <QueryClientProvider client={queryClient}>
              <ConnectionProvider endpoint={endpoint}>
                <WalletProvider wallets={wallets}
                  onError={onWalletError}
                  autoConnect={true}>
                  <WalletModalProvider>
                    <Router>
                      <Routes>
                        <Route path='/' element={<Home></Home>}></Route>
                      </Routes>
                    </Router>
                  </WalletModalProvider>
                </WalletProvider>
              </ConnectionProvider>
            </QueryClientProvider>
          </AutoConnectProvider>
        </SiwsSupportProvider>
    </AdapterProvider>
  )
}