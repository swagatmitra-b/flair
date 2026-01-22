"""
Zero-Knowledge Proof (ZKP) commands for Flair CLI.
Creates and verifies ZKPs for models in different frameworks.

Supports:
- PyTorch models (.pt, .pth)
- TensorFlow models (.h5, .keras)
- ONNX models (.onnx)

Automatically converts models to ONNX format if needed before proof creation.
"""

from __future__ import annotations
import typer
from rich.console import Console
from rich.progress import Progress
from pathlib import Path
import json
import requests
import base64
import zlib
from datetime import datetime
from typing import Optional

from ..core import config as config_mod
from ..api import client as api_client

app = typer.Typer()
console = Console()


def _get_flair_dir() -> Path:
    """Get the .flair directory in current repo."""
    flair_dir = Path.cwd() / ".flair"
    if not flair_dir.exists():
        raise typer.BadParameter("Not in a Flair repository. Run 'flair init' first.")
    return flair_dir


def _get_zkp_dir() -> Path:
    """Get or create the .zkp directory inside .flair."""
    zkp_dir = _get_flair_dir() / ".zkp"
    zkp_dir.mkdir(parents=True, exist_ok=True)
    return zkp_dir


def _load_repo_config() -> dict:
    """Load repository configuration from .flair/repo_config.json"""
    flair_dir = _get_flair_dir()
    config_file = flair_dir / "repo_config.json"
    
    if not config_file.exists():
        raise typer.BadParameter(
            "Repository configuration not found. Run 'flair init' first."
        )
    
    with open(config_file, 'r') as f:
        return json.load(f)


def _find_model_file(framework: str) -> Optional[Path]:
    """Find a model file for the given framework in current directory."""
    extensions_map = {
        "pytorch": [".pt", ".pth"],
        "tensorflow": [".h5", ".keras"],
        "onnx": [".onnx"]
    }
    
    extensions = extensions_map.get(framework.lower(), [])
    for ext in extensions:
        files = list(Path.cwd().glob(f"*{ext}"))
        if files:
            return files[0]
    
    return None


def _convert_to_onnx(model_path: Path, framework: str) -> Path:
    """Convert a model to ONNX format if needed."""
    if model_path.suffix == ".onnx":
        return model_path
    
    console.print(f"\n[yellow]Converting {framework} model to ONNX format...[/yellow]")
    
    try:
        if framework.lower() == "pytorch":
            _pytorch_to_onnx(model_path)
        elif framework.lower() == "tensorflow":
            _tensorflow_to_onnx(model_path)
        else:
            raise ValueError(f"Unsupported framework: {framework}")
    except Exception as e:
        raise typer.BadParameter(
            f"Failed to convert model to ONNX: {str(e)}\n"
            "Make sure you have the required packages installed:\n"
            "  PyTorch: pip install torch onnx\n"
            "  TensorFlow: pip install tensorflow tf2onnx"
        )
    
    onnx_path = model_path.parent / f"{model_path.stem}.onnx"
    return onnx_path


def _pytorch_to_onnx(model_path: Path) -> None:
    """Convert PyTorch model to ONNX."""
    try:
        import torch
        import onnx
    except ImportError:
        raise ImportError("PyTorch or ONNX not installed. Install with: pip install torch onnx")
    
    try:
        model = torch.load(model_path, map_location='cpu')
        dummy_input = torch.randn(1, 3, 224, 224)  # Adjust based on your model
        
        onnx_path = model_path.parent / f"{model_path.stem}.onnx"
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            export_params=True,
            opset_version=12,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            verbose=False
        )
        console.print(f"[green]✓ Successfully converted to {onnx_path}[/green]")
    except Exception as e:
        raise RuntimeError(f"PyTorch to ONNX conversion failed: {str(e)}")


def _tensorflow_to_onnx(model_path: Path) -> None:
    """Convert TensorFlow model to ONNX."""
    try:
        import tf2onnx
        import tensorflow as tf
    except ImportError:
        raise ImportError("tf2onnx or TensorFlow not installed. Install with: pip install tf2onnx tensorflow")
    
    try:
        model = tf.keras.models.load_model(model_path)
        onnx_path = model_path.parent / f"{model_path.stem}.onnx"
        
        spec = (tf.TensorSpec((None, 224, 224, 3), tf.float32, name="input"),)
        output_path = str(onnx_path.parent / onnx_path.stem)
        
        model_proto, _ = tf2onnx.convert.from_keras(model, input_signature=spec, output_path=output_path)
        console.print(f"[green]✓ Successfully converted to {onnx_path}[/green]")
    except Exception as e:
        raise RuntimeError(f"TensorFlow to ONNX conversion failed: {str(e)}")


def _compress_and_encode(data: bytes) -> str:
    """Compress bytes with zlib and Base64-encode."""
    compressed = zlib.compress(data)
    return base64.b64encode(compressed).decode('utf-8')


