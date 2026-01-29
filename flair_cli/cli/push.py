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
    """Push a commit to remote repository.
    
    Prerequisites:
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
        # Get the latest local commit
        local_commit_result = _get_latest_local_commit()
        if not local_commit_result:
            console.print("[red]✗ No local commits found. Run 'flair add' first.[/red]")
            raise typer.Exit(code=1)
        
        local_commit_data, commit_dir = local_commit_result
        commit_hash = local_commit_data.get("commitHash")
        
        # Check if commit is finalized
        if local_commit_data.get("message") is None:
            console.print("[red]✗ Commit not finalized.[/red]")
            console.print("[yellow]Run 'flair commit -m \"your message\"' first.[/yellow]")
            raise typer.Exit(code=1)
        
        message = local_commit_data.get("message")
        commit_type = local_commit_data.get("commitType", "CHECKPOINT")
        
        # Validate prerequisites
        params_file = _get_params_file(commit_type)
        if not params_file:
            if commit_type == "DELTA":
                console.print("[red]✗ No delta params file found. Run 'flair params create' first.[/red]")
            else:
                console.print("[red]✗ No params file found. Run 'flair params create' first.[/red]")
            raise typer.Exit(code=1)
        
        zkp_files = _get_zkp_files()
        if not zkp_files:
            console.print("[red]✗ No ZKP proof found. Run 'flair zkp create' first.[/red]")
            raise typer.Exit(code=1)
        
        # Load repo config
        repo_config = _load_repo_config()
        repo_hash = repo_config.get("repoHash")
        
        if not repo_hash:
            console.print("[red]Repository hash not found in config.[/red]")
            raise typer.Exit(code=1)
        
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
        
        # Determine parent commit hash
        parent_commit_hash = "_GENESIS_COMMIT_"
        if head_info and head_info.get("previousCommit"):
            parent_commit_hash = head_info["previousCommit"]
        
        console.print(f"[dim]Parent commit: {parent_commit_hash[:16] if parent_commit_hash != '_GENESIS_COMMIT_' else 'Genesis'}[/dim]")
        
        # Step 1: Initiate commit session
        console.print("\n[cyan]Step 1/5: Initiating commit session...[/cyan]")
        with _client_with_auth() as client:
            base_url = _base_url()
            init_resp = client.post(
                f"{base_url}/repos/{repo_hash}/branches/{branch_hash}/commits/create/initiate",
                json={"parentCommitHash": parent_commit_hash}
            )
            init_resp.raise_for_status()
            init_data = init_resp.json()
        
        session_id = init_data.get("sessionId")
        initiate_token = init_data.get("initiateToken")
        
        if not session_id or not initiate_token:
            console.print("[red]Failed to initiate commit session[/red]")
            raise typer.Exit(code=1)
        
        console.print(f"[green]✓ Session initiated[/green]")
        
        # Step 2: Check ZKML proof uniqueness
        console.print("[cyan]Step 2/5: Checking ZKML proof uniqueness...[/cyan]")
        with _client_with_auth() as client:
            zkml_check_resp = client.post(
                f"{base_url}/repos/{repo_hash}/branches/{branch_hash}/commits/create/zkml-check",
                json={
                    "sessionId": session_id,
                    "initiateToken": initiate_token,
                    "proofCid": zkp_files["proof_cid"],
                    "settingsCid": zkp_files["settings_cid"],
                    "vkCid": zkp_files["vk_cid"]
                }
            )
            zkml_check_resp.raise_for_status()
            zkml_check_data = zkml_check_resp.json()
        
        zkml_token = zkml_check_data.get("zkmlToken")
        if not zkml_token:
            console.print("[red]Failed to verify ZKML uniqueness[/red]")
            raise typer.Exit(code=1)
        
        console.print(f"[green]✓ ZKML proof verified as unique[/green]")
        
        # Step 3: Upload ZKML proofs
        console.print("[cyan]Step 3/5: Uploading ZKML proofs...[/cyan]")
        with _client_with_auth() as client:
            with open(zkp_files["proof_file"], 'rb') as pf, \
                 open(zkp_files["vk_file"], 'rb') as vkf, \
                 open(zkp_files["settings_file"], 'rb') as sf:
                
                files = {
                    'proof': ('proof.zlib', pf, 'application/octet-stream'),
                    'verification_key': ('verification_key.zlib', vkf, 'application/octet-stream'),
                    'settings': ('settings.zlib', sf, 'application/octet-stream')
                }
                
                data = {
                    'sessionId': session_id,
                    'initiateToken': initiate_token,
                    'zkmlToken': zkml_token
                }
                
                zkml_upload_resp = client.post(
                    f"{base_url}/repos/{repo_hash}/branches/{branch_hash}/commits/create/zkml-upload",
                    files=files,
                    data=data
                )
                zkml_upload_resp.raise_for_status()
                zkml_upload_data = zkml_upload_resp.json()
        
        zkml_receipt_token = zkml_upload_data.get("zkmlReceiptToken")
        if not zkml_receipt_token:
            console.print("[red]Failed to upload ZKML proofs[/red]")
            raise typer.Exit(code=1)
        
        console.print(f"[green]✓ ZKML proofs uploaded[/green]")
        
        # Step 4: Upload parameters
        console.print("[cyan]Step 4/5: Uploading parameters...[/cyan]")
        param_hash = _compute_param_hash(params_file)
        
        with _client_with_auth() as client:
            with open(params_file, 'rb') as pf:
                files = {
                    'params': (params_file.name, pf, 'application/octet-stream')
                }
                
                data = {
                    'sessionId': session_id,
                    'initiateToken': initiate_token,
                    'zkmlReceiptToken': zkml_receipt_token
                }
                
                params_upload_resp = client.post(
                    f"{base_url}/repos/{repo_hash}/branches/{branch_hash}/commits/create/params-upload",
                    files=files,
                    data=data
                )
                params_upload_resp.raise_for_status()
                params_upload_data = params_upload_resp.json()
        
        params_receipt_token = params_upload_data.get("paramsReceiptToken")
        if not params_receipt_token:
            console.print("[red]Failed to upload parameters[/red]")
            raise typer.Exit(code=1)
        
        console.print(f"[green]✓ Parameters uploaded (hash: {param_hash[:16]})[/green]")
        
        # Step 5: Finalize commit
        console.print("[cyan]Step 5/5: Finalizing commit...[/cyan]")
        
        framework = repo_config.get("framework", "unknown")
        
        with _client_with_auth() as client:
            finalize_resp = client.post(
                f"{base_url}/repos/{repo_hash}/branches/{branch_hash}/commits/create/finalize",
                json={
                    "commitHash": commit_hash,
                    "message": message,
                    "paramHash": param_hash,
                    "architecture": framework,
                    "commitType": commit_type,
                    "initiateToken": initiate_token,
                    "zkmlReceiptToken": zkml_receipt_token,
                    "paramsReceiptToken": params_receipt_token
                }
            )
            finalize_resp.raise_for_status()
            finalize_data = finalize_resp.json()
        
        returned_commit_hash = finalize_data.get("commitHash")
        if not returned_commit_hash:
            console.print("[red]Failed to finalize commit[/red]")
            raise typer.Exit(code=1)
        
        if returned_commit_hash != commit_hash:
            console.print("[yellow]Warning: Returned commit hash doesn't match sent commit hash[/yellow]")
        
        console.print(f"\n[green]✓ Commit created successfully![/green]")
        console.print(f"  Commit hash: {commit_hash[:16]}...")
        console.print(f"  Branch: {target_branch_name}")
        console.print(f"  Message: {message}")
        
        # Update HEAD
        flair_dir = _get_flair_dir()
        head_file = flair_dir / "HEAD"
        head_data = {
            "currentBranch": target_branch_name,
            "branchHash": branch_hash,
            "previousCommit": commit_hash
        }
        with open(head_file, "w") as f:
            json.dump(head_data, f, indent=2)
        
        console.print(f"\n[dim]Run 'flair status' to see your commit[/dim]")
        
    except httpx.HTTPStatusError as e:
        error_detail = e.response.json() if e.response.content else {}
        console.print(f"[red]HTTP Error: {e.response.status_code}[/red]")
        console.print(f"[red]{error_detail.get('error', {}).get('message', str(e))}[/red]")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[red]✗ Push failed: {str(e)}[/red]")
        raise typer.Exit(code=1)
