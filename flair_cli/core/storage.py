"""
DEPRECATED: Storage provider abstraction.

This module is no longer used by the CLI. Flair is designed for complete transparency,
with all artifact management handled by the backend repository manager via HTTP endpoints.

No client-side storage adapters (Pinata IPFS or otherwise) are used.

Note: This module is kept for reference only and should not be imported by CLI commands.

Legacy design notes:
- Used StorageProvider interface with put/get/exists methods
- Pinata IPFS was the default provider
- API credentials were taken from config or environment
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol

PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"
PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs"


@dataclass
class StorageRef:
    """DEPRECATED: Storage reference. Not used in current architecture."""
    provider: str
    ref: str


class StorageProvider(Protocol):
    """DEPRECATED: Storage provider protocol. Not used in current architecture."""
    def put(self, data: bytes, filename: str = "artifact.bin") -> StorageRef:
        ...

    def get(self, ref: StorageRef) -> bytes:
        ...

    def exists(self, ref: StorageRef) -> bool:
        ...


class PinataStorage:
    """DEPRECATED: Pinata IPFS storage. Not used in current architecture."""
    def __init__(self, api_key: str | None = None, api_secret: str | None = None):
        self.api_key = api_key
        self.api_secret = api_secret
        if not self.api_key or not self.api_secret:
            raise RuntimeError("Pinata credentials not configured (PINATA_API_KEY / PINATA_API_SECRET)")

    def put(self, data: bytes, filename: str = "artifact.bin") -> StorageRef:
        # Pinata expects a multipart file upload. We stream the bytes as a file.
        files = {"file": (filename, data, "application/octet-stream")}
        headers = {"pinata_api_key": self.api_key, "pinata_secret_api_key": self.api_secret}
        with httpx.Client(timeout=60) as client:
            r = client.post(PINATA_PIN_FILE_URL, files=files, headers=headers)
            r.raise_for_status()
            j = r.json()
            ipfs_hash = j.get("IpfsHash")
            return StorageRef(provider="pinata", ref=ipfs_hash)

    def get(self, ref: StorageRef) -> bytes:
        if ref.provider != "pinata":
            raise ValueError("PinataStorage can only get pinata refs")
        url = f"{PINATA_GATEWAY}/{ref.ref}"
        with httpx.Client(timeout=60) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.content

    def exists(self, ref: StorageRef) -> bool:
        try:
            self.get(ref)
            return True
        except Exception:
            return False