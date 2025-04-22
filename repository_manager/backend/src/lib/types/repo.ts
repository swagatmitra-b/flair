// Type declarations for the repository schema
// Debashish Buragohain

export interface RepositoryMetdata {
    name: string,       // name of the repository
    description: string | undefined,
    useCase: string | undefined,
    creator: string,    // wallet address that has created the Repository
    framework: 'PyTorch' | 'TensorFlow',
    modelUri: string | undefined // file uri of the original model, on which the parameters will be applied    
}

// all fields are required for creating a collection Nft of a repository
export interface RepositoryMetadataWithAllRequiredFields {
    name: string,       // name of the repository
    description: string,
    useCase: string,
    creator: string,    // wallet address that has created the Repository
    framework: 'PyTorch' | 'TensorFlow',
    modelUri: string // file uri of the original model, on which the parameters will be applied    
}

// the metadata for the repository as an Nft collection
export interface RepositoryNftCollectionMetadata extends RepositoryMetadataWithAllRequiredFields {
    owner: string;     
    createdAt: string;  // ISO string of the repository's creation
    baseModelHash: string;
    baseModelUri: string;
}

export type CommittedBy = 'USER' | 'SYSTEM';