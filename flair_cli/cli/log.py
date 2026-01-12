"""
Log command: list commits for current repo or a given repo id.
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


def _current_repo_id() -> str | None:
    flair_dir = Path.cwd() / ".flair"
    repo_file = flair_dir / "repo.json"
    if repo_file.exists():
        try:
            data = json.loads(repo_file.read_text())
            return data.get("id")
        except Exception:
            return None
    return None


@app.command()
def log(repo: str = typer.Option(None, "--repo", help="Repository ID (defaults to current repo if initialized)")):
    """List commits similar to 'git log'."""
    repo_id = repo or _current_repo_id()
    if not repo_id:
        console.print("[red]No repository specified and current directory is not initialized[/red]")
        raise typer.Exit(code=1)
    try:
        commits = api_client.list_commits(repo_id)
        table = Table(title=f"Commit Log — {repo_id}")
        table.add_column("Hash")
        table.add_column("Type")
        table.add_column("Created")
        for c in commits.get("commits", []):
            table.add_row(c.get("hash"), c.get("commit_type"), str(c.get("created_at")))
        console.print(table)
    except Exception as e:
        console.print(f"Failed to list commits: {e}", style="bold red")
        raise typer.Exit(code=1)
