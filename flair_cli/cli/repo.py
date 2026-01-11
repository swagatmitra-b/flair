"""
Repository management commands.
Creates and manages repositories via HTTP requests to the Flair backend.
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


@app.command("create")
def create(
    name: str = typer.Option(..., help="Repository name"),
    description: str = typer.Option(None, help="Short description"),
    private: bool = typer.Option(False, "--private", help="Create a private repo")
):
    """Create a repository.
    
    All repositories are transparent and verifiable by third parties.
    No encryption is applied to artifacts or metadata.
    """
    payload = {
        "name": name,
        "description": description,
        "is_private": private,
    }
    
    try:
        resp = api_client.create_repo(payload)
        console.print("✓ Repository created:", style="green")
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