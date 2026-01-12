"""
Centralized API client for interacting with the Flair REST backend.

Design notes:
- No URLs are hardcoded; base URL is read from config or environment variable FLAIR_API_BASE.
- All requests accept an optional bearer token for authenticated endpoints.
- Client methods map to API endpoints described in the spec: repo creation, commit creation, artifact registration, commit listing, commit retrieval, auth verification.
"""
from typing import Optional, Dict, Any
import httpx
from ..core.config import load_config
from ..core.session import load_session


_cfg = load_config()


def _base_url() -> str:
    """Resolve API base URL from env or config."""
    return __import__("os").environ.get("FLAIR_API_BASE") or _cfg.api_base_url or "http://localhost:2112"


def _client_with_auth() -> httpx.Client:
    headers = {}
    session = load_session()
    if session and session.token:
        headers["Authorization"] = f"Bearer {session.token}"
    return httpx.Client(base_url=_base_url(), headers=headers, timeout=30)


def verify_auth(wallet_address: str, siws_message: str, signature: str) -> Dict[str, Any]:
    """Send SIWS login verification to backend; backend should verify signature and return a token."""
    with httpx.Client(base_url=_base_url(), timeout=30) as client:
        r = client.post("/auth/siws", json={"address": wallet_address, "message": siws_message, "signature": signature})
        r.raise_for_status()
        return r.json()


def create_repo(payload: Dict[str, Any]) -> Dict[str, Any]:
    with _client_with_auth() as client:
        r = client.post("/repos", json=payload)
        r.raise_for_status()
        return r.json()


def list_repos() -> Dict[str, Any]:
    with _client_with_auth() as client:
        r = client.get("/repos")
        r.raise_for_status()
        return r.json()


def get_repo(repo_id: str) -> Dict[str, Any]:
    with _client_with_auth() as client:
        r = client.get(f"/repos/{repo_id}")
        r.raise_for_status()
        return r.json()


def clone_repository(repo_identifier: str) -> Dict[str, Any]:
    """Clone a repository: fetch repo + branches + latest commits.
    
    Args:
        repo_identifier: Repository hash, or "owner/name" format
    
    Returns:
        Clone data with repo info, branches, and latest commits
    """
    with _client_with_auth() as client:
        # If identifier contains '/', treat as owner/name
        if "/" in repo_identifier:
            owner, name = repo_identifier.split("/", 1)
            r = client.get(f"/repo/owner/{owner}/name/{name}")
            repo_data = r.json().get("data", {})
            repo_hash = repo_data.get("repoHash")
            if not repo_hash:
                raise ValueError("Could not determine repository hash from owner/name")
            r = client.get(f"/repo/hash/{repo_hash}/clone")
        else:
            # Assume it's a hash
            r = client.get(f"/repo/hash/{repo_identifier}/clone")
        
        r.raise_for_status()
        return r.json().get("data", {})


def create_commit(payload: Dict[str, Any]) -> Dict[str, Any]:
    with _client_with_auth() as client:
        r = client.post("/commits", json=payload)
        r.raise_for_status()
        return r.json()


def list_commits(repo_id: str) -> Dict[str, Any]:
    with _client_with_auth() as client:
        r = client.get(f"/repos/{repo_id}/commits")
        r.raise_for_status()
        return r.json()


def get_commit(repo_id: str, commit_hash: str) -> Dict[str, Any]:
    with _client_with_auth() as client:
        r = client.get(f"/repos/{repo_id}/commits/{commit_hash}")
        r.raise_for_status()
        return r.json()


def register_artifact(payload: Dict[str, Any]) -> Dict[str, Any]:
    with _client_with_auth() as client:
        r = client.post("/artifacts", json=payload)
        r.raise_for_status()
        return r.json()


def download_artifact(artifact_ref: Dict[str, Any]) -> bytes:
    """Download an artifact by reference. Returns raw binary data."""
    with _client_with_auth() as client:
        # artifact_ref should contain provider and ref info
        # For now, assume the backend has an endpoint like /artifacts/{artifact_id}
        # This may need adjustment based on actual backend API
        artifact_id = artifact_ref.get("ref") or artifact_ref.get("id")
        r = client.get(f"/artifacts/{artifact_id}")
        r.raise_for_status()
        return r.content