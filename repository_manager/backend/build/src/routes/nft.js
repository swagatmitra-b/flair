// the nft creation route for Flair
// Debashish Buragohain
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createGenericFile, generateSigner, percentAmount, signerIdentity, sol } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { base58 } from '@metaplex-foundation/umi/serializers';
import fs from 'fs';
import path from 'path';
// Create the wrapper function
const create = async () => {
    const umi = createUmi('https://api.devnet.solana.com')
        .use(mplTokenMetadata())
        .use(
    // irys uploader uploads images to the Arweave blockchain
    irysUploader({
        address: "https://devnet.irys.xyz",
    }));
    // Create a new keypair signer
    const signer = generateSigner(umi);
    umi.use(signerIdentity(signer));
    // Airdrop SOL on devnet for testing
    await umi.rpc.airdrop(umi.identity.publicKey, sol(1));
    const imageFile = fs.readFileSync(path.join(__dirname, '/assets/image.jpg'));
    // Transform the file into a `GenericFile` type
    const umiImageFile = createGenericFile(imageFile, 'image.jpeg', {
        tags: [{ name: 'Content-Type', value: 'image/jpeg' }],
    });
    // Upload the image to Arweave via Irys and get the URI
    const imageUri = await umi.uploader.upload([umiImageFile])
        .catch((err) => { throw new Error(err.message); });
    console.log(imageUri[0]);
    // Create metadata for the NFT
    const metadata = {
        name: 'My NFT',
        description: 'This is an NFT on Solana',
        image: imageUri[0],
        external_url: "https://example.com/my-nft.json",
        attributes: [
            { trait_type: "trait1", value: "value1" },
            { trait_type: "trait2", value: "value2" },
        ],
        properties: {
            files: [{ uri: imageUri[0], type: "image/png" }],
            category: "image",
        },
    };
    const metadataUri = await umi.uploader.uploadJson(metadata)
        .catch((err) => { throw new Error(err.message); });
    // Create a general NFT
    const nftSigner = generateSigner(umi);
    const tx = await createNft(umi, {
        mint: nftSigner,
        sellerFeeBasisPoints: percentAmount(5.5),
        name: 'myNFT',
        uri: metadataUri,
    }).sendAndConfirm(umi);
    // Deserialize the signature to check on-chain
    console.log(base58.deserialize(tx.signature)[0]);
    /**
     * For Programmable NFT
     * Uncomment the following section for programmable NFT creation:
     */
    /*
    const programmableNftSigner = generateSigner(umi);
    const ruleset = null; // Replace with a public key if needed
    const programmableTx = await createProgrammableNft(umi, {
        mint: programmableNftSigner,
        sellerFeeBasisPoints: percentAmount(5.5),
        name: 'My NFT',
        uri: metadataUri,
        ruleSet: ruleset,
    }).sendAndConfirm(umi);

    console.log(base58.deserialize(programmableTx.signature)[0]);
    */
};
create().catch((err) => console.error(err));
