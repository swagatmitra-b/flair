"""
Auth commands (SIWS - Sign-In With Solana).

Design: The CLI does not manage or store private keys. To authenticate, the CLI prints a message
for the user to sign with their Solana wallet (Phantom). The user then supplies their wallet address
and signature to the `login` command which exchanges the signature with the backend for a session token.
"""
from __future__ import annotations
import typer
from rich.console import Console
from rich import print as rprint
from datetime import datetime
import secrets

from ..core import session as session_mod
from ..api.client import verify_auth

app = typer.Typer()
console = Console()


def _make_siws_message(address: str, purpose: str = "Flair CLI authentication") -> str:
    # Simple SIWS message — backends should implement canonical SIWS verification.
    nonce = secrets.token_hex(8)
    ts = datetime.utcnow().isoformat() + "Z"
    return f"Flair SIWS login\nAddress: {address}\nNonce: {nonce}\nTime: {ts}\nPurpose: {purpose}"


@app.command("login")
def login(address: str = typer.Option(..., help="Your Solana wallet address"),
          signature: str = typer.Option(None, help="Signature of the SIWS message (base64/hex)"),
          message: str = typer.Option(None, help="If you already have a signed message, pass it here")):
    """Login using Sign-In With Solana (SIWS).

    Typical flow:
    1. Run `flair auth login --address <your_address>` to get a message.
    2. Use your wallet (e.g. Phantom) to sign the message.
    3. Re-run `flair auth login --address <your_address> --signature <sig> --message '<message>'` to exchange for a session token.
    """
    # If no message provided, print one for the user to sign.
    if not message:
        msg = _make_siws_message(address)
        rprint("[bold green]SIWS message to sign:[/bold green]\n")
        rprint(msg)
        rprint("\nSign the above message with your wallet and call this command again with --signature and --message.")
        raise typer.Exit(code=0)

    if not signature:
        console.print("Error: --signature is required when submitting a signed message", style="bold red")
        raise typer.Exit(code=1)

    # Exchange with backend for a token
    try:
        resp = verify_auth(wallet_address=address, siws_message=message, signature=signature)
        token = resp.get("token")
        expires_at = resp.get("expires_at")
        if not token:
            console.print("Authentication failed: no token returned", style="bold red")
            raise typer.Exit(code=1)
        s = session_mod.Session(token=token, wallet_address=address, expires_at=expires_at)
        session_mod.save_session(s)
        console.print("Login successful. Session saved.", style="bold green")
    except Exception as e:
        console.print(f"Login failed: {e}", style="bold red")
        raise typer.Exit(code=1)


@app.command("status")
def status():
    """Show auth status."""
    s = session_mod.load_session()
    if not s:
        console.print("Not logged in", style="yellow")
        raise typer.Exit(code=0)
    console.print(f"Logged in as [bold]{s.wallet_address}[/bold] (expires: {s.expires_at})", style="green")


@app.command("logout")
def logout():
    """Logout and clear local session token."""
    session_mod.clear_session()
    console.print("Logged out and session cleared", style="green")