"""
Commit commands: delta and checkpoint creation, listing and viewing commits.

Design notes:
- Artifacts are uploaded to the storage provider (Pinata) and only encrypted blobs are uploaded when encryption is requested.
- Each artifact uses a random DEK AES-256-GCM; the DEK may be encrypted with the RMK (provided via --rmk-b64 for CLI operations).
- In production, RMK decryption/encryption per-wallet should be handled securely (this CLI accepts an RMK for encryption operations to be scriptable).
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json
import base64

from ..core import storage as core_storage
from ..core import crypto
from ..api import client as api_client

app = typer.Typer()
console = Console()


def _upload_and_register(file_path: Path, encrypt: bool, rmk_b64: str | None):
    if not file_path.exists():
        raise FileNotFoundError("artifact file not found")
    data = file_path.read_bytes()
    storage = core_storage.PinataStorage()

    if encrypt:
        dek = crypto.generate_dek()
        enc_data = crypto.aes_encrypt(data, dek)
        if rmk_b64 is None:
            raise ValueError("encrypt requested but --rmk-b64 not provided")
        rmk = base64.b64decode(rmk_b64)
        enc_dek = crypto.encrypt_dek_with_rmk(dek, rmk)
        enc_dek_b64 = crypto.b64_encode(enc_dek)
        ref = storage.put(enc_data, filename=file_path.name)
        return ref, enc_dek_b64
    else:
        ref = storage.put(data, filename=file_path.name)
        return ref, None


@app.command("delta")
def commit_delta(repo: str = typer.Option(..., "--repo", help="Repository ID"),
                 file: Path = typer.Option(..., "--file", help="Delta artifact file to upload"),
                 metadata: str = typer.Option(None, "--metadata", help="JSON metadata (framework, round, metrics)"),
                 zkml_proof_ref: str = typer.Option(None, "--zkml", help="Optional zkML proof reference"),
                 encrypt: bool = typer.Option(False, "--encrypt", help="Encrypt artifact before upload"),
                 rmk_b64: str = typer.Option(None, help="RMK (base64) to encrypt DEK with when encrypting")):
    """Create a delta commit by uploading and registering an artifact, then creating a commit record."""
    try:
        ref, enc_dek_b64 = _upload_and_register(file, encrypt, rmk_b64)
        payload = {
            "repo_id": repo,
            "commit_type": "delta",
            "artifact_ref": {"provider": ref.provider, "ref": ref.ref},
            "metadata": json.loads(metadata) if metadata else {},
        }
        if enc_dek_b64:
            payload["encrypted_dek_b64"] = enc_dek_b64
        if zkml_proof_ref:
            payload["zkml_proof_ref"] = zkml_proof_ref

        commit = api_client.create_commit(payload)
        console.print("Commit created:")
        console.print(commit)
    except Exception as e:
        console.print(f"Failed to create delta commit: {e}", style="bold red")
        raise typer.Exit(code=1)


@app.command("checkpoint")
def commit_checkpoint(repo: str = typer.Option(..., "--repo", help="Repository ID"),
                      file: Path = typer.Option(..., "--file", help="Checkpoint artifact file to upload"),
                      metadata: str = typer.Option(None, "--metadata", help="JSON metadata (framework, round, metrics)"),
                      zkml_proof_ref: str = typer.Option(None, "--zkml", help="Optional zkML proof reference"),
                      encrypt: bool = typer.Option(False, "--encrypt", help="Encrypt artifact before upload"),
                      rmk_b64: str = typer.Option(None, help="RMK (base64) to encrypt DEK with when encrypting")):
    """Create a checkpoint commit."""
    try:
        ref, enc_dek_b64 = _upload_and_register(file, encrypt, rmk_b64)
        payload = {
            "repo_id": repo,
            "commit_type": "checkpoint",
            "artifact_ref": {"provider": ref.provider, "ref": ref.ref},
            "metadata": json.loads(metadata) if metadata else {},
        }
        if enc_dek_b64:
            payload["encrypted_dek_b64"] = enc_dek_b64
        if zkml_proof_ref:
            payload["zkml_proof_ref"] = zkml_proof_ref

        commit = api_client.create_commit(payload)
        console.print("Checkpoint commit created:")
        console.print(commit)
    except Exception as e:
        console.print(f"Failed to create checkpoint commit: {e}", style="bold red")
        raise typer.Exit(code=1)


@app.command("list")
def list_commits(repo: str = typer.Option(..., "--repo", help="Repository ID")):
    """List commits for a repository."""
    try:
        commits = api_client.list_commits(repo)
        console.print(commits)
    except Exception as e:
        console.print(f"Failed to list commits: {e}", style="bold red")
        raise typer.Exit(code=1)


@app.command("view")
def view_commit(repo: str = typer.Option(..., "--repo", help="Repository ID"),
               commit_hash: str = typer.Argument(..., help="Commit hash")):
    """View a specific commit."""
    try:
        c = api_client.get_commit(repo, commit_hash)
        console.print(c)
    except Exception as e:
        console.print(f"Failed to get commit: {e}", style="bold red")
        raise typer.Exit(code=1)