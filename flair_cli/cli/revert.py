"""
Revert command: Revert to the previous commit (HEAD - 1).
Creates a new checkpoint commit with the parent's parameters.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json
import shutil
from uuid import uuid4

app = typer.Typer()
console = Console()


def _get_flair_dir() -> Path:
    """Get .flair directory in current repo."""
    flair_dir = Path.cwd() / ".flair"
    if not flair_dir.exists():
        raise typer.BadParameter("Not in a Flair repository. Run 'flair init' first.")
    return flair_dir


def _get_head_info() -> dict | None:
    """Get current HEAD information."""
    flair_dir = _get_flair_dir()
    head_file = flair_dir / "HEAD"
    
    if not head_file.exists():
        return None
    
    try:
        with open(head_file, 'r') as f:
            return json.load(f)
    except Exception:
        return None


def _get_commit_by_hash(commit_hash: str) -> tuple[dict, Path] | None:
    """Get commit data and directory by hash."""
    flair_dir = _get_flair_dir()
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


def _reconstruct_params_from_checkpoint(target_commit_hash: str, framework: str) -> dict | None:
    """Reconstruct parameters by traversing back to checkpoint and applying deltas.
    
    Returns: reconstructed_params or None if failed
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
    return current_params


def _get_parent_full_params(parent_commit_hash: str, framework: str) -> dict | None:
    """Get or reconstruct parent commit's full parameters."""
    if parent_commit_hash == "_GENESIS_COMMIT_":
        return None
    
    # Try to get parent commit
    commit_result = _get_commit_by_hash(parent_commit_hash)
    if not commit_result:
        console.print(f"[yellow]Warning: Parent commit {parent_commit_hash[:16]}... not found[/yellow]")
        return None
    
    commit_data, commit_dir = commit_result
    
    # Check if full params exist
    params_info = commit_data.get("params")
    if params_info and params_info.get("file"):
        params_file = commit_dir / params_info["file"]
        if params_file.exists():
            console.print(f"[dim]Loading parent full params[/dim]")
            if framework == "pytorch":
                return _load_pytorch_params(params_file)
            else:
                return _load_numpy_params(params_file)
    
    # Full params missing, need to reconstruct
    console.print(f"[dim]Parent full params not found, reconstructing...[/dim]")
    return _reconstruct_params_from_checkpoint(parent_commit_hash, framework)


