"""
Base model management commands.
Upload, check, and manage base models for repositories.
"""

from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json
import httpx

from ..api import client as api_client
from ..core.config import ALLOWED_BASE_MODEL_EXTENSIONS

app = typer.Typer()
console = Console()

# function to get the current repository info thats stored in .flair/repo.json
def _get_current_repo() -> dict | None:
    """Get current repository info from .flair/repo.json"""
    flair_dir = Path.cwd() / ".flair"
    repo_file = flair_dir / "repo.json"
    if not repo_file.exists():
        return None
    try:
        with open(repo_file, "r") as f:
            return json.load(f)
    except Exception:
        return None


def _check_base_model_exists(repo_hash: str) -> tuple[bool, str | None]:
    """Check if base model already exists for repo.
    
    Returns:
        (exists: bool, url: str | None)
    """
    try:
        result = api_client.get_base_model_url(repo_hash)
        return True, result.get("data")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400:
            # No base model exists
            return False, None
        raise


def upload_base_model(repo_hash: str, file_path: Path, force: bool = False) -> bool:
    """Upload a base model file to repository.
    
    Args:
        repo_hash: Repository hash
        file_path: Path to base model file
        force: Skip confirmation prompts
        
    Returns:
        True if successful, False otherwise
    """
    # Validate file extension
    if file_path.suffix.lower() not in ALLOWED_BASE_MODEL_EXTENSIONS:
        console.print(f"[red]Invalid file type: {file_path.suffix}[/red]")
        console.print(f"[dim]Allowed types: {', '.join(ALLOWED_BASE_MODEL_EXTENSIONS)}[/dim]")
        return False
    
    # Check if file exists
    if not file_path.exists():
        console.print(f"[red]File not found: {file_path}[/red]")
        return False
    
    # Check if base model already exists
    exists, existing_url = _check_base_model_exists(repo_hash)
    
    if exists and not force:
        console.print("[yellow]⚠ Base model already exists for this repository[/yellow]")
        console.print(f"[dim]Current URL: {existing_url}[/dim]")
        replace = typer.confirm("Do you want to replace it?", default=False)
        if not replace:
            console.print("[dim]Upload cancelled[/dim]")
            return False
    
    # Upload the file
    try:
        console.print(f"[dim]Uploading {file_path.name} ({file_path.stat().st_size / 1024:.2f} KB)...[/dim]")
        result = api_client.upload_base_model(repo_hash, file_path)
        
        cid = result.get("cid")
        url = result.get("url")
        
        console.print("✓ Base model uploaded successfully!", style="green")
        console.print(f"  CID: {cid}")
        console.print(f"  URL: {url}")
        return True
        
    except Exception as e:
        console.print(f"[red]Failed to upload base model: {e}[/red]")
        return False


@app.command()
def add(
    filename: str = typer.Argument(..., help="Base model file to upload"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation prompts")
):
    """Upload a base model file to the current repository.
    
    Example:
      flair basemodel add model.pt
      flair basemodel add architecture.onnx --force
    """
    # Get current repo
    repo = _get_current_repo()
    if not repo:
        console.print("[red]Not in a Flair repository. Run 'flair init' first.[/red]")
        raise typer.Exit(code=1)
    
    repo_hash = repo.get("hash") or repo.get("repoHash")
    if not repo_hash:
        console.print("[red]Could not determine repository hash[/red]")
        raise typer.Exit(code=1)
    
    # Resolve file path
    file_path = Path(filename)
    if not file_path.is_absolute():
        file_path = Path.cwd() / filename
    
    success = upload_base_model(repo_hash, file_path, force)
    if not success:
        raise typer.Exit(code=1)


@app.command()
def check():
    """Check if current repository has a base model."""
    repo = _get_current_repo()
    if not repo:
        console.print("[red]Not in a Flair repository[/red]")
        raise typer.Exit(code=1)
    
    repo_hash = repo.get("hash") or repo.get("repoHash")
    exists, url = _check_base_model_exists(repo_hash)
    
    if exists:
        console.print("[green]✓ Base model exists[/green]")
        console.print(f"  URL: {url}")
    else:
        console.print("[dim]No base model uploaded[/dim]")


@app.command()
def delete(
    confirm: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation prompt")
):
    """Delete base model from current repository."""
    repo = _get_current_repo()
    if not repo:
        console.print("[red]Not in a Flair repository[/red]")
        raise typer.Exit(code=1)
    
    repo_hash = repo.get("hash") or repo.get("repoHash")
    
    # Check if model exists
    exists, _ = _check_base_model_exists(repo_hash)
    if not exists:
        console.print("[yellow]No base model to delete[/yellow]")
        return
    
    if not confirm:
        proceed = typer.confirm("Are you sure you want to delete the base model?", default=False)
        if not proceed:
            console.print("[dim]Deletion cancelled[/dim]")
            return
    
    try:
        api_client.delete_base_model(repo_hash)
        console.print("✓ Base model deleted", style="green")
    except Exception as e:
        console.print(f"[red]Failed to delete base model: {e}[/red]")
        raise typer.Exit(code=1)
