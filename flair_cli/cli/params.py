"""
Params command: Extract and create model parameters for a commit.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json
import hashlib

app = typer.Typer()
console = Console()


def _detect_model_files() -> list[Path]:
    """Detect model files in current directory."""
    model_extensions = [
        "*.pt", "*.pth",  # PyTorch
        "*.h5", "*.keras",  # TensorFlow/Keras
        "*.onnx",  # ONNX
        "*.pb",  # TensorFlow SavedModel
    ]
    
    found_files = []
    for pattern in model_extensions:
        found_files.extend(Path.cwd().glob(pattern))
    
    return sorted(found_files)


def _detect_framework(model_path: Path) -> str | None:
    """Detect model framework from file extension."""
    ext = model_path.suffix.lower()
    
    if ext in [".pt", ".pth"]:
        return "pytorch"
    elif ext in [".h5", ".keras"]:
        return "tensorflow"
    elif ext == ".onnx":
        return "onnx"
    elif ext == ".pb":
        return "tensorflow"
    
    return None


def _extract_pytorch_weights(model_path: Path, output_path: Path) -> bool:
    """Extract weights from PyTorch model."""
    try:
        import torch
        
        console.print(f"[dim]Loading PyTorch model from {model_path.name}...[/dim]")
        
        # Load the model
        checkpoint = torch.load(model_path, map_location="cpu")
        
        # Extract state dict (could be direct state_dict or nested in checkpoint)
        if isinstance(checkpoint, dict):
            if "state_dict" in checkpoint:
                state_dict = checkpoint["state_dict"]
            elif "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            else:
                # Assume the dict itself is the state dict
                state_dict = checkpoint
        else:
            # Model object itself
            if hasattr(checkpoint, "state_dict"):
                state_dict = checkpoint.state_dict()
            else:
                console.print("[red]Could not extract state dict from model[/red]")
                return False
        
        # Save extracted weights
        console.print(f"[dim]Extracting {len(state_dict)} parameters...[/dim]")
        torch.save(state_dict, output_path)
        
        size_mb = output_path.stat().st_size / (1024 * 1024)
        console.print(f"[green]✓ PyTorch weights extracted ({size_mb:.2f} MB)[/green]")
        return True
        
    except ImportError:
        console.print("[red]PyTorch not installed. Install with: pip install torch[/red]")
        return False
    except Exception as e:
        console.print(f"[red]Failed to extract PyTorch weights: {e}[/red]")
        return False


def _extract_tensorflow_weights(model_path: Path, output_path: Path) -> bool:
    """Extract weights from TensorFlow/Keras model."""
    try:
        import tensorflow as tf
        import numpy as np
        
        console.print(f"[dim]Loading TensorFlow model from {model_path.name}...[/dim]")
        
        # Load the model
        model = tf.keras.models.load_model(model_path)
        
        # Extract weights as numpy arrays
        weights = model.get_weights()
        
        console.print(f"[dim]Extracting {len(weights)} weight arrays...[/dim]")
        
        # Save weights as numpy arrays
        np.savez(output_path.with_suffix('.npz'), *weights)
        
        size_mb = output_path.with_suffix('.npz').stat().st_size / (1024 * 1024)
        console.print(f"[green]✓ TensorFlow weights extracted ({size_mb:.2f} MB)[/green]")
        return True
        
    except ImportError:
        console.print("[red]TensorFlow not installed. Install with: pip install tensorflow[/red]")
        return False
    except Exception as e:
        console.print(f"[red]Failed to extract TensorFlow weights: {e}[/red]")
        return False


def _extract_onnx_weights(model_path: Path, output_path: Path) -> bool:
    """Extract weights from ONNX model."""
    try:
        import onnx
        import numpy as np
        
        console.print(f"[dim]Loading ONNX model from {model_path.name}...[/dim]")
        
        # Load the ONNX model
        model = onnx.load(str(model_path))
        
        # Extract initializers (weights)
        weights = {}
        for initializer in model.graph.initializer:
            weights[initializer.name] = onnx.numpy_helper.to_array(initializer)
        
        console.print(f"[dim]Extracting {len(weights)} parameters...[/dim]")
        
        # Save weights as numpy arrays
        np.savez(output_path.with_suffix('.npz'), **weights)
        
        size_mb = output_path.with_suffix('.npz').stat().st_size / (1024 * 1024)
        console.print(f"[green]✓ ONNX weights extracted ({size_mb:.2f} MB)[/green]")
        return True
        
    except ImportError:
        console.print("[red]ONNX not installed. Install with: pip install onnx[/red]")
        return False
    except Exception as e:
        console.print(f"[red]Failed to extract ONNX weights: {e}[/red]")
        return False


def _compute_file_hash(file_path: Path) -> str:
    """Compute SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


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


