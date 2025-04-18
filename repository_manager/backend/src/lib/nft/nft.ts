// Nft minter and fetcher for Flair
// Debashish Buragohain

import { none, percentAmount, publicKey, Umi } from "@metaplex-foundation/umi";
import { createNft, Metadata } from "@metaplex-foundation/mpl-token-metadata";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { findLeafAssetIdPda,
    mintV1,
    parseLeafFromMintV1Transaction
 } from "@metaplex-foundation/mpl-bubblegum";
 import { NftMetadata, CreateInstructions, CompletedCreateInstructions } from "./types";
 import { generateSigner } from "@metaplex-foundation/umi";
 import { DasApiAsset, GetAssetProofRpcResponse } from "@metaplex-foundation/digital-asset-standard-api";
 import { getCurrentTree, updateCurrentTree } from "./tree";

// Not for production
// creates the NFT and returns the deserialized signature
export async function mintNft(umi: Umi, createIns: CreateInstructions, metadata: NftMetadata): Promise<string> {
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
    // return the signature and the public key of the nft created just now
    return base58.deserialize(tx.signature)[0], nftSigner.publicKey.toString();
}

// mint the cNFT provided the metadata and return the signature of the transaction
// we need the signature every time we fetch the Nft asset
export const mintCNft = async (umi: Umi, owner: string, metadata: Metadata): Promise<string> => {
    if (!umi.identity) {
        throw new Error('Crticial Error: Wallet not connected. Cannot mint cNft.');
    }
    const metadataUri = await umi.uploader.uploadJson(metadata)
        .catch(err => { throw new Error('Error uploading metadata: ' + err) });

    const leafOwner = publicKey(owner);
    // fetch the current merkle tree address from the backend
    const merkleTreeAdress = await getCurrentTree();
    const merkleTree = publicKey(merkleTreeAdress);

    // for the compressed Nfts we do not need to generate a separate keypair for the account
    // the cnft is non transferreable therefore there is no leaf delegate property defined here
    const { signature } = await mintV1(umi, {
        leafOwner,
        merkleTree,
        metadata: {
            name: metadata.name,    // the name of the Nft as specified in the metadata
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            creators: [{
                address: umi.identity.publicKey,
                verified: true,
                share: 0
            }],
            collection: none()
        },        
    }).sendAndConfirm(umi, { send: { commitment: 'finalized' } });
    // update the current merkle tree
    await updateCurrentTree();

    // fetch the asset from the merkle tree and return it
    const leaf = await parseLeafFromMintV1Transaction(umi, signature);
    const [assetId, bump] = findLeafAssetIdPda(umi, {
        merkleTree: merkleTree,
        leafIndex: leaf.nonce,
    });
    // return the asset id, the text signature and the address of the uploaded merkle tree
    return assetId.toString(), base58.deserialize(signature)[0], merkleTreeAdress;
}

// the type of the fetched Nft
export type FectchedCNft = {
    asset: DasApiAsset;
    rpcAssetProof: GetAssetProofRpcResponse;
}

// fetch the cnft from its asset id
export async function fetchCnft(umi: Umi, assetId: string): Promise<FectchedCNft> {
    const assetIdPub = publicKey(assetId);
    const asset = await umi.rpc.getAsset(assetIdPub);
    const rpcAssetProof = await umi.rpc.getAssetProof(assetIdPub);
    return { asset, rpcAssetProof };
}

// fetch the nft by using its signature and its merkle tree
export async function fetchCNftFromSignature(umi: Umi, merkleTree: string, signature: string): Promise<FectchedCNft> {
    if (!umi.rpc) {
        throw new Error('Critical error: No rpc connected to fetch cNft data.');
    }
    const serialzed = base58.serialize(signature);
    const leaf = await parseLeafFromMintV1Transaction(umi, serialzed);
    const [assetId, bump] = findLeafAssetIdPda(umi, {
        merkleTree: publicKey(merkleTree),
        leafIndex: leaf.nonce,
    });
    const asset = await umi.rpc.getAsset(assetId);
    // fetch the proof of the aset
    const rpcAssetProof = await umi.rpc.getAssetProof(assetId);
    return { asset, rpcAssetProof };
}


export async function createCollection(umi: Umi) {

}