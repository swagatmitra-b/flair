"""
Storage commands.

Note: Flair CLI does not manage storage directly. All artifacts are managed
transparently by the backend repository manager via HTTP endpoints.
"""
from __future__ import annotations
import typer
from rich.console import Console

app = typer.Typer()
console = Console()


@app.command("status")
def status():
    """Show storage information.
    
    Artifacts are managed by the backend repository manager.
    This CLI communicates with the backend via HTTP endpoints.
    """
    console.print("[bold cyan]Flair Storage[/bold cyan]")
    console.print("✓ All artifacts are stored transparently via backend")
    console.print("✓ No client-side encryption or local storage adapters")
    console.print("✓ Backend manages all artifact storage and retrieval")