def _get_previous_commit_params(previous_commit_hash: str) -> Path | None:
    """Get params file from previous commit."""
    if previous_commit_hash == "_GENESIS_COMMIT_":
        return None
    
    flair_dir = Path.cwd() / ".flair"
    local_commits_dir = flair_dir / ".local_commits"
    
    if not local_commits_dir.exists():
        return None
    
    # Find the commit directory with matching hash
    for commit_dir in local_commits_dir.iterdir():
        if not commit_dir.is_dir():
            continue
        
        commit_file = commit_dir / "commit.json"
        if not commit_file.exists():
            continue
        
        try:
            with open(commit_file, 'r') as f:
                commit_data = json.load(f)
            
            if commit_data.get("commitHash") == previous_commit_hash:
                params_info = commit_data.get("params")
                if params_info and params_info.get("file"):
                    params_file = commit_dir / params_info["file"]
                    if params_file.exists():
                        return params_file
        except Exception:
            continue
    
    return None


def _compute_pytorch_delta(current_path: Path, previous_path: Path, output_path: Path) -> bool:
    """Compute delta between current and previous PyTorch parameters."""
    try:
        import torch
        
        console.print(f"[dim]Computing PyTorch parameter delta...[/dim]")
        
        # Load both parameter sets
        current_params = torch.load(current_path, map_location="cpu")
        previous_params = torch.load(previous_path, map_location="cpu")
        
        # Compute delta
        delta_params = {}
        for key in current_params.keys():
            if key in previous_params:
                delta_params[key] = current_params[key] - previous_params[key]
            else:
                # New parameter, include as-is
                delta_params[key] = current_params[key]
        
        # Save delta
        torch.save(delta_params, output_path)
        
        size_mb = output_path.stat().st_size / (1024 * 1024)
        console.print(f"[green]✓ PyTorch delta computed ({size_mb:.2f} MB)[/green]")
        return True
        
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to compute PyTorch delta: {e}[/yellow]")
        return False


def _compute_tensorflow_delta(current_path: Path, previous_path: Path, output_path: Path) -> bool:
    """Compute delta between current and previous TensorFlow parameters."""
    try:
        import numpy as np
        
        console.print(f"[dim]Computing TensorFlow parameter delta...[/dim]")
        
        # Load both parameter sets
        current_params = np.load(current_path)
        previous_params = np.load(previous_path)
        
        # Compute delta
        delta_params = {}
        for key in current_params.files:
            if key in previous_params.files:
                delta_params[key] = current_params[key] - previous_params[key]
            else:
                # New parameter, include as-is
                delta_params[key] = current_params[key]
        
        # Save delta
        np.savez(output_path, **delta_params)
        
        size_mb = output_path.stat().st_size / (1024 * 1024)
        console.print(f"[green]✓ TensorFlow delta computed ({size_mb:.2f} MB)[/green]")
        return True
        
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to compute TensorFlow delta: {e}[/yellow]")
        return False


def _compute_onnx_delta(current_path: Path, previous_path: Path, output_path: Path) -> bool:
    """Compute delta between current and previous ONNX parameters."""
    try:
        import numpy as np
        
        console.print(f"[dim]Computing ONNX parameter delta...[/dim]")
        
        # Load both parameter sets
        current_params = np.load(current_path)
        previous_params = np.load(previous_path)
        
        # Compute delta
        delta_params = {}
        for key in current_params.files:
            if key in previous_params.files:
                delta_params[key] = current_params[key] - previous_params[key]
            else:
                # New parameter, include as-is
                delta_params[key] = current_params[key]
        
        # Save delta
        np.savez(output_path, **delta_params)
        
        size_mb = output_path.stat().st_size / (1024 * 1024)
        console.print(f"[green]✓ ONNX delta computed ({size_mb:.2f} MB)[/green]")
        return True
        
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to compute ONNX delta: {e}[/yellow]")
        return False


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


