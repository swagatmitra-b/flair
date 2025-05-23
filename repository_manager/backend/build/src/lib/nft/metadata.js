// metadata generator for commit and repository Nfts
// Debashish Buragohain
import { prisma } from "../prisma/index.js";
import { constructIPFSUrl } from "../../routes/basemodel.js";
// function to create the metadata of the commit Nft
export const createCommitMetadata = async (commit) => {
    const metadata = {};
    metadata.commitHash = commit.commitHash;
    const branch = await prisma.branch.findUnique({ where: { id: commit.branchId } });
    if (!branch) {
        throw new Error("Commit's branch does not exist.");
    }
    metadata.branchName = branch.name;
    metadata.branchHash = branch.branchHash;
    const repo = await prisma.repository.findUnique({ where: { id: branch.repositoryId } });
    if (!repo) {
        throw new Error("Commit's repository does not exist.");
    }
    metadata.repositoryHash = repo.repoHash;
    metadata.repositoryName = repo.name;
    metadata.repositoryOwner = repo.ownerAddress;
    if (!repo.baseModelHash) {
        throw new Error("Commit's base model does not exist.");
    }
    metadata.baseModelHash = repo.baseModelHash;
    if (commit.status == 'MERGERCOMMIT') {
        throw new Error('Commit is a merger commit, and cannot be converted into an Nft.');
    }
    metadata.status = commit.status;
    metadata.committer = commit.committerAddress;
    metadata.paramHash = commit.paramHash;
    metadata.message = commit.message;
    // if (commit.status == 'REJECTED') {
    //     if (!commit.rejectedMessage) {
    //         throw new Error('Rejection message not present in rejected commit.');
    //     }
    //     metadata.messageIfRejected = commit.rejectedMessage;
    // }
    metadata.createdAt = commit.createdAt.toISOString();
    metadata.localMetrics = parseMetrics(commit.metrics);
    return metadata;
};
// parse the metric values
export function parseMetrics(metric) {
    // Ensure metric is a valid object
    if (typeof metric !== "object" || metric === null || Array.isArray(metric)) {
        throw new Error("Invalid commit metrics: Expected an object.");
    }
    const { accuracy, loss } = metric;
    if (!accuracy) {
        throw new Error('Accuracy not present in commit metric.');
    }
    if (!loss) {
        throw new Error('Loss not present in commit metric.');
    }
    return { accuracy, loss };
}
// create the metadata for uploading in the collection
export const createRepositoryMetadata = async (repo) => {
    const metadata = {};
    const { name, description, useCase, creator, framework } = parseRepoMetadata(repo.metadata);
    metadata.name = name;
    metadata.description = description;
    metadata.useCase = useCase;
    metadata.creator = creator;
    metadata.framework = framework;
    metadata.createdAt = repo.createdAt.toISOString();
    metadata.owner = repo.ownerAddress;
    const { baseModelHash } = repo;
    if (!baseModelHash) {
        throw new Error('base model hash is a required field.');
    }
    metadata.baseModelHash = baseModelHash;
    metadata.baseModelUri = constructIPFSUrl(baseModelHash); // in the latest version we calculate the url dynamically
    return metadata;
};
// we cannot have undefined fields the metadata of the nft
export function parseRepoMetadata(repoMetadata) {
    if (typeof repoMetadata !== "object" || repoMetadata === null || Array.isArray(repoMetadata)) {
        throw new Error("Invalid commit metrics: Expected an object.");
    }
    const { name, description, useCase, creator, framework } = repoMetadata;
    if (!name || !description || !useCase || !creator || !framework) {
        throw new Error("Missing required repository metadata fields.");
    }
    return { name, description, useCase, creator, framework };
}
