// NFT creator program
// Debashish Buragohain

import { Amount, generateSigner, KeypairSigner, percentAmount, Umi } from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { base58 } from "@metaplex-foundation/umi/serializers";

// the metadata that needs to be entered by the user in a form
export interface FormMetadata {
    name: string;               // the display name of the ML model
    description: string;        // description of the model
    use_case: string;           // description of the intended use case
}

// final metadata for the NFTs
export type NftMetadata = {
    creator: string;            // name of the author who has created it
    file_url: string;           // URL to download the model or code
    image_url: string;          // URI of the display image for the model (optional)    
    framework: string;          // framework used to train the model
    contributors: {
        contributor: string;               // public key of the contributor
        contibuted_model_hash: string;     // hash of the parameters that the person contributed
        push_timestamp: number;            // when the person pushed the model
        local_accuracy: number;            // accuracy of the pushed model
        zkml_proof?: string;               // the ZKML proof created for the local model (optional)
    }[]
    model_hash: string;         // latest model parameters hash
};

export interface CreateInstructions {
    name: string;
};

export interface CompletedCreateInstructions extends CreateInstructions {
    mint: KeypairSigner;
    uri: string;
    sellerFeeBasisPoints: Amount<'%', 2>;
}

// creates the NFT and returns the deserialized signature
export async function mint(umi: Umi, createIns: CreateInstructions, metadata: NftMetadata): Promise<string> {
    // for the practicality it is not possible to store the model's parameters in arweave
    // so we just use json and store the hashes only and nothing else
    if (!umi.identity) {
        throw new Error('Wallet not connected. Cannot mint NFT.');
    }
    const metadataUri = await umi.uploader.uploadJson(metadata)
        .catch(err => { throw new Error('Error uploading metadata: ' + err) });
    // creating the mint address for the NFT
    const nftSigner = generateSigner(umi);
    const finalIns: CompletedCreateInstructions = {
        ...createIns,
        mint: nftSigner,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0.0)
    }
    const tx = await createNft(umi, finalIns).sendAndConfirm(umi);
    return base58.deserialize(tx.signature)[0];
}

// get the metadata from the backend using the hash given
export async function getMetadata(modelHash: string) {
    const metadata: NftMetadata = await fetch('').then(r => r.json());
}