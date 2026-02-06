"""
Push command: Create and upload a commit to remote repository.
Follows the 4-step commit creation flow with ZKML proofs.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json
import httpx
import hashlib
import shutil

from ..api import client as api_client
from ..api.utils import _base_url, _client_with_auth
from ..core import session

app = typer.Typer()
console = Console()


def _get_flair_dir() -> Path:
    """Get .flair directory in current repo."""
    flair_dir = Path.cwd() / ".flair"
    if not flair_dir.exists():
        raise typer.BadParameter("Not in a Flair repository. Run 'flair init' first.")
    return flair_dir


def _get_latest_local_commit() -> tuple[dict, Path] | None:
    """Get the latest local commit and its directory."""
    flair_dir = _get_flair_dir()
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
            commit_data = json.load(f)
        return (commit_data, commit_dir)
    
    return None


def _get_all_local_commits() -> list[tuple[dict, Path]]:
    """Get all local commits sorted by creation time (oldest first)."""
    flair_dir = _get_flair_dir()
    local_commits_dir = flair_dir / ".local_commits"
    
    if not local_commits_dir.exists():
        return []
    
    # Get all commit directories sorted by creation time (oldest first)
    commit_dirs = sorted(local_commits_dir.iterdir(), key=lambda p: p.stat().st_mtime)
    
    commits = []
    for commit_dir in commit_dirs:
        commit_file = commit_dir / "commit.json"
        if commit_file.exists():
            try:
                with open(commit_file, 'r') as f:
                    commit_data = json.load(f)
                commits.append((commit_data, commit_dir))
            except Exception:
                continue
    
    return commits


def _is_commit_complete(commit_data: dict, commit_dir: Path) -> bool:
    """Check if a commit is complete (has params, ZKP, and finalized message)."""
    # Check if message exists (finalized with flair commit -m)
    if not commit_data.get("message"):
        return False
    
    # Check if commitType exists (set during finalization)
    if not commit_data.get("commitType"):
        return False
    
    # Check if params exist
    params_info = commit_data.get("params")
    if not params_info or not params_info.get("file"):
        return False
    
    params_file = commit_dir / params_info["file"]
    if not params_file.exists():
        return False
    
    # Check if ZKP files exist
    zkp_info = commit_data.get("zkp")
    if not zkp_info:
        return False
    
    proof_file = commit_dir / zkp_info.get("proof_file", "proof.zlib")
    vk_file = commit_dir / zkp_info.get("verification_key_file", "verification_key.zlib")
    settings_file = commit_dir / zkp_info.get("settings_file", "settings.zlib")
    
    if not all([proof_file.exists(), vk_file.exists(), settings_file.exists()]):
        return False
    
    return True


def _get_remote_latest_commit(repo_hash: str, branch_hash: str) -> str | None:
    """Get the latest commit hash from remote branch."""
    try:
        with _client_with_auth() as client:
            response = client.get(
                f"{_base_url()}/api/repo/hash/{repo_hash}/branch/hash/{branch_hash}/commit/latest"
            )
            response.raise_for_status()
            data = response.json().get("data", {})
            return data.get("commitHash")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            # Branch exists but has no commits yet
            return None
        raise
    except Exception:
        return None


def _garbage_collect_local_commits(retention_limit: int) -> int:
    """Delete local commits older than the retention limit.

    Returns: Number of commits deleted
    """
    if retention_limit <= 0:
        return 0

    flair_dir = _get_flair_dir()
    local_commits_dir = flair_dir / ".local_commits"

    if not local_commits_dir.exists():
        return 0

    commit_dirs = sorted(local_commits_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)

    if len(commit_dirs) <= retention_limit:
        return 0

    to_delete = commit_dirs[retention_limit:]
    deleted_count = 0

    for commit_dir in to_delete:
        try:
            shutil.rmtree(commit_dir)
            deleted_count += 1
        except Exception:
            continue

    return deleted_count


def _load_repo_config() -> dict:
    """Load repository configuration from .flair/repo_config.json"""
    flair_dir = _get_flair_dir()
    config_file = flair_dir / "repo_config.json"
    
    if not config_file.exists():
        raise typer.BadParameter("Repository configuration not found. Run 'flair init' first.")
    
    with open(config_file, 'r') as f:
        return json.load(f)


def _get_head_info() -> dict | None:
    """Get current branch and commit from .flair/HEAD"""
    flair_dir = _get_flair_dir()
    head_file = flair_dir / "HEAD"
    
    if not head_file.exists():
        return None
    
    try:
        with open(head_file, 'r') as f:
            return json.load(f)
    except Exception:
        return None


def _get_params_file(commit_type: str = "CHECKPOINT") -> Path | None:
    """Find params file in the latest local commit directory.
    
    Args:
        commit_type: Either "CHECKPOINT" (full params) or "DELTA" (delta params)
    
    Returns:
        Path to the appropriate params file, or None if not found
    """
    result = _get_latest_local_commit()
    if not result:
        return None
    
    commit_data, commit_dir = result
    
    if commit_type == "DELTA":
        # For DELTA commits, look for delta params
        delta_params_info = commit_data.get("deltaParams")
        if not delta_params_info or not delta_params_info.get("file"):
            return None
        
        delta_file = commit_dir / delta_params_info["file"]
        if delta_file.exists():
            return delta_file
    else:
        # For CHECKPOINT commits, use full params
        params_info = commit_data.get("params")
        if not params_info or not params_info.get("file"):
            return None
        
        params_file = commit_dir / params_info["file"]
        if params_file.exists():
            return params_file
    
    return None


def _get_zkp_files() -> dict | None:
    """Get ZKP proof files and metadata from the latest local commit directory."""
    result = _get_latest_local_commit()
    if not result:
        return None
    
    commit_data, commit_dir = result
    zkp_info = commit_data.get("zkp")
    
    if not zkp_info:
        return None
    
    proof_file = commit_dir / zkp_info.get("proof_file", "proof.zlib")
    vk_file = commit_dir / zkp_info.get("verification_key_file", "verification_key.zlib")
    settings_file = commit_dir / zkp_info.get("settings_file", "settings.zlib")
    
    if all([proof_file.exists(), vk_file.exists(), settings_file.exists()]):
        return {
            "proof_file": proof_file,
            "vk_file": vk_file,
            "settings_file": settings_file,
            "proof_cid": zkp_info.get("proof_cid"),
            "vk_cid": zkp_info.get("verification_key_cid"),
            "settings_cid": zkp_info.get("settings_cid"),
            "base_commit_hash": zkp_info.get("base_commit_hash")
        }
    
    return None


def _compute_param_hash(file_path: Path) -> str:
    """Compute SHA256 hash of params file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


