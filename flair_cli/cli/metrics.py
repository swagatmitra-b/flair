"""Metrics command group: stage commit metrics in .flair/metrics.json."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path

import typer
from rich.console import Console

app = typer.Typer(help="Stage and manage commit metrics")
console = Console()


def _get_flair_dir() -> Path:
    flair_dir = Path.cwd() / ".flair"
    if not flair_dir.exists():
        console.print("[red]Not in a Flair repository. Run 'flair init' first.[/red]")
        raise typer.Exit(code=1)
    return flair_dir


def _metrics_file() -> Path:
    return _get_flair_dir() / "metrics.json"


def _load_metrics(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            console.print("[yellow]Warning: .flair/metrics.json is not a JSON object. Resetting staged metrics.[/yellow]")
            return {}
        return data
    except Exception as e:
        console.print(f"[yellow]Warning: Could not read staged metrics: {e}[/yellow]")
        return {}


@app.command("set")
def set_metrics(
    epoch: int | None = typer.Option(None, "--epoch", help="Training epoch"),
    accuracy: float | None = typer.Option(None, "--accuracy", help="Accuracy metric"),
    val_loss: float | None = typer.Option(None, "--val-loss", help="Validation loss"),
    train_loss: float | None = typer.Option(None, "--train-loss", help="Training loss"),
    precision: float | None = typer.Option(None, "--precision", help="Precision metric"),
    recall: float | None = typer.Option(None, "--recall", help="Recall metric"),
    f1: float | None = typer.Option(None, "--f1", help="F1 score"),
    learning_rate: float | None = typer.Option(None, "--learning-rate", help="Learning rate"),
    notes: str | None = typer.Option(None, "--notes", help="Optional notes"),
):
    """Set or update staged metrics in .flair/metrics.json."""
    updates = {
        "epoch": epoch,
        "accuracy": accuracy,
        "val_loss": val_loss,
        "train_loss": train_loss,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "learning_rate": learning_rate,
        "notes": notes,
    }
    updates = {k: v for k, v in updates.items() if v is not None}

    if not updates:
        console.print("[yellow]No metrics provided. Use at least one option with 'flair metrics set'.[/yellow]")
        raise typer.Exit(code=1)

    path = _metrics_file()
    data = _load_metrics(path)
    data.update(updates)
    data["updatedAt"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    console.print("[green]Metrics staged.[/green]")
    console.print(f"[dim]File: {path}[/dim]")


@app.command("show")
def show_metrics():
    """Show current staged metrics from .flair/metrics.json."""
    path = _metrics_file()
    if not path.exists():
        console.print("No staged metrics found.")
        console.print("Use 'flair metrics set' or 'flair metrics import'.")
        raise typer.Exit(code=0)

    data = _load_metrics(path)
    if not data:
        console.print("No staged metrics found.")
        console.print("Use 'flair metrics set' or 'flair metrics import'.")
        raise typer.Exit(code=0)

    console.print("Current staged metrics:")
    for key, value in data.items():
        console.print(f"- {key}: {value}")


@app.command("reset")
def reset_metrics():
    """Reset staged metrics by deleting .flair/metrics.json."""
    path = _metrics_file()
    if not path.exists():
        console.print("No staged metrics to reset.")
        raise typer.Exit(code=0)

    try:
        path.unlink()
        console.print("Metrics reset.")
    except Exception as e:
        console.print(f"[red]Failed to reset metrics: {e}[/red]")
        raise typer.Exit(code=1)
