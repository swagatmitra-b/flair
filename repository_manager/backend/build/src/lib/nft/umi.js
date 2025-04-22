// create the umi instance here
// Debashish Buragohain
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { signerIdentity } from "@metaplex-foundation/umi";
const rpc = process.env.RPC_URL;
// create the umi instance and export it
export const umi = createUmi(rpc)
    .use(mplBubblegum())
    .use(mplTokenMetadata())
    .use(irysUploader({ address: process.env.UPLOADER_URL }))
    .use(dasApi());
// set the keypair for the current Umi instance
export const setKeypairSigner = (signer, umi) => {
    umi.use(signerIdentity(signer));
};
// write a logic to enter the private key into Umi
