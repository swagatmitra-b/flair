"""
Add command: Create a new local commit with initial data.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json
from uuid import uuid4

app = typer.Typer()
console = Console()


def _get_latest_local_commit() -> tuple[dict, Path] | None:
    """Get the latest local commit from .flair/.local_commits/"""
    flair_dir = Path.cwd() / ".flair"
    local_commits_dir = flair_dir / ".local_commits"
    
    if not local_commits_dir.exists():
        return None
    
    # Get the most recently created commit directory
    commit_dirs = sorted(local_commits_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    
    if not commit_dirs:
        return None
    
    commit_dir = commit_dirs[0]
    commit_file = commit_dir / "commit.json"
    
    if commit_file.exists():
        with open(commit_file, 'r') as f:
            return json.load(f), commit_dir
    
    return None


@app.command()
def add():
    """Create a new local commit.
    
    This creates a commit JSON file in .flair/.local_commits/ with a UUIDv4 hash.
    The commit will be associated with any params and ZKP files created next.
    
    Examples:
      flair add    # Creates a new local commit
    """
    try:
        # Check if we're in a Flair repository
        flair_dir = Path.cwd() / ".flair"
        if not flair_dir.exists():
            console.print("[red]Not in a Flair repository. Run 'flair init' first.[/red]")
            raise typer.Exit(code=1)
        
        # Check if there's an incomplete commit
        latest_commit = _get_latest_local_commit()
        if latest_commit:
            commit_data, _ = latest_commit
            if commit_data.get("params") is None or commit_data.get("zkp") is None:
                console.print("[red]✗ Cannot create a new commit yet.[/red]")
                console.print(f"[yellow]The current commit ({commit_data.get('commitHash')[:8]}...) is incomplete:[/yellow]")
                if commit_data.get("params") is None:
                    console.print("[yellow]  • Missing: params (run 'flair params create')[/yellow]")
                if commit_data.get("zkp") is None:
                    console.print("[yellow]  • Missing: ZKP proof (run 'flair zkp create')[/yellow]")
                console.print("[yellow]Complete the current commit before creating a new one.[/yellow]")
                raise typer.Exit(code=1)
        
        # Load repo config to get framework
        config_file = flair_dir / "repo_config.json"
        if not config_file.exists():
            console.print("[red]Repository configuration not found. Run 'flair init' first.[/red]")
            raise typer.Exit(code=1)
        
        with open(config_file, 'r') as f:
            repo_config = json.load(f)
        
        # Create local commits directory
        local_commits_dir = flair_dir / ".local_commits"
        local_commits_dir.mkdir(exist_ok=True)
        
        # Generate new commit hash (UUIDv4)
        commit_hash = str(uuid4())
        commit_dir = local_commits_dir / commit_hash
        commit_dir.mkdir(exist_ok=True)
        
        # Create commit JSON with available data
        commit_data = {
            "commitHash": commit_hash,
            "architecture": repo_config.get("framework", "unknown"),
            "params": None,  # Will be filled by flair params create
            "zkp": None,     # Will be filled by flair zkp create
            "message": None, # Will be filled by flair push
            "createdAt": None,
            "status": "CREATED"
        }
        
        commit_file = commit_dir / "commit.json"
        with open(commit_file, 'w') as f:
            json.dump(commit_data, f, indent=2)
        
        console.print(f"\n[green]✓ New local commit created[/green]")
        console.print(f"  Commit hash: {commit_hash[:8]}...")
        console.print(f"  Location: .flair/.local_commits/{commit_hash}/")
        console.print(f"\n[dim]Next steps:[/dim]")
        console.print(f"  1. Run 'flair params create' to add model parameters")
        console.print(f"  2. Run 'flair zkp create' to generate zero-knowledge proof")
        console.print(f"  3. Run 'flair push -m \"Your message\"' to push to repository")
        
    except Exception as e:
        console.print(f"[red]✗ Failed to create commit: {str(e)}[/red]")
        raise typer.Exit(code=1)
