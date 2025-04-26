// create the umi instance here
// Debashish Buragohain
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi";
import { Keypair } from "@solana/web3.js";
const rpc = process.env.RPC_URL;
// create the umi instance and export it
const umi = createUmi(rpc)
    .use(mplBubblegum())
    .use(mplTokenMetadata())
    .use(irysUploader({ address: process.env.UPLOADER_URL }))
    .use(dasApi());
const anonymousKeypair = Keypair.generate();
const anonymousPrivateKey = anonymousKeypair.secretKey;
const umiAnonymousKeypair = umi.eddsa.createKeypairFromSecretKey(anonymousPrivateKey);
const keypairSigner = createSignerFromKeypair(umi, umiAnonymousKeypair);
umi.use(signerIdentity(keypairSigner));
// finally export the umi instance that has been instantiated with an anonymous keypair
export { umi };
// set the keypair for the current Umi instance
export const setKeypairSigner = (signer, umi) => {
    umi.use(signerIdentity(signer));
    // perform a synchronous check if we are actually signed in now
    if (umi.identity.publicKey == signer.publicKey) {
        return umi.identity.publicKey;
    }
};
// write a logic to enter the private key into Umi
