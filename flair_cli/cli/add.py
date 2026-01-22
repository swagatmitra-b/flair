"""
Add command: Extract model weights and save as params.
"""
from __future__ import annotations
import typer
from rich.console import Console
from pathlib import Path
import json

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


@app.command()
def add(
    model: str = typer.Option(None, "--model", help="Path to model file"),
    output_name: str = typer.Option("params", "--output", "-o", help="Output filename (without extension)")
):
    """Extract model weights and save as params.
    
    Automatically detects PyTorch, TensorFlow, or ONNX models.
    
    Examples:
      flair add .                    # Auto-detect model in current directory
      flair add --model model.pt     # Specify model file
      flair add --model model.h5 -o weights  # Custom output name
    """
    
    # Check if we're in a Flair repository
    flair_dir = Path.cwd() / ".flair"
    if not flair_dir.exists():
        console.print("[red]Not in a Flair repository. Run 'flair init' first.[/red]")
        raise typer.Exit(code=1)
    
    # Create .params directory if it doesn't exist
    params_dir = flair_dir / ".params"
    params_dir.mkdir(exist_ok=True)
    
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
    
    # Prepare output path in .flair/.params directory
    params_dir = Path.cwd() / ".flair" / ".params"
    if framework == "pytorch":
        output_path = params_dir / f"{output_name}.pt"
    else:
        output_path = params_dir / f"{output_name}.npz"
    
    # Extract weights based on framework
    success = False
    if framework == "pytorch":
        success = _extract_pytorch_weights(model_path, output_path)
    elif framework == "tensorflow":
        success = _extract_tensorflow_weights(model_path, output_path)
    elif framework == "onnx":
        success = _extract_onnx_weights(model_path, output_path)
    
    if success:
        console.print(f"\n[green]✓ Weights saved to {output_path.name}[/green]")
        console.print(f"[dim]Next steps:[/dim]")
        console.print(f"  1. Review the extracted params file")
        console.print(f"  2. Run 'flair commit' to create a new commit with these params")
    else:
        raise typer.Exit(code=1)
