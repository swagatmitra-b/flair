from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class RepoCreate(BaseModel):
    name: str
    description: Optional[str]
    is_private: bool = False
    base_model_ref: Optional[str]


class Repo(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_private: bool
    owner: str
    created_at: Optional[str]

class CommitCreate(BaseModel):
    repo_id: str
    commit_type: str  # delta | checkpoint
    artifact_ref: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    zkml_proof_ref: Optional[str]


class Commit(BaseModel):
    hash: str
    repo_id: str
    commit_type: str
    artifact_ref: str
    metadata: Dict[str, Any]
    author: str
    created_at: Optional[str]


class AuthResponse(BaseModel):
    token: str
    expires_at: Optional[str]
    wallet_address: Optional[str]
