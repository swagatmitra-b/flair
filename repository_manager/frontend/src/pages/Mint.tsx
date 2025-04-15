// The NFT minter page
// Debashish Buragohain

import { useWallet } from "@solana/wallet-adapter-react";
import { FC, useCallback } from "react";
import { useUmi } from "../components/UmiProvider";


const Minter: FC = () => {
    const { wallet } = useWallet();
    const { umi } = useUmi();    
    const onClick = useCallback(async () => {
        if (!wallet || !umi.identity) {
            throw new Error('Wallet not connected to mint NFT.');
        }
    }, []);
    return (<>
    
    </>)
}

export default Minter;