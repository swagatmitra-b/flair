"""
Commit command: Finalize the commit.json file with message and determine commit type.
Handles delta computation, full parameter reconstruction, and cleanup of old parameters.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json
import hashlib

app = typer.Typer()
console = Console()


def _get_latest_local_commit() -> tuple[dict, Path] | None:
    """Get the latest local commit from .flair/.local_commits/"""
    flair_dir = Path.cwd() / ".flair"
    local_commits_dir = flair_dir / ".local_commits"
    
    if not local_commits_dir.exists():
        return None
    
    # Get the most recently created commit directory
    commit_dirs = sorted(local_commits_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    
    if not commit_dirs:
        return None
    
    commit_dir = commit_dirs[0]
    commit_file = commit_dir / "commit.json"
    
    if commit_file.exists():
        with open(commit_file, 'r') as f:
            return json.load(f), commit_dir
    
    return None


def _get_head_info() -> dict | None:
    """Get current HEAD information."""
    flair_dir = Path.cwd() / ".flair"
    head_file = flair_dir / "HEAD"
    
    if not head_file.exists():
        return None
    
    try:
        with open(head_file, 'r') as f:
            return json.load(f)
    except Exception:
        return None


def _is_genesis_commit() -> bool:
    """Check if this is the first commit in the repository."""
    head_info = _get_head_info()
    
    # If HEAD doesn't exist, this is the first commit
    if not head_info:
        return True
    
    # If previousCommit is explicitly genesis, this is the first commit
    if head_info.get("previousCommit") == "_GENESIS_COMMIT_":
        return True
    
    return False


def _get_commit_by_hash(commit_hash: str) -> tuple[dict, Path] | None:
    """Get commit data and directory by hash."""
    flair_dir = Path.cwd() / ".flair"
    local_commits_dir = flair_dir / ".local_commits"
    
    if not local_commits_dir.exists():
        return None
    
    commit_dir = local_commits_dir / commit_hash
    commit_file = commit_dir / "commit.json"
    
    if commit_file.exists():
        with open(commit_file, 'r') as f:
            return json.load(f), commit_dir
    
    return None


def _load_pytorch_params(file_path: Path):
    """Load PyTorch parameters from file."""
    try:
        import torch
        return torch.load(file_path, map_location="cpu")
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to load PyTorch params from {file_path}: {e}[/yellow]")
        return None


def _load_numpy_params(file_path: Path):
    """Load NumPy parameters from file."""
    try:
        import numpy as np
        data = np.load(file_path)
        # Convert to dict-like structure
        return {key: data[key] for key in data.files}
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to load NumPy params from {file_path}: {e}[/yellow]")
        return None


def _save_pytorch_params(params, file_path: Path) -> bool:
    """Save PyTorch parameters to file."""
    try:
        import torch
        torch.save(params, file_path)
        return True
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to save PyTorch params: {e}[/yellow]")
        return False


def _save_numpy_params(params: dict, file_path: Path) -> bool:
    """Save NumPy parameters to file."""
    try:
        import numpy as np
        np.savez(file_path, **params)
        return True
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to save NumPy params: {e}[/yellow]")
        return False


def _compute_pytorch_delta(current_params, previous_params) -> dict | None:
    """Compute delta between current and previous PyTorch parameters."""
    try:
        import torch
        delta = {}
        for key in current_params.keys():
            if key in previous_params:
                delta[key] = current_params[key] - previous_params[key]
            else:
                delta[key] = current_params[key]
        return delta
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to compute PyTorch delta: {e}[/yellow]")
        return None


def _compute_numpy_delta(current_params: dict, previous_params: dict) -> dict | None:
    """Compute delta between current and previous NumPy parameters."""
    try:
        import numpy as np
        delta = {}
        for key in current_params.keys():
            if key in previous_params:
                delta[key] = current_params[key] - previous_params[key]
            else:
                delta[key] = current_params[key]
        return delta
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to compute NumPy delta: {e}[/yellow]")
        return None


def _reconstruct_params_from_checkpoint(target_commit_hash: str, framework: str) -> tuple[dict, str] | None:
    """Reconstruct parameters by traversing back to checkpoint and applying deltas.
    
    Returns: (reconstructed_params, checkpoint_hash) or None if failed
    """
    console.print("[dim]Reconstructing parameters from checkpoint...[/dim]")
    
    # Traverse back to find CHECKPOINT commit
    current_hash = target_commit_hash
    checkpoint_hash = None
    traversal_stack = []
    
    # Build traversal stack until we find a CHECKPOINT
    while current_hash and current_hash != "_GENESIS_COMMIT_":
        commit_result = _get_commit_by_hash(current_hash)
        if not commit_result:
            console.print(f"[yellow]Warning: Commit {current_hash[:16]}... not found during traversal[/yellow]")
            break
        
        commit_data, _ = commit_result
        traversal_stack.append((current_hash, commit_data))
        
        if commit_data.get("commitType") == "CHECKPOINT":
            checkpoint_hash = current_hash
            break
        
        # Move to previous commit
        current_hash = commit_data.get("previousCommitHash")
    
    if not checkpoint_hash:
        console.print("[yellow]Warning: Could not find CHECKPOINT commit[/yellow]")
        return None
    
    console.print(f"[dim]Found CHECKPOINT at: {checkpoint_hash[:16]}...[/dim]")
    
    # Start from checkpoint and apply deltas
    checkpoint_commit_result = _get_commit_by_hash(checkpoint_hash)
    if not checkpoint_commit_result:
        console.print("[yellow]Warning: Could not load CHECKPOINT commit[/yellow]")
        return None
    
    checkpoint_data, checkpoint_dir = checkpoint_commit_result
    
    # Load full params from CHECKPOINT
    params_info = checkpoint_data.get("params")
    if not params_info or not params_info.get("file"):
        console.print("[yellow]Warning: CHECKPOINT has no params[/yellow]")
        return None
    
    params_file = checkpoint_dir / params_info["file"]
    if not params_file.exists():
        console.print(f"[yellow]Warning: CHECKPOINT params file not found: {params_file}[/yellow]")
        return None
    
    # Load checkpoint params
    if framework == "pytorch":
        current_params = _load_pytorch_params(params_file)
    else:
        current_params = _load_numpy_params(params_file)
    
    if current_params is None:
        return None
    
    console.print(f"[dim]Loaded CHECKPOINT params[/dim]")
    
    # Apply deltas in reverse order (from checkpoint toward target)
    traversal_stack.reverse()
    
    for i, (commit_hash, commit_data) in enumerate(traversal_stack[1:], 1):  # Skip checkpoint itself
        delta_info = commit_data.get("deltaParams")
        if not delta_info or not delta_info.get("file"):
            console.print(f"[yellow]Warning: No delta found for {commit_hash[:16]}..., cannot reconstruct[/yellow]")
            return None
        
        commit_result = _get_commit_by_hash(commit_hash)
        if not commit_result:
            continue
        
        _, commit_dir = commit_result
        delta_file = commit_dir / ".delta_params" / delta_info["file"]
        
        if not delta_file.exists():
            console.print(f"[yellow]Warning: Delta file not found: {delta_file}[/yellow]")
            return None
        
        # Load delta
        if framework == "pytorch":
            delta_params = _load_pytorch_params(delta_file)
        else:
            delta_params = _load_numpy_params(delta_file)
        
        if delta_params is None:
            return None
        
        # Apply delta
        if framework == "pytorch":
            for key in delta_params.keys():
                if key in current_params:
                    current_params[key] = current_params[key] + delta_params[key]
                else:
                    current_params[key] = delta_params[key]
        else:
            for key in delta_params.keys():
                if key in current_params:
                    current_params[key] = current_params[key] + delta_params[key]
                else:
                    current_params[key] = delta_params[key]
        
        console.print(f"[dim]Applied delta from {commit_hash[:16]}...[/dim]")
    
    console.print(f"[green]✓ Parameters reconstructed from CHECKPOINT[/green]")
    return (current_params, checkpoint_hash)


def _get_previous_full_params(previous_commit_hash: str, framework: str) -> dict | None:
    """Get or reconstruct previous commit's full parameters."""
    if previous_commit_hash == "_GENESIS_COMMIT_":
        return None
    
    # Try to get previous commit
    commit_result = _get_commit_by_hash(previous_commit_hash)
    if not commit_result:
        console.print(f"[yellow]Warning: Previous commit {previous_commit_hash[:16]}... not found[/yellow]")
        return None
    
    commit_data, commit_dir = commit_result
    
    # Check if full params exist
    params_info = commit_data.get("params")
    if params_info and params_info.get("file"):
        params_file = commit_dir / params_info["file"]
        if params_file.exists():
            console.print(f"[dim]Loading previous full params[/dim]")
            if framework == "pytorch":
                return _load_pytorch_params(params_file)
            else:
                return _load_numpy_params(params_file)
    
    # Full params missing, need to reconstruct
    console.print(f"[dim]Previous commit full params not found, reconstructing...[/dim]")
    result = _reconstruct_params_from_checkpoint(previous_commit_hash, framework)
    if result:
        reconstructed_params, _ = result
        return reconstructed_params
    
    return None


