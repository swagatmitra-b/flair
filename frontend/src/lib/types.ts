export type TypeCommit = {
  metrics: {
    accuracy: number
    loss: number
  } | null // in one object it was null
  id: string
  commitHash: string
  previousMergerCommit: string
  relatedMergerCommit: string | null
  status: string
  rejectedMessage: string | null
  message: string
  paramHash: string
  createdAt: string
  statusUpdatedAt: string | null
  architecture: string
  branchId: string
  committerAddress: string
  committerId: string
  isDeleted: boolean
  nftId: string | null
  verified: boolean
}

export type TypeMergerCommitGroup = {
  mergerCommit: TypeCommit
  commits: TypeCommit[]
}
