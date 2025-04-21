// Nft minter and fetcher for Flair
// Debashish Buragohain

import { generateSigner, percentAmount, PublicKey, publicKey, Umi } from "@metaplex-foundation/umi";
// import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
    findLeafAssetIdPda,
    mintToCollectionV1,
    // mintV1,
    parseLeafFromMintV1Transaction
} from "@metaplex-foundation/mpl-bubblegum";
//  import { NftMetadata, CreateInstructions, CompletedCreateInstructions } from "./types";
//  import { generateSigner } from "@metaplex-foundation/umi";
import { DasApiAsset, GetAssetProofRpcResponse } from "@metaplex-foundation/digital-asset-standard-api";
import { getCurrentTree, updateCurrentTree } from "./tree";
import { CommitNftMetdata } from "../types/commit";
import { prisma } from "../prisma";
import { createCommitMetadata, createRepositoryMetadata } from "./metadata";
import { RepositoryMetdata, RepositoryNftCollectionMetadata } from "../types/repo";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";

// takes a commit and converts it into Nft and returns the asset id
export const convertCommitToNft = async (umi: Umi, commitHash: string): Promise<string> => {
    const commit = await prisma.commit.findUnique({ where: { commitHash }, include: { nft: true } });
    if (!commit) {
        throw new Error("Error creating Nft: Commit does not exist.");
    }
    // secondary check here, the first check is applied in the route itself
    // if the commit is already an nft
    if (commit.nft) {
        throw new Error("Error creating Nft: Commit is already an Nft.");
    }
    const metadata = await createCommitMetadata(commit);
    const repo = await prisma.repository.findUnique({
        where: { repoHash: metadata.repositoryHash },
        include: { collection: true }
    });
    if (!repo) {
        throw new Error('Error creating Nft: No repository exists for the given commit');
    }
    // first check if the repository is an nft collection
    if (!repo.collectionId || !repo.collection || !repo.collection.address) {
        throw new Error('Error creating Nft: Repository for the Nft is not a collection.');
    }
    const nftAsset = await mintCNft(umi, metadata, repo.collection.address);
    return nftAsset.toString();
}


// mint the cNFT provided the metadata and return the signature of the transaction
// we need the signature every time we fetch the Nft asset
export const mintCNft = async (umi: Umi, metadata: CommitNftMetdata, collectionAddress: string): Promise<PublicKey<string>> => {
    if (!umi.identity) {
        throw new Error('Crticial Error: Wallet not connected. Cannot mint cNft.');
    }
    const metadataUri = await umi.uploader.uploadJson(metadata)
        .catch(err => { throw new Error('Error uploading Nft metadata: ' + err) });
    const leafOwner = publicKey(metadata.committer);
    // fetch the current merkle tree address from the backend
    const merkleTreeAdress = await getCurrentTree();
    const merkleTree = publicKey(merkleTreeAdress);

    // for the compressed Nfts we do not need to generate a separate keypair for the account
    // the cNft is non transferreable therefore there is no leaf delegate property defined here

    const collectionMint = publicKey(collectionAddress);
    const { signature } = await mintToCollectionV1(umi, {
        leafOwner,
        merkleTree,
        collectionMint,
        metadata: {
            name: metadata.message,
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            creators: [{
                address: umi.identity.publicKey,
                verified: true,
                share: 0
            }],
            collection: { key: collectionMint, verified: true }
        }
    }).sendAndConfirm(umi, { send: { commitment: 'finalized' } });

    const deserialized = base58.deserialize(signature)[0]
    // fetch the asset from the merkle tree and return it
    const leaf = await parseLeafFromMintV1Transaction(umi, signature);
    const [assetId, bump] = findLeafAssetIdPda(umi, {
        merkleTree: merkleTree,
        leafIndex: leaf.nonce,
    });

    // update the current merkle tree and the database
    await updateCurrentTree(assetId);
    await prisma.nft.create({
        data: {
            assetId,
            signature: deserialized,
            merkleTreeAddress: merkleTree,
            owner: metadata.committer,
            commit: {
                connect: { commitHash: metadata.commitHash }
            },
            collection: {
                connect: { address: collectionAddress }
            }
        }
    });
    // return the asset id, the text signature and the address of the uploaded merkle tree
    return assetId;
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

// convert the repo to a collection and return the address of the collection
export async function convertRepoToCollection(umi: Umi, repoHash: string): Promise<string> {
    const repo = await prisma.repository.findUnique({ where: { repoHash } });
    if (!repo) {
        throw new Error('Repository does not exist to convert to collection.');
    }
    // having a base model is essential to create a collection from a repository
    if (!repo.baseModelHash) {
        throw new Error('Error creating collection: Repository does not contain any base model.')
    }
    const repoMetadata = await createRepositoryMetadata(repo);
    const collectionAddress = await createCollection(umi, repoMetadata);
    return collectionAddress.toString();
}

// function to create a collection for the repository
export async function createCollection(umi: Umi, metadata: RepositoryNftCollectionMetadata): Promise<PublicKey<string>> {
    if (!umi.identity) {
        throw new Error('Crticial Error: Wallet not connected. Cannot create Nft collection.');
    }
    const metadataUri = await umi.uploader.uploadJson(metadata)
        .catch(err => { throw new Error('Error uploading Nft collection metadata: ', err) });
    const collectionSigner = generateSigner(umi);

    const mint = collectionSigner.publicKey;
    const { signature } = await createNft(umi, {
        mint,
        name: metadata.name,
        uri: metadataUri,
        isCollection: true, // main catch for collection
        sellerFeeBasisPoints: percentAmount(0)
    }).sendAndConfirm(umi);

    // update the collection in prisma
    await prisma.collection.create({
        data: {
            address: mint.toString(),
            signature: base58.deserialize(signature)[0],
            privateKey: base58.deserialize(collectionSigner.secretKey)[0],
            owner: metadata.owner,
        }
    });

    return mint;
}   
