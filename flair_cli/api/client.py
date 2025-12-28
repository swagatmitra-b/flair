"""
Centralized API client for interacting with the Flair REST backend.

Design notes:
- No URLs are hardcoded; base URL is read from config or environment variable FLAIR_API_BASE.
- All requests accept an optional bearer token for authenticated endpoints.
- Client methods map to API endpoints described in the spec: repo creation, commit creation, artifact registration, commit listing, commit retrieval, auth verification.
"""
from typing import Optional, Dict, Any
import httpx
from ..core.config import config
from ..core.session import load_session


def _base_url() -> str:
    # prefer env var FLAIR_API_BASE, then config
    return (  
        __import__("os").environ.get("FLAIR_API_BASE") or config.api_base_url or "http://localhost:8080"
    )


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