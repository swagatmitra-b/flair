from typing import Dict, Any
from .utils import _client_with_auth  # Import the shared helper

## NOTE: the copilot is repeatedly suggesting this artifcats file,have to look into it

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
