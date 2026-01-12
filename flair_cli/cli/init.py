"""
Initialize a Flair repository in the current directory.
Creates a .flair folder and registers the repository with the backend.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json

from ..api import client as api_client

app = typer.Typer()
console = Console()

@app.command()
def init(
    name: str = typer.Option(None, help="Repository name (defaults to current folder name)"),
    description: str = typer.Option(None, help="Short description"),
    use_case: str = typer.Option(None, "--use-case", help="Use case description"),
    framework: str = typer.Option(None, help="ML framework (PyTorch / TensorFlow / Tensorflow)")
):
    """Initialize a new Flair repository in the current directory."""
    flair_dir = Path.cwd() / ".flair"

    # If already initialized, show repo info and exit
    if flair_dir.exists():
        console.print("[yellow]✓ This directory is already initialized as a Flair repository[/yellow]")
        repo_file = flair_dir / "repo.json"
        if repo_file.exists():
            try:
                with open(repo_file, "r") as f:
                    repo_data = json.load(f)
                console.print(f"Repository: {repo_data.get('name')} (ID: {repo_data.get('id')})")
            except Exception:
                console.print("[dim]Existing .flair/repo.json could not be read[/dim]")
        return

    # Default repo name to current folder name
    if not name:
        name = Path.cwd().name
        console.print(f"[dim]Using current folder name as repository name: {name}[/dim]")

    payload = {
        "metadata": {
            "description": description,
            "useCase": use_case,
            "framework": framework
        },
        "name": name
    }

    try:
        resp = api_client.create_repo(payload)

        flair_dir.mkdir(exist_ok=True)
        repo_file = flair_dir / "repo.json"
        with open(repo_file, "w") as f:
            json.dump(resp, f, indent=2)

        console.print("✓ Repository initialized successfully!", style="green")
        console.print(f"  Name: {resp.get('name')}")
        console.print(f"  ID: {resp.get('id')}")
        console.print(f"  Location: {flair_dir}")
    except Exception as e:
        console.print(f"Failed to initialize repository: {e}", style="bold red")
        raise typer.Exit(code=1)
