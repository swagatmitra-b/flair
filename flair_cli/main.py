"""
Entry point for the Flair CLI.
This creates a Typer app and mounts subcommand groups from the `cli` package.
"""
from typing import Optional
import typer
from rich.console import Console

from flair_cli.cli import auth, repo, branch, commit, reconstruct, storage

app = typer.Typer(help="Flair — model repository ledger CLI")
console = Console()

# Mount subcommands
app.add_typer(auth.app, name="auth", help="Authentication commands (SIWS)")
app.add_typer(repo.app, name="repo", help="Repository management commands")
app.add_typer(branch.app, name="branch", help="Branching commands")
app.add_typer(commit.app, name="commit", help="Commit management commands")
app.add_typer(reconstruct.app, name="reconstruct", help="Reconstruction utilities")
app.add_typer(storage.app, name="storage", help="Storage provider commands")


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context, json: Optional[bool] = typer.Option(False, "--json", help="Output machine-friendly JSON")):
    """Flair CLI — record-only model repository and commit ledger for ML model evolution.

    Note: Flair never performs training or stores private keys.
    """
    if ctx.invoked_subcommand is None:
        console.print("Use 'flair --help' to see available commands.")


if __name__ == "__main__":
    app()