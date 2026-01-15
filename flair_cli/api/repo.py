from typing import Dict, Any
from .utils import _client_with_auth  # Import the shared helper

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