@app.command()
def push(
    branch_name: str = typer.Argument(None, help="Branch name to push to"),
    upstream: str = typer.Option(None, "-u", "--set-upstream", help="Set upstream (always 'origin')")
):
    """Push commits to remote repository.
    
    Pushes all completed local commits serially to the remote branch.
    Skips incomplete commits (missing params, ZKP, or not finalized).
    
    Prerequisites (for each commit):
    - Run 'flair add' to create a local commit
    - Run 'flair params create' to add model parameters
    - Run 'flair zkp create' to generate zero-knowledge proof
    - Run 'flair commit -m "message"' to finalize the commit
    
    Examples:
        flair push -u origin main
        flair push main
        flair push  # Push to current branch
    """
    try:
        # Get all local commits sorted by creation time
        all_local_commits = _get_all_local_commits()
        if not all_local_commits:
            console.print("[red]No local commits found. Run 'flair add' first.[/red]")
            raise typer.Exit(1)
        
        # Load repo config
        repo_config = _load_repo_config()
        repo_hash = repo_config.get("repoHash")
        
        if not repo_hash:
            console.print("[red]Repository hash not found in config.[/red]")
            raise typer.Exit(1)
        
        # Get HEAD info
        head_info = _get_head_info()
        
        # Determine target branch
        target_branch_name = branch_name
        if not target_branch_name:
            if head_info:
                target_branch_name = head_info.get("currentBranch")
            else:
                target_branch_name = "main"  # Default to main
        
        console.print(f"\n[cyan]Pushing to branch: {target_branch_name}[/cyan]")
        
        # Get or create branch
        branch_data = None
        try:
            branch_data = api_client.get_branch_by_name(repo_hash, target_branch_name)
        except Exception:
            pass
        
        # If branch doesn't exist, create it
        if not branch_data or isinstance(branch_data, list):
            console.print(f"[yellow]Branch '{target_branch_name}' not found. Creating...[/yellow]")
            
            # If this is the first branch, create from null parent
            # Otherwise, create from current branch
            parent_branch_hash = None
            if head_info:
                parent_branch_hash = head_info.get("branchHash")
            
            try:
                branch_data = api_client.create_branch(
                    repo_hash,
                    target_branch_name,
                    parent_branch_hash,
                    f"Created via push command"
                )
                console.print(f"[green]✓ Branch '{target_branch_name}' created[/green]")
            except Exception as e:
                console.print(f"[red]Failed to create branch: {e}[/red]")
                raise typer.Exit(code=1)
        
        branch_id = branch_data.get("id") or branch_data.get("branchId")
        branch_hash = branch_data.get("branchHash")
        
        if not branch_id or not branch_hash:
            console.print("[red]Invalid branch data received[/red]")
            raise typer.Exit(code=1)
        
        # Get remote latest commit
        remote_head_hash = _get_remote_latest_commit(repo_hash, branch_hash)
        
        if remote_head_hash:
            console.print(f"[dim]Remote HEAD: {remote_head_hash[:16]}...[/dim]")
        else:
            console.print(f"[dim]Remote HEAD: Genesis (no commits yet)[/dim]")
        
        # Filter commits to push: only complete commits
        commits_to_push = []
        for commit_data, commit_dir in all_local_commits:
            if _is_commit_complete(commit_data, commit_dir):
                commits_to_push.append((commit_data, commit_dir))
            else:
                # Stop at first incomplete commit (being worked on)
                console.print(f"[dim]Skipping incomplete commit: {commit_data.get('commitHash', 'unknown')[:16]}...[/dim]")
                break
        
        if not commits_to_push:
            console.print("[yellow]No complete commits to push.[/yellow]")
            console.print("[dim]Ensure commits have params, ZKP, and are finalized with 'flair commit -m'.[/dim]")
            raise typer.Exit(0)
        
        # Find where to start pushing (after remote head)
        start_index = 0
        if remote_head_hash:
            for i, (commit_data, _) in enumerate(commits_to_push):
                if commit_data.get("commitHash") == remote_head_hash:
                    start_index = i + 1
                    break
        
        commits_to_push = commits_to_push[start_index:]
        
        if not commits_to_push:
            console.print("[green]✓ All commits already pushed. Branch is up to date.[/green]")
            raise typer.Exit(0)
        
        console.print(f"[cyan]Pushing {len(commits_to_push)} commit(s) serially...[/cyan]\n")
        
        # Determine initial parent commit hash
        parent_commit_hash = remote_head_hash if remote_head_hash else "_GENESIS_COMMIT_"
        
        # Push each commit serially
        framework = repo_config.get("framework", "unknown")
        pushed_count = 0
        
        for idx, (commit_data, commit_dir) in enumerate(commits_to_push, 1):
            commit_hash = commit_data.get("commitHash")
            message = commit_data.get("message")
            commit_type = commit_data.get("commitType", "CHECKPOINT")
            
            console.print(f"[bold cyan]═══ Commit {idx}/{len(commits_to_push)} ═══[/bold cyan]")
            console.print(f"[dim]Hash: {commit_hash[:16]}...[/dim]")
            console.print(f"[dim]Type: {commit_type}[/dim]")
            console.print(f"[dim]Message: {message}[/dim]")
            console.print(f"[dim]Parent: {parent_commit_hash[:16] if parent_commit_hash != '_GENESIS_COMMIT_' else 'Genesis'}...[/dim]\n")
            
            # Get params file for this commit
            params_info = commit_data.get("params")
            if commit_type == "DELTA":
                delta_params_info = commit_data.get("deltaParams")
                if not delta_params_info or not delta_params_info.get("file"):
                    console.print(f"[red]✗ Commit {idx}: Delta parameters missing[/red]")
                    continue
                params_file = commit_dir / delta_params_info["file"]
            else:
                if not params_info or not params_info.get("file"):
                    console.print(f"[red]✗ Commit {idx}: Parameters missing[/red]")
                    continue
                params_file = commit_dir / params_info["file"]
            
            if not params_file.exists():
                console.print(f"[red]✗ Commit {idx}: Parameters file not found[/red]")
                continue
            
            # Get ZKP files for this commit
            zkp_info = commit_data.get("zkp")
            if not zkp_info:
                console.print(f"[red]✗ Commit {idx}: ZKP info missing[/red]")
                continue
            
            proof_file = commit_dir / zkp_info.get("proof_file", "proof.zlib")
            vk_file = commit_dir / zkp_info.get("verification_key_file", "verification_key.zlib")
            settings_file = commit_dir / zkp_info.get("settings_file", "settings.zlib")
            
            if not all([proof_file.exists(), vk_file.exists(), settings_file.exists()]):
                console.print(f"[red]✗ Commit {idx}: ZKP files missing[/red]")
                continue
            
            zkp_files = {
                "proof_file": proof_file,
                "vk_file": vk_file,
                "settings_file": settings_file,
                "proof_cid": zkp_info.get("proof_cid"),
                "vk_cid": zkp_info.get("verification_key_cid"),
                "settings_cid": zkp_info.get("settings_cid"),
                "base_commit_hash": zkp_info.get("base_commit_hash")
            }
            
            # Step 1: Initiate commit session
            console.print("[cyan]Step 1/5: Initiating commit session...[/cyan]")
            with _client_with_auth() as client:
                response = client.post(
                    f"{_base_url()}/api/repo/hash/{repo_hash}/branch/hash/{branch_hash}/commit/create/initiate",
                    json={"parentCommitHash": parent_commit_hash}
                )
                response.raise_for_status()
                init_data = response.json()
            
            session_id = init_data.get("sessionId")
            initiate_token = init_data.get("initiateToken")
            
            if not session_id or not initiate_token:
                console.print(f"[red]✗ Commit {idx}: Failed to initiate session[/red]")
                continue
            
            console.print(f"[green]✓ Session initiated[/green]")
            
            # Step 2: Check ZKML proof uniqueness
            console.print("[cyan]Step 2/5: Checking ZKML proof uniqueness...[/cyan]")
            with _client_with_auth() as client:
                response = client.post(
                    f"{_base_url()}/api/repo/hash/{repo_hash}/branch/hash/{branch_hash}/commit/create/zkml-check",
                    json={
                        "sessionId": session_id,
                        "initiateToken": initiate_token,
                        "proofCid": zkp_files["proof_cid"],
                        "settingsCid": zkp_files["settings_cid"],
                        "vkCid": zkp_files["vk_cid"]
                    }
                )
                response.raise_for_status()
                zkml_check_data = response.json()
            
            zkml_token = zkml_check_data.get("zkmlToken")
            if not zkml_token:
                console.print(f"[red]✗ Commit {idx}: Failed to verify ZKML proof uniqueness[/red]")
                continue
            
            console.print(f"[green]✓ ZKML proof verified as unique[/green]")
            
            # Step 3: Upload ZKML proofs
            console.print("[cyan]Step 3/5: Uploading ZKML proofs...[/cyan]")
            with _client_with_auth() as client:
                files = {
                    "proof": ("proof.zlib", open(zkp_files["proof_file"], "rb"), "application/octet-stream"),
                    "settings": ("settings.zlib", open(zkp_files["settings_file"], "rb"), "application/octet-stream"),
                    "verification_key": ("verification_key.zlib", open(zkp_files["vk_file"], "rb"), "application/octet-stream")
                }
                data = {
                    "sessionId": session_id,
                    "initiateToken": initiate_token,
                    "zkmlToken": zkml_token
                }
                
                response = client.post(
                    f"{_base_url()}/api/repo/hash/{repo_hash}/branch/hash/{branch_hash}/commit/create/zkml-upload",
                    files=files,
                    data=data
                )
                response.raise_for_status()
                zkml_upload_data = response.json()
            
            zkml_receipt_token = zkml_upload_data.get("zkmlReceiptToken")
            if not zkml_receipt_token:
                console.print(f"[red]✗ Commit {idx}: Failed to upload ZKML proofs[/red]")
                continue
            
            console.print(f"[green]✓ ZKML proofs uploaded[/green]")
            
            # Step 4: Upload parameters
            console.print("[cyan]Step 4/5: Uploading parameters...[/cyan]")
            param_hash = _compute_param_hash(params_file)
            
            with _client_with_auth() as client:
                files = {
                    "params": (params_file.name, open(params_file, "rb"), "application/octet-stream")
                }
                data = {
                    "sessionId": session_id,
                    "initiateToken": initiate_token,
                    "zkmlReceiptToken": zkml_receipt_token,
                    "paramHash": param_hash
                }
                
                response = client.post(
                    f"{_base_url()}/api/repo/hash/{repo_hash}/branch/hash/{branch_hash}/commit/create/params-upload",
                    files=files,
                    data=data
                )
                response.raise_for_status()
                params_upload_data = response.json()
            
            params_receipt_token = params_upload_data.get("paramsReceiptToken")
            if not params_receipt_token:
                console.print(f"[red]✗ Commit {idx}: Failed to upload parameters[/red]")
                continue
            
            console.print(f"[green]✓ Parameters uploaded (hash: {param_hash[:16]}...)[/green]")
            
            # Step 5: Finalize commit
            console.print("[cyan]Step 5/5: Finalizing commit...[/cyan]")
            
            with _client_with_auth() as client:
                response = client.post(
                    f"{_base_url()}/api/repo/hash/{repo_hash}/branch/hash/{branch_hash}/commit/create/finalize",
                    json={
                        "sessionId": session_id,
                        "initiateToken": initiate_token,
                        "zkmlReceiptToken": zkml_receipt_token,
                        "paramsReceiptToken": params_receipt_token,
                        "message": message,
                        "architecture": framework
                    }
                )
                response.raise_for_status()
                finalize_data = response.json()
            
            returned_commit_hash = finalize_data.get("commitHash")
            if not returned_commit_hash:
                console.print(f"[red]✗ Commit {idx}: Finalization failed[/red]")
                continue
            
            console.print(f"[bold green]✓ Commit {idx} created successfully![/bold green]")
            console.print(f"  [dim]Hash: {returned_commit_hash[:16]}...[/dim]")
            console.print(f"  [dim]Type: {commit_type}[/dim]\n")
            
            # Update parent for next commit
            parent_commit_hash = returned_commit_hash
            pushed_count += 1
        
        # Summary
        console.print(f"[bold green]═══════════════════════════════════[/bold green]")
        console.print(f"[bold green]✓ Push complete![/bold green]")
        console.print(f"  [dim]Branch: {target_branch_name}[/dim]")
        console.print(f"  [dim]Commits pushed: {pushed_count}/{len(commits_to_push)}[/dim]")
        console.print(f"  [dim]Latest commit: {parent_commit_hash[:16]}...[/dim]")
        console.print(f"[bold green]═══════════════════════════════════[/bold green]")
        
        # Update .flair/HEAD with new commit hash
        if pushed_count > 0:
            flair_dir = _get_flair_dir()
            head_file = flair_dir / "HEAD"
            
            head_data = {
                "currentBranch": target_branch_name,
                "branchHash": branch_hash,
                "latestCommitHash": parent_commit_hash,
                "previousCommit": parent_commit_hash
            }
            
            with open(head_file, 'w') as f:
                json.dump(head_data, f, indent=2)
            
            console.print(f"\n[green]✓ HEAD updated[/green]")

            retention_limit = repo_config.get("commitRetentionLimit", 25)
            if isinstance(retention_limit, int) and retention_limit > 0:
                deleted_count = _garbage_collect_local_commits(retention_limit)
                if deleted_count > 0:
                    console.print(f"[dim]Garbage collected {deleted_count} old local commit(s)[/dim]")
        
    except httpx.HTTPStatusError as e:
        error_detail = e.response.json() if e.response.content else {}
        console.print(f"[red]HTTP Error: {e.response.status_code}[/red]")
        console.print(f"[red]{error_detail.get('error', {}).get('message', str(e))}[/red]")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]✗ Push failed: {str(e)}[/red]")
        raise typer.Exit(code=1)
