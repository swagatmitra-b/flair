"""
Status command: show repository and session status.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json

from ..core.session import load_session

app = typer.Typer()
console = Console()


@app.command()
def status():
    """Display repo status for current directory and global session info."""
    flair_dir = Path.cwd() / ".flair"
    if flair_dir.exists():
        repo_file = flair_dir / "repo.json"
        if repo_file.exists():
            try:
                data = json.loads(repo_file.read_text())
                console.print(f"Repo: [bold]{data.get('name')}[/bold]  ID: [dim]{data.get('id')}[/dim]")
            except Exception:
                console.print("Repo: [yellow]found[/yellow] (.flair) but repo.json is invalid")
        else:
            console.print("Repo: [yellow]found[/yellow] (.flair) but repo.json missing")
    else:
        console.print("Repo: [dim]not initialized[/dim] (run 'flair init')")

    session = load_session()
    if session:
        console.print("Session: [green]active[/green]")
        if session.wallet_address:
            console.print(f"Wallet: [dim]{session.wallet_address}[/dim]")
        if session.expires_at:
            console.print(f"Expires: [dim]{session.expires_at}[/dim]")
    else:
        console.print("Session: [red]none[/red] (run 'flair auth login')")
