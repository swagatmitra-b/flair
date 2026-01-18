"""
Clone command: clone a remote repository to local directory.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json
import os

from ..api import client as api_client

app = typer.Typer()
console = Console()


@app.command()
def clone(
    repo_hash: str = typer.Argument(..., help="Repository hash"),
    target_dir: str = typer.Option(None, "--target-dir", "-C", help="Target directory (defaults to repo name)")
):
    """Clone a remote repository to local directory.
    
    Examples:
      flair clone <repo_hash>
      flair clone <repo_hash> --target-dir ./my-repo
    """
    try:
        # Fetch clone data from backend using repo hash
        clone_data = api_client.clone_repository(repo_hash)
        
        repo_info = clone_data.get("repo", {})
        branches = clone_data.get("branches", [])
        
        repo_name = repo_info.get("name")
        repo_hash_returned = repo_info.get("hash")
        
        if not repo_name or not repo_hash_returned:
            console.print("[red]Invalid repository data from backend[/red]")
            raise typer.Exit(code=1)
        
        # Determine target directory
        if target_dir:
            local_dir = Path(target_dir)
        else:
            local_dir = Path.cwd() / repo_name
        
        # Check if directory already exists
        if local_dir.exists():
            console.print(f"[red]Directory already exists: {local_dir}[/red]")
            raise typer.Exit(code=1)
        
        # Create directory structure
        local_dir.mkdir(parents=True, exist_ok=True)
        flair_dir = local_dir / ".flair"
        flair_dir.mkdir(exist_ok=True)
        
        # Save repository metadata
        repo_file = flair_dir / "repo.json"
        repo_data = {
            "name": repo_info.get("name"),
            "hash": repo_info.get("hash"),
            "id": repo_info.get("hash"),  # Use hash as ID for now
            "owner": repo_info.get("owner"),
            "metadata": repo_info.get("metadata"),
            "baseModel": repo_info.get("baseModel"),
            "createdAt": repo_info.get("createdAt"),
            "updatedAt": repo_info.get("updatedAt")
        }
        
        with open(repo_file, "w") as f:
            json.dump(repo_data, f, indent=2)
        
        # Save branches info
        branches_file = flair_dir / "branches.json"
        with open(branches_file, "w") as f:
            json.dump(branches, f, indent=2)
        
        # Create a .gitignore-like flair ignore file
        flairiignore = local_dir / ".flairignore"
        flairiignore.write_text("__pycache__/\n*.pyc\n.DS_Store\n.env\nnode_modules/\n")
        
        # Display clone info
        console.print(f"✓ Repository cloned successfully!", style="green")
        console.print(f"  Name: {repo_name}")
        console.print(f"  Owner: {repo_info.get('owner')}")
        console.print(f"  Location: {local_dir}")
        console.print(f"  Branches: {len(branches)}")
        
        if branches:
            console.print("\n[dim]Branches:[/dim]")
            for branch in branches:
                latest_commit = branch.get("latestCommit")
                if latest_commit:
                    console.print(f"  • {branch.get('name')} @ {latest_commit.get('commitHash', 'N/A')[:8]}")
                else:
                    console.print(f"  • {branch.get('name')} (empty)")
        
        console.print(f"\nTo get started:")
        console.print(f"  cd {local_dir}")
        console.print(f"  flair status")
        
    except Exception as e:
        console.print(f"Failed to clone repository: {e}", style="bold red")
        raise typer.Exit(code=1)
