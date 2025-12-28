"""
Branch commands.
Note: Branch operations require a repo context provided via --repo.
"""
from __future__ import annotations
import typer
from rich.console import Console
from ..api import client as api_client

app = typer.Typer()
console = Console()


@app.command("create")
def create(branch_name: str = typer.Argument(..., help="Branch name"),
           repo: str = typer.Option(..., "--repo", help="Repository ID")):
    """Create a branch for a repository."""
    try:
        with api_client._client_with_auth() as c:
            r = c.post(f"/repos/{repo}/branches", json={"name": branch_name})
            r.raise_for_status()
            console.print(f"Branch created: {r.json()}", style="green")
    except Exception as e:
        console.print(f"Failed to create branch: {e}", style="bold red")
        raise typer.Exit(code=1)


@app.command("list")
def list_branches(repo: str = typer.Option(..., "--repo", help="Repository ID")):
    """List branches for a repository."""
    try:
        with api_client._client_with_auth() as c:
            r = c.get(f"/repos/{repo}/branches")
            r.raise_for_status()
            console.print(r.json())
    except Exception as e:
        console.print(f"Failed to list branches: {e}", style="bold red")
        raise typer.Exit(code=1)