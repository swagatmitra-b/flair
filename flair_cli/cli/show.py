"""
Show command: display a specific commit's details.
"""
from __future__ import annotations
import typer
from rich.console import Console
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
def show(commit_hash: str, repo: str = typer.Option(None, "--repo", help="Repository ID (defaults to current repo)")):
    """Show commit details similar to 'git show'."""
    repo_id = repo or _current_repo_id()
    if not repo_id:
        console.print("[red]No repository specified and current directory is not initialized[/red]")
        raise typer.Exit(code=1)
    try:
        c = api_client.get_commit(repo_id, commit_hash)
        console.print_json(data=c)
    except Exception as e:
        console.print(f"Failed to get commit: {e}", style="bold red")
        raise typer.Exit(code=1)