def _decode_and_decompress(encoded_str: str) -> bytes:
    """Inverse of compress_and_encode."""
    decoded = base64.b64decode(encoded_str)
    return zlib.decompress(decoded)


def _get_zkml_server_url() -> str:
    """Get the ZKML server URL from config."""
    cfg = config_mod.load_config()
    # Use a ZKML server URL - default to localhost
    return "http://localhost:2003"


@app.command("create")
def create_zkp(
    model_path: Optional[str] = typer.Option(
        None,
        "--model",
        help="Path to model file (auto-detected if not provided)"
    ),
    input_dims: Optional[str] = typer.Option(
        "[1, 3, 224, 224]",
        "--input-dims",
        help="Input dimensions as JSON string (default: [1, 3, 224, 224])"
    ),
    backend: Optional[str] = typer.Option(
        None,
        "--backend",
        help="Backend: pytorch, tensorflow, or numpy (auto-detected from repo config)"
    )
):
    """Create a Zero-Knowledge Proof for the repository model.
    
    Automatically converts the model to ONNX format if needed, then generates
    a ZKP proof using the ZKML server. Results are saved in .flair/.zkp/
    
    Example:
        flair zkp create --input-dims "[1, 3, 224, 224]"
        flair zkp create --model model.pt --backend pytorch
    """
    try:
        # Load repo config
        repo_config = _load_repo_config()
        framework = repo_config.get("framework", "").lower()
        
        if not framework:
            raise typer.BadParameter(
                "Framework not found in repo config. Ensure repository was initialized properly."
            )
        
        # Determine backend
        backend_to_use = backend or framework
        if backend_to_use not in ("pytorch", "tensorflow", "numpy"):
            raise typer.BadParameter(
                f"Unsupported backend: {backend_to_use}. Use: pytorch, tensorflow, or numpy"
            )
        
        # Find model file
        model_file = None
        if model_path:
            model_file = Path(model_path)
            if not model_file.exists():
                raise typer.BadParameter(f"Model file not found: {model_path}")
        else:
            model_file = _find_model_file(framework)
            if not model_file:
                raise typer.BadParameter(
                    f"No {framework} model file found in current directory.\n"
                    f"Expected extensions: {_get_extensions_for_framework(framework)}\n"
                    f"Use --model to specify a custom path."
                )
        
        console.print(f"\n[cyan]Creating ZKP for model: {model_file.name}[/cyan]")
        console.print(f"[dim]Framework: {framework}[/dim]")
        
        # Convert to ONNX if needed
        onnx_file = _convert_to_onnx(model_file, framework)
        
        # Parse input dimensions
        try:
            dims = json.loads(input_dims)
        except json.JSONDecodeError:
            raise typer.BadParameter(f"Invalid JSON for input-dims: {input_dims}")
        
        # Prepare request
        zkp_dir = _get_zkp_dir()
        zkml_url = _get_zkml_server_url()
        
        with Progress() as progress:
            task = progress.add_task("[cyan]Uploading model to ZKML server...", total=100)
            
            try:
                with open(onnx_file, 'rb') as f:
                    files = {'file': (onnx_file.name, f, 'application/octet-stream')}
                    data = {
                        'dimensions': json.dumps({"input_dims": dims}),
                        'backend': backend_to_use
                    }
                    
                    response = requests.post(
                        f"{zkml_url}/upload",
                        files=files,
                        data=data,
                        timeout=600
                    )
                
                progress.update(task, completed=50)
                
                if response.status_code != 200:
                    raise RuntimeError(
                        f"ZKML server error ({response.status_code}): {response.text}"
                    )
                
                result = response.json()
                progress.update(task, completed=100)
                
            except requests.exceptions.ConnectionError:
                raise typer.BadParameter(
                    f"Could not connect to ZKML server at {zkml_url}\n"
                    f"Make sure the server is running: python zkml_server/app.py"
                )
        
        # Save proof artifacts
        console.print("\n[cyan]Saving proof artifacts...[/cyan]")
        
        proof_data = {
            "timestamp": datetime.now().isoformat(),
            "model_file": str(model_file),
            "framework": framework,
            "input_dims": dims,
            "proof": result.get('proof'),
            "verification_key": result.get('verification_key'),
            "settings": result.get('settings')
        }
        
        proof_file = zkp_dir / "proof.json"
        with open(proof_file, 'w') as f:
            json.dump(proof_data, f, indent=2)
        
        console.print(f"[green]✓ ZKP created successfully![/green]")
        console.print(f"[dim]Saved to: {proof_file}[/dim]")
        
        # Clean up ONNX file if it was converted
        if onnx_file != model_file and onnx_file.exists():
            onnx_file.unlink()
            console.print(f"[dim]Cleaned up temporary ONNX file[/dim]")
        
    except typer.BadParameter:
        raise
    except Exception as e:
        console.print(f"[red]✗ Error creating ZKP: {str(e)}[/red]")
        raise typer.Exit(code=1)


