"""
Storage provider abstraction and a Pinata implementation.

Design notes:
- The StorageProvider interface matches the requirements: put/get/exists.
- Pinata is the default provider; API credentials are taken from config or environment.
- For production use, ensure credentials are stored securely and rotate PINATA keys frequently.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol
import httpx
import os
from .config import config

PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"
PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs"


@dataclass
class StorageRef:
    provider: str
    ref: str


class StorageProvider(Protocol):
    def put(self, data: bytes, filename: str = "artifact.bin") -> StorageRef:
        ...

    def get(self, ref: StorageRef) -> bytes:
        ...

    def exists(self, ref: StorageRef) -> bool:
        ...


class PinataStorage:
    def __init__(self, api_key: str | None = None, api_secret: str | None = None):
        self.api_key = api_key or os.environ.get("PINATA_API_KEY") or config.pinata_api_key
        self.api_secret = api_secret or os.environ.get("PINATA_API_SECRET") or config.pinata_api_secret
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