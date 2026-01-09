"""
Configuration commands to manage ~/.flair/config.yaml
"""
from __future__ import annotations
import typer
from rich.console import Console
from rich.table import Table

from ..core import config as config_mod
import os

app = typer.Typer()
console = Console()


@app.command("view")
def view():
    """View current configuration (including defaults).
    
    Shows active values resolved from:
    1. Environment variables (FLAIR_*)
    2. ~/.flair/config.yaml
    3. Built-in defaults
    """
    cfg = config_mod.load_config()
    table = Table(title="Flair Configuration")
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="green")
    table.add_column("Source", style="dim")
    
    api_base = os.environ.get("FLAIR_API_BASE") or cfg.api_base_url or "http://localhost:8080"
    api_source = "env" if os.environ.get("FLAIR_API_BASE") else ("config" if config_mod.CONFIG_PATH.exists() else "default")
    table.add_row("api_base_url", api_base, f"[dim]({api_source})[/dim]")
    
    auth = os.environ.get("FLAIR_AUTH_URL") or cfg.auth_url or "http://localhost:3000"
    auth_source = "env" if os.environ.get("FLAIR_AUTH_URL") else ("config" if config_mod.CONFIG_PATH.exists() else "default")
    table.add_row("auth_url", auth, f"[dim]({auth_source})[/dim]")
    
    pinata_key = "***" if (os.environ.get("PINATA_API_KEY") or cfg.pinata_api_key) else "[dim]not set[/dim]"
    pinata_key_source = "env" if os.environ.get("PINATA_API_KEY") else ("config" if cfg.pinata_api_key else "—")
    table.add_row("pinata_api_key", pinata_key, f"[dim]({pinata_key_source})[/dim]" if pinata_key != "[dim]not set[/dim]" else "—")
    
    console.print(table)
    console.print(f"\n[dim]Config file: {config_mod.CONFIG_PATH}[/dim]")


@app.command("set")
def set_config(
    api_base_url: str = typer.Option(None, help="Backend API base URL"),
    auth_url: str = typer.Option(None, help="Auth frontend URL (e.g., https://auth.flair.example/login)"),
    pinata_api_key: str = typer.Option(None, help="Pinata API key"),
    pinata_api_secret: str = typer.Option(None, help="Pinata API secret")
):
    """Set configuration values in ~/.flair/config.yaml.
    
    In production, prefer environment variables for sensitive values:
      export PINATA_API_KEY=xxx
      export PINATA_API_SECRET=yyy
    """
    cfg = config_mod.load_config()
    changed = False
    
    if api_base_url:
        cfg.api_base_url = api_base_url
        console.print(f"✓ Set api_base_url = {api_base_url}", style="green")
        changed = True
    
    if auth_url:
        cfg.auth_url = auth_url
        console.print(f"✓ Set auth_url = {auth_url}", style="green")
        changed = True
    
    if pinata_api_key:
        cfg.pinata_api_key = pinata_api_key
        console.print("✓ Set pinata_api_key", style="green")
        changed = True
    
    if pinata_api_secret:
        cfg.pinata_api_secret = pinata_api_secret
        console.print("✓ Set pinata_api_secret", style="green")
        changed = True
    
    if changed:
        config_mod.save_config(cfg)
        console.print(f"[dim]Config saved to {config_mod.CONFIG_PATH}[/dim]")
    else:
        console.print("[yellow]No values to set[/yellow]")
