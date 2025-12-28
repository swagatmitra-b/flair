"""
Repository management commands.
Supports creating public/private repos and optional base model upload.
"""
from __future__ import annotations
import typer
from rich.console import Console
from rich.table import Table
from pathlib import Path
import base64

from ..api import client as api_client
from ..core import storage as core_storage
from ..core import crypto
from ..core.config import load_config

app = typer.Typer()
console = Console()


@app.command("create")
def create(name: str = typer.Option(..., help="Repository name"),
           description: str = typer.Option(None, help="Short description"),
           private: bool = typer.Option(False, "--private", help="Create a private (encrypted) repo"),
           base_model: Path = typer.Option(None, help="Path to base model file to upload"),
           wallet_pubkey: str = typer.Option(None, help="Optional wallet public key (base58) to encrypt RMK for)")):
    """Create a repository. If private, the base model (if provided) will be encrypted.

    NOTE: For private repos, the RMK is generated locally and should be encrypted for the owner's wallet.
    The CLI does not store private keys; it only stores encrypted material and metadata.
    """
    cfg = load_config()

    base_ref = None
    encrypted_dek_b64 = None
    encrypted_rmk_for_wallet_b64 = None

    if base_model:
        if not base_model.exists():
            console.print("Base model file not found", style="bold red")
            raise typer.Exit(code=1)
        data = base_model.read_bytes()
        if private:
            # Generate keys
            dek = crypto.generate_dek()
            rmk = crypto.generate_rmk()
            # Encrypt artifact with DEK
            enc_data = crypto.aes_encrypt(data, dek)
            # Encrypt DEK with RMK
            enc_dek = crypto.encrypt_dek_with_rmk(dek, rmk)
            encrypted_dek_b64 = crypto.b64_encode(enc_dek)
            # Encrypt RMK for provided wallet public key if available
            if wallet_pubkey:
                # wallet_pubkey expected as base58; we'll decode with base58 if library present, otherwise expect raw hex/base64
                try:
                    # attempt base64 first
                    pk_bytes = base64.b64decode(wallet_pubkey)
                except Exception:
                    pk_bytes = wallet_pubkey.encode("utf-8")
                enc_rmk = crypto.encrypt_rmk_for_wallet(rmk, pk_bytes)
                encrypted_rmk_for_wallet_b64 = crypto.b64_encode(enc_rmk)
            # Upload encrypted artifact to Pinata
            storage = core_storage.PinataStorage()
            ref = storage.put(enc_data, filename=base_model.name)
            base_ref = ref.ref
        else:
            # Public repo: upload plaintext artifact (Flair mandates never store plaintext on disk after upload)
            storage = core_storage.PinataStorage()
            ref = storage.put(data, filename=base_model.name)
            base_ref = ref.ref

    payload = {
        "name": name,
        "description": description,
        "is_private": private,
        "base_model_ref": base_ref,
    }
    # include encryption metadata for backend
    if encrypted_dek_b64:
        payload["encrypted_dek_b64"] = encrypted_dek_b64
    if encrypted_rmk_for_wallet_b64:
        payload["encrypted_rmk_for_wallet_b64"] = encrypted_rmk_for_wallet_b64

    try:
        resp = api_client.create_repo(payload)
        console.print("Repository created:", style="green")
        console.print(resp)
    except Exception as e:
        console.print(f"Failed to create repo: {e}", style="bold red")
        raise typer.Exit(code=1)


@app.command("list")
def list_repos():
    """List repositories."""
    try:
        resp = api_client.list_repos()
        table = Table(title="Repositories")
        table.add_column("ID")
        table.add_column("Name")
        table.add_column("Private")
        table.add_column("Owner")
        for r in resp.get("repos", []):
            table.add_row(r.get("id"), r.get("name"), str(r.get("is_private")), r.get("owner"))
        console.print(table)
    except Exception as e:
        console.print(f"Error listing repos: {e}", style="bold red")
        raise typer.Exit(code=1)


@app.command("view")
def view(repo_id: str = typer.Argument(..., help="Repository ID")):
    """View repository details."""
    try:
        r = api_client.get_repo(repo_id)
        console.print(r)
    except Exception as e:
        console.print(f"Error fetching repo: {e}", style="bold red")
        raise typer.Exit(code=1)