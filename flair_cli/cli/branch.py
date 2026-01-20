"""
Branch management commands - git-like syntax.
"""
from __future__ import annotations
import typer
from rich.console import Console
from rich.table import Table
from pathlib import Path
import json

from ..api import client as api_client

app = typer.Typer()
console = Console()


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


def _get_current_branch() -> dict | None:
    """Get current branch from .flair/HEAD"""
    flair_dir = Path.cwd() / ".flair"
    head_file = flair_dir / "HEAD"
    if not head_file.exists():
        return None
    try:
        with open(head_file, "r") as f:
            return json.load(f)
    except Exception:
        return None


def _set_current_branch(branch_data: dict):
    """Update .flair/HEAD with current branch info"""
    flair_dir = Path.cwd() / ".flair"
    head_file = flair_dir / "HEAD"
    with open(head_file, "w") as f:
        json.dump(branch_data, f, indent=2)


def _get_all_branches() -> list[dict]:
    """Get all branches from .flair/branches.json"""
    flair_dir = Path.cwd() / ".flair"
    branches_file = flair_dir / "branches.json"
    if not branches_file.exists():
        return []
    try:
        with open(branches_file, "r") as f:
            return json.load(f)
    except Exception:
        return []


def _update_branches_cache(branches: list[dict]):
    """Update .flair/branches.json cache"""
    flair_dir = Path.cwd() / ".flair"
    branches_file = flair_dir / "branches.json"
    with open(branches_file, "w") as f:
        json.dump(branches, f, indent=2)


@app.command(name="branch")
def list_or_create_branch(
    branch_name: str = typer.Argument(None, help="Branch name to create"),
    delete: str = typer.Option(None, "-d", "--delete", help="Delete specified branch"),
    description: str = typer.Option(None, help="Branch description")
):
    """List all branches or create a new branch.
    
    Examples:
      flair branch              # List all branches
      flair branch new-feature  # Create new branch from current
      flair branch -d old-branch  # Delete a branch
    """
    repo = _get_current_repo()
    if not repo:
        console.print("[red]Not in a Flair repository. Run 'flair init' first.[/red]")
        raise typer.Exit(code=1)
    
    repo_hash = repo.get("hash") or repo.get("repoHash")
    current_branch = _get_current_branch()
    
    # Delete branch
    if delete:
        if current_branch and current_branch.get("currentBranch") == delete:
            console.print(f"[red]Cannot delete current branch '{delete}'. Switch to another branch first.[/red]")
            raise typer.Exit(code=1)
        
        try:
            # Get branch hash first
            branches = _get_all_branches()
            target_branch = next((b for b in branches if b.get("name") == delete), None)
            if not target_branch:
                console.print(f"[red]Branch '{delete}' not found.[/red]")
                raise typer.Exit(code=1)
            
            import httpx
            from ..core.session import load_session
            session = load_session()
            headers = {"Authorization": f"Bearer {session.token}"} if session and session.token else {}
            
            with httpx.Client(base_url=api_client._base_url(), headers=headers, timeout=30) as client:
                r = client.delete(f"/repo/hash/{repo_hash}/branch/hash/{target_branch['branchHash']}/delete")
                r.raise_for_status()
            
            console.print(f"✓ Branch '{delete}' deleted", style="green")
            
            # Refresh branches cache
            with httpx.Client(base_url=api_client._base_url(), headers=headers, timeout=30) as client:
                r = client.get(f"/repo/hash/{repo_hash}/branch")
                r.raise_for_status()
                branches = r.json().get("data", [])
                _update_branches_cache(branches)
            
        except Exception as e:
            console.print(f"[red]Failed to delete branch: {e}[/red]")
            raise typer.Exit(code=1)
        return
    
    # Create new branch
    if branch_name:
        if not current_branch:
            console.print("[red]No current branch set. Cannot create branch from nowhere.[/red]")
            raise typer.Exit(code=1)
        
        try:
            import httpx
            from ..core.session import load_session
            session = load_session()
            headers = {"Authorization": f"Bearer {session.token}"} if session and session.token else {}
            
            payload = {
                "name": branch_name,
                "currentBranchHash": current_branch.get("branchHash")
            }
            if description:
                payload["description"] = description
            
            with httpx.Client(base_url=api_client._base_url(), headers=headers, timeout=30) as client:
                r = client.post(f"/repo/hash/{repo_hash}/branch/create", json=payload)
                r.raise_for_status()
                new_branch = r.json().get("data", {})
            
            console.print(f"✓ Branch '{branch_name}' created", style="green")
            
            # Refresh branches cache
            with httpx.Client(base_url=api_client._base_url(), headers=headers, timeout=30) as client:
                r = client.get(f"/repo/hash/{repo_hash}/branch")
                r.raise_for_status()
                branches = r.json().get("data", [])
                _update_branches_cache(branches)
            
        except Exception as e:
            console.print(f"[red]Failed to create branch: {e}[/red]")
            raise typer.Exit(code=1)
        return
    
    # List branches (default behavior)
    try:
        import httpx
        from ..core.session import load_session
        session = load_session()
        headers = {"Authorization": f"Bearer {session.token}"} if session and session.token else {}
        
        with httpx.Client(base_url=api_client._base_url(), headers=headers, timeout=30) as client:
            r = client.get(f"/repo/hash/{repo_hash}/branch")
            r.raise_for_status()
            branches = r.json().get("data", [])
        
        if not branches:
            console.print("[dim]No branches found. Create one with 'flair branch <name>'[/dim]")
            return
        
        current_name = current_branch.get("currentBranch") if current_branch else None
        
        console.print("\n[bold]Branches:[/bold]")
        for branch in branches:
            prefix = "* " if branch.get("name") == current_name else "  "
            style = "green" if branch.get("name") == current_name else "white"
            console.print(f"{prefix}{branch.get('name')}", style=style)
        
        console.print()
        
    except Exception as e:
        console.print(f"[red]Failed to list branches: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def checkout(
    branch_name: str = typer.Argument(..., help="Branch name to switch to")
):
    """Switch to a different branch.
    
    Example:
      flair checkout main
      flair checkout feature-branch
    """
    repo = _get_current_repo()
    if not repo:
        console.print("[red]Not in a Flair repository[/red]")
        raise typer.Exit(code=1)
    
    repo_hash = repo.get("hash") or repo.get("repoHash")
    
    try:
        import httpx
        from ..core.session import load_session
        session = load_session()
        headers = {"Authorization": f"Bearer {session.token}"} if session and session.token else {}
        
        # Fetch branch details by name
        with httpx.Client(base_url=api_client._base_url(), headers=headers, timeout=30) as client:
            r = client.get(f"/repo/hash/{repo_hash}/branch/name/{branch_name}")
            r.raise_for_status()
            branch_data = r.json().get("data", {})
        
        if not branch_data or isinstance(branch_data, list):
            console.print(f"[red]Branch '{branch_name}' not found[/red]")
            raise typer.Exit(code=1)
        
        # Update HEAD to point to new branch
        head_data = {
            "currentBranch": branch_data.get("name"),
            "branchHash": branch_data.get("branchHash"),
            "description": branch_data.get("description")
        }
        _set_current_branch(head_data)
        
        console.print(f"✓ Switched to branch '{branch_name}'", style="green")
        console.print(f"[dim]Note: Download latest params with 'flair pull' if needed[/dim]")
        
    except Exception as e:
        console.print(f"[red]Failed to switch branch: {e}[/red]")
        raise typer.Exit(code=1)
