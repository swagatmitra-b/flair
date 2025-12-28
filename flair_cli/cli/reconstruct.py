"""
Reconstruction command.
- Downloads encrypted artifacts
- Decrypts locally (requires RMK or unwrapped DEK)
- Rebuilds model deterministically (this CLI writes the decrypted artifact to an output dir)

Security note: The CLI ensures decrypted artifacts are written only to the provided --out-dir and
it is the user's responsibility to protect the filesystem. Flair never stores private keys.
"""
from __future__ import annotations
import typer
from pathlib import Path
from rich.console import Console
from ..api import client as api_client
from ..core import storage as core_storage
from ..core import crypto
import base64

app = typer.Typer()
console = Console()


@app.command()
def reconstruct(repo: str = typer.Option(..., "--repo", help="Repository ID"),
                commit: str = typer.Option(..., "--commit", help="Commit hash"),
                rmk_b64: str = typer.Option(None, help="RMK (base64) to decrypt DEK with"),
                out_dir: Path = typer.Option(Path("./reconstructed"), help="Output directory to write decrypted artifact")):
    """Reconstruct a commit by downloading and decrypting artifacts."""
    try:
        c = api_client.get_commit(repo, commit)
        artifact = c.get("artifact_ref")
        encrypted_dek_b64 = c.get("encrypted_dek_b64")
        provider = artifact.get("provider")
        ref = artifact.get("ref")
        storage_ref = core_storage.StorageRef(provider=provider, ref=ref)
        storage = core_storage.PinataStorage()
        data = storage.get(storage_ref)
        if encrypted_dek_b64:
            if not rmk_b64:
                console.print("Commit artifacts are encrypted; --rmk-b64 is required to decrypt locally", style="bold red")
                raise typer.Exit(code=1)
            enc_dek = base64.b64decode(encrypted_dek_b64)
            rmk = base64.b64decode(rmk_b64)
            dek = crypto.decrypt_dek_with_rmk(enc_dek, rmk)
            plaintext = crypto.aes_decrypt(data, dek)
        else:
            plaintext = data

        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{repo}_{commit}.bin"
        out_path.write_bytes(plaintext)
        console.print(f"Reconstructed artifact written to: {out_path}", style="green")
    except Exception as e:
        console.print(f"Failed to reconstruct commit: {e}", style="bold red")
        raise typer.Exit(code=1)