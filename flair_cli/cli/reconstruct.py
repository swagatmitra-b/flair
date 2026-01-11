"""
Reconstruct command: download artifacts from commits.

Artifacts are stored transparently without encryption.
The CLI downloads the artifact from the backend and saves it locally.
"""
from __future__ import annotations
import typer
from pathlib import Path
from rich.console import Console
from ..api import client as api_client

app = typer.Typer()
console = Console()


@app.command()
def reconstruct(repo: str = typer.Option(..., "--repo", help="Repository ID"),
                commit: str = typer.Option(..., "--commit", help="Commit hash"),
                out_dir: Path = typer.Option(Path("./reconstructed"), help="Output directory for artifact")):
    """Download and save an artifact from a specific commit.
    
    Artifacts are stored transparently in the backend.
    This command retrieves the artifact and saves it locally.
    """
    try:
        c = api_client.get_commit(repo, commit)
        artifact_ref = c.get("artifact_ref")
        
        if not artifact_ref:
            console.print("No artifact reference in commit", style="bold red")
            raise typer.Exit(code=1)

        # Download artifact from backend
        data = api_client.download_artifact(artifact_ref)

        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{repo}_{commit}.bin"
        out_path.write_bytes(data)
        console.print(f"✓ Artifact saved to: {out_path}", style="green")
    except Exception as e:
        console.print(f"Failed to reconstruct artifact: {e}", style="bold red")
        raise typer.Exit(code=1)