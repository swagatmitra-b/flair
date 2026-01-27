"""
Entry point for the Flair CLI.
This creates a Typer app and mounts subcommand groups from the `cli` package.
"""
from typing import Optional
import typer
from rich.console import Console

from flair_cli.cli import auth, config, init, clone, basemodel, branch, add, zkp, push

app = typer.Typer(help="Flair — model repository ledger CLI")
console = Console()

# Mount subcommands
app.add_typer(auth.app, name="auth", help="Authentication commands (SIWS)")
app.add_typer(config.app, name="config", help="Configuration management")
app.add_typer(init.app, name="init", help="Initialize repository in current directory")
app.add_typer(clone.app, name="clone", help="Clone a remote repository")
app.add_typer(basemodel.app, name="basemodel", help="Manage base models")
app.add_typer(branch.app, name="branch", help="Branch management")
app.add_typer(add.app, name="add", help="Extract model weights and save as params")
app.add_typer(zkp.app, name="zkp", help="Zero-Knowledge Proof operations")
app.add_typer(push.app, name="push", help="Push commits to remote repository")

# Add checkout as top-level command for git-like experience
@app.command()
def checkout(branch_name: str = typer.Argument(..., help="Branch name to switch to")):
    """Switch to a different branch (alias for 'branch checkout')."""
    from flair_cli.cli.branch import checkout as branch_checkout
    branch_checkout(branch_name)

@app.callback(invoke_without_command=True)
def main(ctx: typer.Context, json: Optional[bool] = typer.Option(False, "--json", help="Output machine-friendly JSON")):
    """Flair CLI — record-only model repository and commit ledger for ML model evolution.
    Note: Flair never performs training or stores private keys.
    """
    if ctx.invoked_subcommand is None:
        console.print("Use 'flair --help' to see available commands.")

if __name__ == "__main__":
    app()