@app.command()
def create(
    model: str = typer.Option(None, "--model", help="Path to model file"),
):
    """Extract model weights and save as params for the latest local commit.
    
    Automatically detects PyTorch, TensorFlow, or ONNX models.
    Saves params to the latest local commit directory.
    
    Examples:
      flair params create                  # Auto-detect model
      flair params create --model model.pt # Specify model file
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
        
        # Check if params already exist in this commit
        if commit_data.get("params") is not None:
            console.print("[red]✗ This commit already has parameters.[/red]")
            console.print("[yellow]To create a new commit with different parameters, run 'flair add' first.[/yellow]")
            raise typer.Exit(code=1)
        
        commit_hash = commit_data.get("commitHash")
        if not commit_hash:
            console.print("[red]Invalid commit data.[/red]")
            raise typer.Exit(code=1)
        
        # Determine model file
        model_path = None
        
        if model:
            model_path = Path(model)
            if not model_path.exists():
                console.print(f"[red]Model file not found: {model}[/red]")
                raise typer.Exit(code=1)
        else:
            # Auto-detect model files
            found_models = _detect_model_files()
            
            if not found_models:
                console.print("[red]No model files found in current directory[/red]")
                console.print("[dim]Supported formats: .pt, .pth, .h5, .keras, .onnx, .pb[/dim]")
                raise typer.Exit(code=1)
            
            if len(found_models) == 1:
                model_path = found_models[0]
                console.print(f"[dim]Found model: {model_path.name}[/dim]")
            else:
                console.print(f"[yellow]Found {len(found_models)} model files:[/yellow]")
                for i, file in enumerate(found_models, 1):
                    console.print(f"  {i}. {file.name}")
                
                selection = typer.prompt("Select file number", type=int)
                if selection < 1 or selection > len(found_models):
                    console.print("[red]Invalid selection[/red]")
                    raise typer.Exit(code=1)
                
                model_path = found_models[selection - 1]
        
        # Detect framework
        framework = _detect_framework(model_path)
        if not framework:
            console.print(f"[red]Unsupported model format: {model_path.suffix}[/red]")
            raise typer.Exit(code=1)
        
        console.print(f"[dim]Detected framework: {framework}[/dim]")
        
        # Prepare output path in the commit directory
        if framework == "pytorch":
            output_path = commit_dir / "params.pt"
        else:
            output_path = commit_dir / "params.npz"
        
        # Extract weights based on framework
        success = False
        if framework == "pytorch":
            success = _extract_pytorch_weights(model_path, output_path)
        elif framework == "tensorflow":
            success = _extract_tensorflow_weights(model_path, output_path)
        elif framework == "onnx":
            success = _extract_onnx_weights(model_path, output_path)
        
        if success:
            # Compute hash of params file
            params_hash = _compute_file_hash(output_path)
            
            # Compute delta parameters if there's a previous commit
            head_info = _get_head_info()
            previous_commit_hash = None
            delta_params_info = None
            
            if head_info:
                previous_commit_hash = head_info.get("previousCommit", "_GENESIS_COMMIT_")
            else:
                previous_commit_hash = "_GENESIS_COMMIT_"
            
            if previous_commit_hash and previous_commit_hash != "_GENESIS_COMMIT_":
                console.print(f"\n[cyan]Computing delta from previous commit...[/cyan]")
                console.print(f"[dim]Previous commit: {previous_commit_hash[:16]}...[/dim]")
                
                # Get previous commit's params
                previous_params_path = _get_previous_commit_params(previous_commit_hash)
                
                if previous_params_path:
                    # Create .delta_params directory in commit folder
                    delta_dir = commit_dir / ".delta_params"
                    delta_dir.mkdir(exist_ok=True)
                    
                    # Determine delta output path based on framework
                    if framework == "pytorch":
                        delta_output_path = delta_dir / "delta.pt"
                    else:
                        delta_output_path = delta_dir / "delta.npz"
                    
                    # Compute delta based on framework
                    delta_success = False
                    if framework == "pytorch":
                        delta_success = _compute_pytorch_delta(output_path, previous_params_path, delta_output_path)
                    elif framework == "tensorflow":
                        delta_success = _compute_tensorflow_delta(output_path, previous_params_path, delta_output_path)
                    elif framework == "onnx":
                        delta_success = _compute_onnx_delta(output_path, previous_params_path, delta_output_path)
                    
                    if delta_success:
                        # Compute hash of delta file
                        delta_hash = _compute_file_hash(delta_output_path)
                        delta_params_info = {
                            "file": delta_output_path.name,
                            "hash": delta_hash,
                            "previousCommitHash": previous_commit_hash
                        }
                        console.print(f"[dim]Delta file: {delta_output_path.name}[/dim]")
                        console.print(f"[dim]Delta hash: {delta_hash[:16]}...[/dim]")
                else:
                    console.print(f"[yellow]Warning: Previous commit params not found locally. Skipping delta computation.[/yellow]")
            else:
                console.print(f"\n[dim]First commit (genesis) - no delta computed[/dim]")
            
            # Update commit.json with params information
            commit_file = commit_dir / "commit.json"
            with open(commit_file, 'r') as f:
                commit_data = json.load(f)
            
            commit_data["params"] = {
                "file": output_path.name,
                "hash": params_hash,
                "framework": framework
            }
            
            # Add delta params info if available
            if delta_params_info:
                commit_data["deltaParams"] = delta_params_info
            
            with open(commit_file, 'w') as f:
                json.dump(commit_data, f, indent=2)
            
            console.print(f"\n[green]✓ Parameters saved to commit directory[/green]")
            console.print(f"  File: {output_path.name}")
            console.print(f"  Hash: {params_hash[:16]}...")
            if delta_params_info:
                console.print(f"  Delta: {delta_params_info['file']}")
            console.print(f"\n[dim]Next steps:[/dim]")
            console.print(f"  1. (Optional) Run 'flair zkp create' to generate zero-knowledge proof")
            console.print(f"  2. Run 'flair push -m \"Your message\"' to push to repository")
        else:
            raise typer.Exit(code=1)
            
    except Exception as e:
        console.print(f"[red]✗ Failed to create params: {str(e)}[/red]")
        raise typer.Exit(code=1)
