"""
Commit commands: delta and checkpoint creation, listing and viewing commits.

All artifacts are stored transparently with no encryption.
The CLI submits artifact references to the backend via HTTP.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json

from ..api import client as api_client

app = typer.Typer()
console = Console()


@app.command("delta")
def commit_delta(
    repo: str = typer.Option(..., "--repo", help="Repository ID"),
    artifact_ref: str = typer.Option(..., "--artifact-ref", help="Artifact reference (e.g., IPFS hash or URI)"),
    metadata: str = typer.Option(None, "--metadata", help="JSON metadata (framework, round, metrics)"),
    zkml_proof_ref: str = typer.Option(None, "--zkml", help="Optional zkML proof reference")
):
    """Create a delta commit with an artifact reference.
    
    The artifact must already be uploaded to the backend storage.
    Provide the artifact reference (e.g., IPFS hash) to link it to the commit.
    """
    try:
        payload = {
            "repo_id": repo,
            "commit_type": "delta",
            "artifact_ref": artifact_ref,
            "metadata": json.loads(metadata) if metadata else {},
        }
        if zkml_proof_ref:
            payload["zkml_proof_ref"] = zkml_proof_ref

        commit = api_client.create_commit(payload)
        console.print("✓ Delta commit created:", style="green")
        console.print(commit)
    except Exception as e:
        console.print(f"Failed to create delta commit: {e}", style="bold red")
        raise typer.Exit(code=1)


@app.command("checkpoint")
def commit_checkpoint(
    repo: str = typer.Option(..., "--repo", help="Repository ID"),
    artifact_ref: str = typer.Option(..., "--artifact-ref", help="Artifact reference (e.g., IPFS hash or URI)"),
    metadata: str = typer.Option(None, "--metadata", help="JSON metadata (framework, round, metrics)"),
    zkml_proof_ref: str = typer.Option(None, "--zkml", help="Optional zkML proof reference")
):
    """Create a checkpoint commit with an artifact reference.
    
    The artifact must already be uploaded to the backend storage.
    Provide the artifact reference (e.g., IPFS hash) to link it to the commit.
    """
    try:
        payload = {
            "repo_id": repo,
            "commit_type": "checkpoint",
            "artifact_ref": artifact_ref,
            "metadata": json.loads(metadata) if metadata else {},
        }
        if zkml_proof_ref:
            payload["zkml_proof_ref"] = zkml_proof_ref

        commit = api_client.create_commit(payload)
        console.print("✓ Checkpoint commit created:", style="green")
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
def view_commit(
    repo: str = typer.Option(..., "--repo", help="Repository ID"),
    commit_hash: str = typer.Argument(..., help="Commit hash")
):
    """View a specific commit."""
    try:
        c = api_client.get_commit(repo, commit_hash)
        console.print(c)
    except Exception as e:
        console.print(f"Failed to get commit: {e}", style="bold red")
        raise typer.Exit(code=1)