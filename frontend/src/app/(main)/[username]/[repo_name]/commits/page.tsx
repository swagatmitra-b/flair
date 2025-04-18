import MergerCommit from '@/components/MergerCommit'
import type { TypeCommit, TypeMergerCommitGroup } from '@/lib/types'

const createMergerCommitGroups = (commits: TypeCommit[]): TypeMergerCommitGroup[] => {
  const groups: TypeMergerCommitGroup[] = []
  let currentGroup: TypeMergerCommitGroup | null = null

  for (const commit of commits) {
    if (commit.status === 'MERGERCOMMIT') {
      if (currentGroup) {
        groups.push(currentGroup)
      }
      currentGroup = { mergerCommit: commit, commits: [] }
    } else if (currentGroup) {
      currentGroup.commits.push(commit)
    }
  }
  groups.push(currentGroup!)

  return groups
}

const Page: React.FC = () => {
  const groups = createMergerCommitGroups(commits.data)
  return (
    <section className="min-h-screen w-full pt-28 px-32 bg-gray-950">
      <div className="flex flex-col items-center justify-center h-full w-full p-4 ">
        {groups.map((group, index) => (
          <MergerCommit
            key={index}
            mergerCommitNo={index + 1}
            mergerCommit={group.mergerCommit}
            commits={group.commits}
          />
        ))}
      </div>
    </section>
  )
}

export default Page

const commits = {
  data: [
    // === MERGER 1 ===
    {
      id: 'm1',
      commitHash: 'hash_m1',
      status: 'MERGERCOMMIT',
      previousMergerCommit: '_GENESIS_',
      message: 'First merger commit',
      createdAt: '2025-04-10T10:00:00Z',
      paramHash: 'phash_m1',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: { accuracy: 0.94, loss: 0.15 },
    },
    {
      id: 'm1_r',
      commitHash: 'hash_m1_r',
      status: 'REJECTED',
      previousMergerCommit: 'hash_m1',
      message: 'Rejected commit for m1',
      createdAt: '2025-04-10T10:10:00Z',
      paramHash: 'phash_m1_r',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: 'did not want to merge',
      statusUpdatedAt: null,
      metrics: { accuracy: 0.92, loss: 0.18 },
    },
    {
      id: 'm1_m',
      commitHash: 'hash_m1_m',
      status: 'MERGED',
      previousMergerCommit: 'hash_m1',
      message: 'Merged commit for m1',
      createdAt: '2025-04-10T10:15:00Z',
      paramHash: 'phash_m1_m',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: true,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: null,
    },

    // === MERGER 2 ===
    {
      id: 'm2',
      commitHash: 'hash_m2',
      status: 'MERGERCOMMIT',
      previousMergerCommit: 'hash_m1',
      message: 'Second merger commit',
      createdAt: '2025-04-11T11:00:00Z',
      paramHash: 'phash_m2',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: { accuracy: 0.96, loss: 0.12 },
    },
    {
      id: 'm2_r',
      commitHash: 'hash_m2_r',
      status: 'REJECTED',
      previousMergerCommit: 'hash_m2',
      message: 'Rejected commit for m2',
      createdAt: '2025-04-11T11:10:00Z',
      paramHash: 'phash_m2_r',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: 'performance drop',
      statusUpdatedAt: null,
      metrics: { accuracy: 0.89, loss: 0.2 },
    },
    {
      id: 'm2_m',
      commitHash: 'hash_m2_m',
      status: 'MERGED',
      previousMergerCommit: 'hash_m2',
      message: 'Merged commit for m2',
      createdAt: '2025-04-11T11:15:00Z',
      paramHash: 'phash_m2_m',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: true,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: null,
    },

    // === MERGER 3 ===
    {
      id: 'm3',
      commitHash: 'hash_m3',
      status: 'MERGERCOMMIT',
      previousMergerCommit: 'hash_m2',
      message: 'Third merger commit',
      createdAt: '2025-04-12T12:00:00Z',
      paramHash: 'phash_m3',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: { accuracy: 0.97, loss: 0.1 },
    },
    {
      id: 'm3_r',
      commitHash: 'hash_m3_r',
      status: 'REJECTED',
      previousMergerCommit: 'hash_m3',
      message: 'Rejected commit for m3',
      createdAt: '2025-04-12T12:05:00Z',
      paramHash: 'phash_m3_r',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: 'minor bug',
      statusUpdatedAt: null,
      metrics: { accuracy: 0.93, loss: 0.13 },
    },
    {
      id: 'm3_m',
      commitHash: 'hash_m3_m',
      status: 'MERGED',
      previousMergerCommit: 'hash_m3',
      message: 'Merged commit for m3',
      createdAt: '2025-04-12T12:10:00Z',
      paramHash: 'phash_m3_m',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: true,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: null,
    },

    // === MERGER 4 ===
    {
      id: 'm4',
      commitHash: 'hash_m4',
      status: 'MERGERCOMMIT',
      previousMergerCommit: 'hash_m3',
      message: 'Fourth merger commit',
      createdAt: '2025-04-13T13:00:00Z',
      paramHash: 'phash_m4',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: { accuracy: 0.98, loss: 0.07 },
    },
    {
      id: 'm4_r',
      commitHash: 'hash_m4_r',
      status: 'REJECTED',
      previousMergerCommit: 'hash_m4',
      message: 'Rejected commit for m4',
      createdAt: '2025-04-13T13:10:00Z',
      paramHash: 'phash_m4_r',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: 'failing test cases',
      statusUpdatedAt: null,
      metrics: { accuracy: 0.9, loss: 0.2 },
    },
    {
      id: 'm4_m',
      commitHash: 'hash_m4_m',
      status: 'MERGED',
      previousMergerCommit: 'hash_m4',
      message: 'Merged commit for m4',
      createdAt: '2025-04-13T13:20:00Z',
      paramHash: 'phash_m4_m',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: true,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: null,
    },
    {
      id: 'm4_p1',
      commitHash: 'hash_m4_p1',
      status: 'PENDING',
      previousMergerCommit: 'hash_m4',
      message: 'Pending commit 1 after m4',
      createdAt: '2025-04-13T13:30:00Z',
      paramHash: 'phash_m4_p1',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: { accuracy: 0.91, loss: 0.14 },
    },
    {
      id: 'm4_p2',
      commitHash: 'hash_m4_p2',
      status: 'PENDING',
      previousMergerCommit: 'hash_m4',
      message: 'Pending commit 2 after m4',
      createdAt: '2025-04-13T13:40:00Z',
      paramHash: 'phash_m4_p2',
      architecture: 'architectureofmodel',
      branchId: 'branch1',
      committerId: 'user1',
      committerAddress: 'addr1',
      isDeleted: false,
      verified: false,
      nftId: null,
      relatedMergerCommit: null,
      rejectedMessage: null,
      statusUpdatedAt: null,
      metrics: { accuracy: 0.92, loss: 0.13 },
    },
  ],
}