@app.command()
def revert(
    target: str = typer.Argument("HEAD", help="Commit to revert (currently only 'HEAD' is supported)"),
    message: str = typer.Option(None, "-m", "--message", help="Custom revert commit message")
):
    """Revert to the previous commit.
    
    In v1, only supports reverting the latest commit (HEAD).
    Cannot revert arbitrary commits in history, as earlier model updates depend on later ones.
    
    Creates a new local checkpoint commit with the parent's parameters.
    The new commit:
    - Has the same parameters as the parent (HEAD - 1)
    - Becomes the new HEAD
    - Is stored locally and ready to push
    - Records which commit was reverted in metadata
    
    The original commits are NOT modified or deleted.
    
    Examples:
      flair revert          # Revert latest commit
      flair revert HEAD     # Same as above
      flair revert -m "Undo training error"  # Custom message
    """
    try:
        console.print("\n[cyan]Reverting latest commit...[/cyan]\n")
        
        # Check if we're in a Flair repository
        flair_dir = _get_flair_dir()
        
        # Get current HEAD info
        head_info = _get_head_info()
        if not head_info:
            console.print("[red]✗ No commits found. Cannot revert from genesis.[/red]")
            raise typer.Exit(code=1)
        
        # Validate that target is HEAD (in v1 we only support reverting HEAD)
        if target != "HEAD":
            console.print(f"[red]✗ Revert of '{target}' not supported in v1.[/red]")
            console.print("[yellow]Currently only 'flair revert HEAD' is supported.[/yellow]")
            raise typer.Exit(code=1)
        
        # Get current HEAD commit hash
        current_head_hash = head_info.get("latestCommitHash") or head_info.get("previousCommit")
        if not current_head_hash:
            console.print("[red]✗ Could not determine current HEAD commit.[/red]")
            raise typer.Exit(code=1)
        
        # Validate that current HEAD is not genesis
        current_commit_result = _get_commit_by_hash(current_head_hash)
        if not current_commit_result:
            console.print(f"[red]✗ Current HEAD commit not found: {current_head_hash[:16]}...[/red]")
            raise typer.Exit(code=1)
        
        current_commit_data, current_commit_dir = current_commit_result
        
        # Get parent commit hash from current commit
        parent_commit_hash = current_commit_data.get("previousCommitHash")
        if not parent_commit_hash or parent_commit_hash == "_GENESIS_COMMIT_":
            console.print("[red]✗ Cannot revert genesis commit.[/red]")
            console.print("[yellow]Genesis commit has no parent to revert to.[/yellow]")
            raise typer.Exit(code=1)
        
        console.print(f"[dim]Current HEAD: {current_head_hash[:16]}...[/dim]")
        console.print(f"[dim]Parent commit: {parent_commit_hash[:16]}...[/dim]\n")
        
        # Get repo config for framework
        repo_file = flair_dir / "repo.json"
        if not repo_file.exists():
            console.print("[red]Repository info not found.[/red]")
            raise typer.Exit(code=1)
        
        with open(repo_file, 'r') as f:
            repo_config = json.load(f)
        
        framework = repo_config.get("metadata", {}).get("framework") or repo_config.get("framework", "pytorch")
        framework = framework.lower()
        
        # Reconstruct or load parent's full parameters
        console.print("[cyan]Step 1/4: Loading parent parameters...[/cyan]")
        parent_params = _get_parent_full_params(parent_commit_hash, framework)
        if parent_params is None:
            console.print("[red]✗ Failed to load or reconstruct parent parameters[/red]")
            raise typer.Exit(code=1)
        
        console.print(f"[green]✓ Parent parameters loaded ({len(parent_params)} parameter(s))[/green]\n")
        
        # Create new commit directory
        console.print("[cyan]Step 2/4: Creating revert commit...[/cyan]")
        local_commits_dir = flair_dir / ".local_commits"
        local_commits_dir.mkdir(exist_ok=True)
        
        # Generate new commit hash
        revert_commit_hash = str(uuid4())
        revert_commit_dir = local_commits_dir / revert_commit_hash
        revert_commit_dir.mkdir(exist_ok=True)
        
        # Save parent's parameters as the revert commit's full params
        if framework == "pytorch":
            params_filename = "params.pt"
        else:
            params_filename = "params.npz"
        
        params_file = revert_commit_dir / params_filename
        
        if framework == "pytorch":
            success = _save_pytorch_params(parent_params, params_file)
        else:
            success = _save_numpy_params(parent_params, params_file)
        
        if not success:
            console.print("[red]✗ Failed to save parameters[/red]")
            raise typer.Exit(code=1)
        
        size_mb = params_file.stat().st_size / (1024 * 1024)
        console.print(f"[green]✓ Revert commit directory created[/green]")
        console.print(f"  Path: {revert_commit_dir}")
        console.print(f"  Params saved: {params_filename} ({size_mb:.2f} MB)\n")
        
        # Copy parent's ZKP files to revert commit (proof is same since parameters are same)
        console.print("[cyan]Step 3/4: Copying ZKP files...[/cyan]")
        parent_commit_result = _get_commit_by_hash(parent_commit_hash)
        if not parent_commit_result:
            console.print("[red]✗ Parent commit not found[/red]")
            raise typer.Exit(code=1)
        
        _, parent_commit_dir = parent_commit_result
        parent_commit_data, _ = parent_commit_result
        
        zkp_info = parent_commit_data.get("zkp")
        zkp_copied = False
        
        if zkp_info:
            try:
                # Copy ZKP files from parent
                proof_file = parent_commit_dir / zkp_info.get("proof_file", "proof.zlib")
                vk_file = parent_commit_dir / zkp_info.get("verification_key_file", "verification_key.zlib")
                settings_file = parent_commit_dir / zkp_info.get("settings_file", "settings.zlib")
                
                if all([proof_file.exists(), vk_file.exists(), settings_file.exists()]):
                    # Copy files to revert commit directory
                    shutil.copy2(proof_file, revert_commit_dir / proof_file.name)
                    shutil.copy2(vk_file, revert_commit_dir / vk_file.name)
                    shutil.copy2(settings_file, revert_commit_dir / settings_file.name)
                    
                    zkp_copied = True
                    console.print(f"[green]✓ ZKP files copied from parent[/green]\n")
                else:
                    console.print(f"[yellow]⚠ Parent ZKP files incomplete, will need ZKP generation[/yellow]\n")
            except Exception as e:
                console.print(f"[yellow]⚠ Failed to copy ZKP files: {e}[/yellow]\n")
        else:
            console.print(f"[yellow]⚠ Parent has no ZKP info, will need ZKP generation[/yellow]\n")
        
        # Create commit.json for revert commit
        console.print("[cyan]Step 4/4: Finalizing revert commit...[/cyan]")
        
        # Determine default message
        if not message:
            message = f"Revert {current_head_hash[:16]}"
        
        revert_commit_data = {
            "commitHash": revert_commit_hash,
            "architecture": framework,
            "params": {
                "file": params_filename,
                "hash": None  # Could compute hash if needed
            },
            "deltaParams": None,  # Revert commits are always checkpoints, no delta
            "zkp": zkp_info if zkp_copied else None,
            "message": message,
            "commitType": "CHECKPOINT",
            "status": "FINALIZED",
            "createdAt": None,
            "previousCommitHash": current_head_hash,
            "metadata": {
                "reverts": current_head_hash
            }
        }
        
        commit_file = revert_commit_dir / "commit.json"
        with open(commit_file, 'w') as f:
            json.dump(revert_commit_data, f, indent=2)
        
        console.print(f"[green]✓ Commit finalized[/green]\n")
        
        # Update HEAD to point to new revert commit
        new_head_data = {
            "currentBranch": head_info.get("currentBranch", "main"),
            "branchHash": head_info.get("branchHash"),
            "latestCommitHash": revert_commit_hash,
            "previousCommit": revert_commit_hash
        }
        
        head_file = flair_dir / "HEAD"
        with open(head_file, 'w') as f:
            json.dump(new_head_data, f, indent=2)
        
        console.print("[bold green]═══════════════════════════════════[/bold green]")
        console.print(f"[bold green]✓ Revert successful![/bold green]")
        console.print(f"[bold green]═══════════════════════════════════[/bold green]\n")
        console.print(f"[green]Reverted latest commit {current_head_hash[:16]}...[/green]")
        console.print(f"[green]Created compensating checkpoint commit {revert_commit_hash[:16]}...[/green]\n")
        
        console.print("[cyan]Summary:[/cyan]")
        console.print(f"  [dim]Reverted commit: {current_head_hash[:16]}...[/dim]")
        console.print(f"  [dim]New HEAD: {revert_commit_hash[:16]}...[/dim]")
        console.print(f"  [dim]Commit type: CHECKPOINT[/dim]")
        console.print(f"  [dim]Message: {message}[/dim]")
        console.print(f"  [dim]Metadata: {{'reverts': '{current_head_hash[:16]}...'}}[/dim]\n")
        
        if not zkp_copied:
            console.print("[yellow]Note: ZKP files were not available, you will need to regenerate them[/yellow]")
            console.print("[yellow]before pushing this commit. Run 'flair zkp create' when ready.[/yellow]\n")
        
        console.print("[dim]Next steps:[/dim]")
        if zkp_copied:
            console.print("  Run 'flair push' to upload the revert commit to remote")
        else:
            console.print("  Run 'flair zkp create' to generate proof")
            console.print("  Then run 'flair push' to upload the revert commit to remote")
        
    except typer.Exit:
        raise
    except Exception as e:
        console.print(f"[red]✗ Revert failed: {str(e)}[/red]")
        raise typer.Exit(code=1)