@app.command("verify")
def verify_zkp():
    """Verify a Zero-Knowledge Proof.
    
    Reads the proof from .flair/.zkp/proof.json and verifies it using
    the ZKML server. Results are saved to .flair/.zkp/.verified
    
    Example:
        flair zkp verify
    """
    try:
        zkp_dir = _get_zkp_dir()
        proof_file = zkp_dir / "proof.json"
        
        if not proof_file.exists():
            raise typer.BadParameter(
                f"No proof found. Run 'flair zkp create' first.\n"
                f"Expected: {proof_file}"
            )
        
        # Load proof data
        with open(proof_file, 'r') as f:
            proof_data = json.load(f)
        
        console.print("[cyan]Verifying Zero-Knowledge Proof...[/cyan]")
        console.print(f"[dim]Proof timestamp: {proof_data.get('timestamp')}[/dim]")
        
        # Prepare verification request
        zkml_url = _get_zkml_server_url()
        
        verify_payload = {
            "proof": proof_data.get('proof'),
            "verification_key": proof_data.get('verification_key'),
            "settings": proof_data.get('settings')
        }
        
        with Progress() as progress:
            task = progress.add_task("[cyan]Sending to ZKML server...", total=100)
            
            try:
                response = requests.post(
                    f"{zkml_url}/verify_proof",
                    json=verify_payload,
                    timeout=300
                )
                
                progress.update(task, completed=100)
                
            except requests.exceptions.ConnectionError:
                raise typer.BadParameter(
                    f"Could not connect to ZKML server at {zkml_url}\n"
                    f"Make sure the server is running: python zkml_server/app.py"
                )
        
        if response.status_code != 200:
            raise RuntimeError(
                f"ZKML server error ({response.status_code}): {response.text}"
            )
        
        result = response.json()
        verified = result.get('verified', False)
        
        # Save verification result
        verification_log = {
            "timestamp": datetime.now().isoformat(),
            "proof_timestamp": proof_data.get('timestamp'),
            "verified": verified,
            "model_file": proof_data.get('model_file'),
            "framework": proof_data.get('framework'),
            "input_dims": proof_data.get('input_dims')
        }
        
        verified_file = zkp_dir / ".verified"
        with open(verified_file, 'w') as f:
            json.dump(verification_log, f, indent=2)
        
        if verified:
            console.print(f"\n[green]✓ Proof verified successfully![/green]")
            console.print(f"[dim]Verification log saved to: {verified_file}[/dim]")
        else:
            console.print(f"\n[red]✗ Proof verification failed![/red]")
            console.print(f"[dim]Verification log saved to: {verified_file}[/dim]")
            raise typer.Exit(code=1)
        
    except typer.BadParameter:
        raise
    except Exception as e:
        console.print(f"[red]✗ Error verifying proof: {str(e)}[/red]")
        raise typer.Exit(code=1)


@app.command("status")
def status():
    """Show ZKP status for the current repository.
    
    Displays information about created proofs and verification status.
    """
    try:
        zkp_dir = _get_zkp_dir()
        proof_file = zkp_dir / "proof.json"
        verified_file = zkp_dir / ".verified"
        
        console.print(f"\n[cyan]ZKP Status for {Path.cwd().name}[/cyan]")
        console.print(f"[dim]Location: {zkp_dir}[/dim]\n")
        
        if not proof_file.exists():
            console.print("[yellow]No proofs created yet. Run 'flair zkp create'[/yellow]")
            return
        
        # Load and display proof info
        with open(proof_file, 'r') as f:
            proof_data = json.load(f)
        
        console.print("[cyan]Proof Information:[/cyan]")
        console.print(f"  Model: {proof_data.get('model_file')}")
        console.print(f"  Framework: {proof_data.get('framework')}")
        console.print(f"  Input Dims: {proof_data.get('input_dims')}")
        console.print(f"  Created: {proof_data.get('timestamp')}")
        
        # Load verification status
        if verified_file.exists():
            with open(verified_file, 'r') as f:
                verified_data = json.load(f)
            
            status_icon = "[green]✓[/green]" if verified_data.get('verified') else "[red]✗[/red]"
            console.print(f"\n[cyan]Verification Status: {status_icon}[/cyan]")
            console.print(f"  Verified: {verified_data.get('timestamp')}")
        else:
            console.print("\n[yellow]Not yet verified. Run 'flair zkp verify'[/yellow]")
        
    except typer.BadParameter:
        raise
    except Exception as e:
        console.print(f"[red]✗ Error: {str(e)}[/red]")
        raise typer.Exit(code=1)


def _get_extensions_for_framework(framework: str) -> str:
    """Get file extensions for a framework."""
    extensions_map = {
        "pytorch": ".pt, .pth",
        "tensorflow": ".h5, .keras",
        "onnx": ".onnx"
    }
    return extensions_map.get(framework.lower(), "unknown")
