"""
Storage commands.
"""
from __future__ import annotations
import typer
from rich.console import Console
from rich.table import Table
from ..core.config import load_config

app = typer.Typer()
console = Console()


@app.command("status")
def status():
    """Show configured storage provider and status."""
    cfg = load_config()
    table = Table(title="Flair Storage Status")
    table.add_column("Key")
    table.add_column("Value")
    provider = "pinata" if cfg.pinata_api_key else "none"
    table.add_row("active_provider", provider)
    table.add_row("pinata_api_key_configured", str(bool(cfg.pinata_api_key)))
    console.print(table)