def _cleanup_old_full_params() -> int:
    """Delete full params from old DELTA commits, keeping only latest two commits.
    
    Returns: Number of commits cleaned
    """
    flair_dir = Path.cwd() / ".flair"
    local_commits_dir = flair_dir / ".local_commits"
    
    if not local_commits_dir.exists():
        return 0
    
    head_info = _get_head_info()
    if not head_info:
        return 0
    
    # Get the two most recent commits (previous and current being worked on)
    all_commits = sorted(local_commits_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    
    if len(all_commits) < 3:  # Nothing to clean if less than 3 commits
        return 0
    
    keep_commits = set()
    cleaned_count = 0
    
    # Keep the 2 most recent
    for i in range(min(2, len(all_commits))):
        commit_dir = all_commits[i]
        commit_file = commit_dir / "commit.json"
        if commit_file.exists():
            with open(commit_file, 'r') as f:
                commit_data = json.load(f)
                keep_commits.add(commit_dir.name)
    
    # Clean older DELTA commits (keep all CHECKPOINT)
    for i in range(2, len(all_commits)):
        commit_dir = all_commits[i]
        commit_file = commit_dir / "commit.json"
        
        if not commit_file.exists():
            continue
        
        with open(commit_file, 'r') as f:
            commit_data = json.load(f)
        
        # Only clean DELTA commits, keep CHECKPOINT
        if commit_data.get("commitType") != "DELTA":
            keep_commits.add(commit_dir.name)
            continue
        
        # Check if params file exists and delete it
        params_info = commit_data.get("params")
        if params_info and params_info.get("file"):
            params_file = commit_dir / params_info["file"]
            if params_file.exists():
                try:
                    params_file.unlink()
                    cleaned_count += 1
                    console.print(f"[dim]Cleaned full params from {commit_dir.name[:8]}...[/dim]")
                except Exception as e:
                    console.print(f"[yellow]Warning: Failed to delete {params_file}: {e}[/yellow]")
    
    return cleaned_count


def _compute_file_hash(file_path: Path) -> str:
    """Compute SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


@app.command()
def finalize(
    message: str = typer.Option("Update model", "-m", "--message", help="Commit message")
):
    """Finalize the commit.json file with message and determine commit type.
    
    Determines whether this is a CHECKPOINT (genesis/first) commit or a DELTA (subsequent) commit.
    For DELTA commits, computes parameter differences from previous commit.
    
    - CHECKPOINT: First commit in repository, stores full parameters
    - DELTA: Subsequent commits, stores delta + full params, cleans up old full params
    
    Prerequisites:
    - Run 'flair add' to create a local commit
    - Run 'flair params create' to add model parameters
    - Run 'flair zkp create' to generate zero-knowledge proof
    
    Examples:
      flair commit -m "Initial model commit"
      flair commit --message "Update with new training data"
    """
    try:
        # Check if we're in a Flair repository
        flair_dir = Path.cwd() / ".flair"
        if not flair_dir.exists():
            console.print("[red]Not in a Flair repository. Run 'flair init' first.[/red]")
            raise typer.Exit(code=1)
        
        # Get the latest local commit
        latest_commit = _get_latest_local_commit()
        if not latest_commit:
            console.print("[red]No local commits found. Run 'flair add' first.[/red]")
            raise typer.Exit(code=1)
        
        commit_data, commit_dir = latest_commit
        commit_hash = commit_data.get("commitHash")
        
        # Check prerequisites: params and zkp must exist
        if commit_data.get("params") is None:
            console.print("[red]✗ Missing model parameters.[/red]")
            console.print("[yellow]Run 'flair params create' first.[/yellow]")
            raise typer.Exit(code=1)
        
        if commit_data.get("zkp") is None:
            console.print("[red]✗ Missing zero-knowledge proof.[/red]")
            console.print("[yellow]Run 'flair zkp create' first.[/yellow]")
            raise typer.Exit(code=1)
        
        # Check if this commit has already been finalized
        if commit_data.get("message") is not None:
            console.print("[red]✗ This commit has already been finalized.[/red]")
            console.print(f"[yellow]Message: {commit_data.get('message')}[/yellow]")
            console.print("[yellow]To create a new commit, run 'flair add' first.[/yellow]")
            raise typer.Exit(code=1)
        
        # Determine commit type: CHECKPOINT for genesis, DELTA for subsequent
        is_genesis = _is_genesis_commit()
        commit_type = "CHECKPOINT" if is_genesis else "DELTA"
        
        console.print(f"\n[cyan]Finalizing {commit_type} commit...[/cyan]")
        
        # Get framework
        framework = commit_data.get("architecture", "pytorch").lower()
        
        # For DELTA commits, compute delta from previous
        if commit_type == "DELTA":
            head_info = _get_head_info()
            previous_commit_hash = head_info.get("previousCommit") if head_info else "_GENESIS_COMMIT_"
            
            if previous_commit_hash and previous_commit_hash != "_GENESIS_COMMIT_":
                console.print(f"[dim]Previous commit: {previous_commit_hash[:16]}...[/dim]")
                
                # Get current full params
                params_info = commit_data.get("params")
                if not params_info or not params_info.get("file"):
                    console.print("[red]✗ Current params info missing[/red]")
                    raise typer.Exit(code=1)
                
                current_params_file = commit_dir / params_info["file"]
                if not current_params_file.exists():
                    console.print(f"[red]✗ Current params file not found: {current_params_file}[/red]")
                    raise typer.Exit(code=1)
                
                # Load current full params
                if framework == "pytorch":
                    current_params = _load_pytorch_params(current_params_file)
                else:
                    current_params = _load_numpy_params(current_params_file)
                
                if current_params is None:
                    raise typer.Exit(code=1)
                
                # Get previous full params (or reconstruct if missing)
                previous_params = _get_previous_full_params(previous_commit_hash, framework)
                
                if previous_params is None:
                    console.print("[red]✗ Could not get or reconstruct previous parameters[/red]")
                    raise typer.Exit(code=1)
                
                # Compute delta
                console.print("[dim]Computing delta...[/dim]")
                if framework == "pytorch":
                    delta_params = _compute_pytorch_delta(current_params, previous_params)
                else:
                    delta_params = _compute_numpy_delta(current_params, previous_params)
                
                if delta_params is None:
                    raise typer.Exit(code=1)
                
                # Save delta
                delta_dir = commit_dir / ".delta_params"
                delta_dir.mkdir(exist_ok=True)
                
                if framework == "pytorch":
                    delta_file = delta_dir / "delta.pt"
                    success = _save_pytorch_params(delta_params, delta_file)
                else:
                    delta_file = delta_dir / "delta.npz"
                    success = _save_numpy_params(delta_params, delta_file)
                
                if not success:
                    raise typer.Exit(code=1)
                
                delta_hash = _compute_file_hash(delta_file)
                size_mb = delta_file.stat().st_size / (1024 * 1024)
                
                console.print(f"[green]✓ Delta computed and saved[/green]")
                console.print(f"  File: {delta_file.name}")
                console.print(f"  Size: {size_mb:.2f} MB")
                console.print(f"  Hash: {delta_hash[:16]}...")
                
                # Update commit.json with delta info
                commit_data["deltaParams"] = {
                    "file": delta_file.name,
                    "hash": delta_hash,
                    "previousCommitHash": previous_commit_hash
                }
        
        # Update commit.json with message and commitType
        commit_data["message"] = message
        commit_data["commitType"] = commit_type
        commit_data["status"] = "FINALIZED"
        
        commit_file = commit_dir / "commit.json"
        with open(commit_file, 'w') as f:
            json.dump(commit_data, f, indent=2)
        
        # Clean up old full params from DELTA commits
        if commit_type == "DELTA":
            console.print("\n[dim]Cleaning up old full parameters...[/dim]")
            cleaned = _cleanup_old_full_params()
            if cleaned > 0:
                console.print(f"[dim]Cleaned {cleaned} commit(s)[/dim]")
        
        console.print(f"\n[green]✓ Commit finalized[/green]")
        console.print(f"  Commit hash: {commit_hash[:16]}...")
        console.print(f"  Commit type: {commit_type}")
        console.print(f"  Message: {message}")
        
        if commit_type == "CHECKPOINT":
            console.print(f"  [dim]Uploading: full parameters (params)[/dim]")
        else:
            console.print(f"  [dim]Uploading: delta parameters (delta_params)[/dim]")
            console.print(f"  [dim]Retained: full parameters (for reconstruction)[/dim]")
        
        console.print(f"\n[dim]Next step:[/dim]")
        console.print(f"  Run 'flair push' to upload commit to repository")
        
    except typer.Exit:
        raise
    except Exception as e:
        console.print(f"[red]✗ Failed to finalize commit: {str(e)}[/red]")
        raise typer.Exit(code=1)
