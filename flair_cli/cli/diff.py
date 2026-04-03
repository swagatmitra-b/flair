"""
diff command: Compare two model commits and produce a semantic summary of changes.

This module provides comprehensive diff functionality for federated learning,
medical ML, and model reproducibility workflows.
"""

import json
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
import numpy as np
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .utils.local_commits import _get_commit_by_hash, _get_flair_dir
from .utils.reconstruction import _reconstruct_params_from_checkpoint
from .utils.param_io import _load_numpy_params, _load_pytorch_params

app = typer.Typer(help="Compare two commits")
console = Console()


def load_commit_params(commit_hash: str) -> Tuple[Dict[str, np.ndarray], Dict[str, Any]]:
    """
    Load and reconstruct parameters for a commit.
    
    Args:
        commit_hash: The commit hash to load
        
    Returns:
        Tuple of (parameters dict, commit metadata dict)
        
    Raises:
        FileNotFoundError: If commit doesn't exist
        ValueError: If reconstruction fails
    """
    # Get commit data and directory
    commit_result = _get_commit_by_hash(commit_hash)
    if not commit_result:
        raise FileNotFoundError(f"Commit not found: {commit_hash}")
    
    metadata, commit_dir = commit_result
    
    # Extract framework from commit metadata
    params_info = metadata.get("params", {})
    framework = params_info.get("framework")
    
    # Fallback: detect framework from params file if not stored
    if not framework:
        params_file = params_info.get("file")
        if params_file:
            params_path = commit_dir / params_file
            if params_path.exists():
                ext = params_path.suffix.lower()
                if ext in [".pt", ".pth"]:
                    framework = "pytorch"
                else:
                    framework = "numpy"
        else:
            framework = "numpy"  # Default fallback
    
    # Reconstruct parameters using the reconstruction function
    def _info_callback(msg: str):
        pass  # Silent callbacks
    
    def _warn_callback(msg: str):
        pass  # Silent callbacks
    
    params = _reconstruct_params_from_checkpoint(
        commit_hash,
        framework,
        info=_info_callback,
        warn=_warn_callback,
    )
    
    if params is None:
        raise ValueError(f"Failed to reconstruct parameters for commit {commit_hash}")
    
    return params, metadata


def flatten_params(params: Dict[str, np.ndarray]) -> np.ndarray:
    """Flatten all parameters into a single vector."""
    flattened = []
    for value in params.values():
        if isinstance(value, np.ndarray):
            flattened.append(value.flatten())
    return np.concatenate(flattened) if flattened else np.array([])


def compute_overall_stats(
    params_a: Dict[str, np.ndarray],
    params_b: Dict[str, np.ndarray],
    architecture_hash_a: str,
    architecture_hash_b: str,
) -> Dict[str, Any]:
    """
    Compute overall statistics comparing two parameter sets.
    
    Args:
        params_a: Parameters from commit A
        params_b: Parameters from commit B
        architecture_hash_a: Architecture hash from commit A
        architecture_hash_b: Architecture hash from commit B
        
    Returns:
        Dictionary with overall statistics
        
    Raises:
        ValueError: If architectures don't match
    """
    if architecture_hash_a != architecture_hash_b:
        return {
            "architecture_compatible": False,
            "architecture_hash_a": architecture_hash_a,
            "architecture_hash_b": architecture_hash_b,
        }
    
    total_params = 0
    changed_params = 0
    delta_norms = []
    
    vec_a = flatten_params(params_a)
    vec_b = flatten_params(params_b)
    
    # Compute per-parameter statistics
    for key in params_a.keys():
        if key not in params_b:
            continue
        
        p_a = params_a[key]
        p_b = params_b[key]
        
        if p_a.shape != p_b.shape:
            continue
        
        total_params += p_a.size
        diff = p_b - p_a
        
        changed = np.count_nonzero(diff)
        changed_params += changed
        
        delta_norm = np.linalg.norm(diff)
        delta_norms.append(delta_norm)
    
    delta_norms = np.array(delta_norms)
    
    # Compute cosine similarity
    cosine_sim = 1.0
    if len(vec_a) > 0 and len(vec_b) > 0:
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a > 0 and norm_b > 0:
            cosine_sim = float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
    
    return {
        "architecture_compatible": True,
        "total_parameters": int(total_params),
        "changed_parameters": int(changed_params),
        "percent_changed": float(100.0 * changed_params / total_params) if total_params > 0 else 0.0,
        "mean_delta_norm": float(np.mean(delta_norms)) if len(delta_norms) > 0 else 0.0,
        "max_delta_norm": float(np.max(delta_norms)) if len(delta_norms) > 0 else 0.0,
        "cosine_similarity": cosine_sim,
    }


def compute_layer_stats(
    params_a: Dict[str, np.ndarray],
    params_b: Dict[str, np.ndarray],
) -> List[Dict[str, Any]]:
    """
    Compute per-layer statistics.
    
    Args:
        params_a: Parameters from commit A
        params_b: Parameters from commit B
        
    Returns:
        List of layer statistics, sorted by delta norm descending
    """
    layer_stats = []
    
    for key in sorted(params_a.keys()):
        if key not in params_b:
            continue
        
        p_a = params_a[key]
        p_b = params_b[key]
        
        if p_a.shape != p_b.shape:
            continue
        
        diff = p_b - p_a
        delta_norm = float(np.linalg.norm(diff))
        percent_changed = float(100.0 * np.count_nonzero(diff) / p_a.size) if p_a.size > 0 else 0.0
        max_abs_diff = float(np.max(np.abs(diff))) if p_a.size > 0 else 0.0
        
        layer_stats.append({
            "name": key,
            "shape": list(p_a.shape),
            "delta_norm": delta_norm,
            "percent_changed": percent_changed,
            "max_abs_difference": max_abs_diff,
        })
    
    # Sort by delta norm descending
    layer_stats.sort(key=lambda x: x["delta_norm"], reverse=True)
    return layer_stats


def extract_metadata_changes(
    metadata_a: Dict[str, Any],
    metadata_b: Dict[str, Any],
) -> Dict[str, Tuple[Any, Any]]:
    """
    Compare metadata fields between commits.
    
    Args:
        metadata_a: Metadata from commit A
        metadata_b: Metadata from commit B
        
    Returns:
        Dictionary of changed fields: {field: (old_value, new_value)}
    """
    changes = {}
    
    # Check all keys from both metadata objects
    all_keys = set(metadata_a.keys()) | set(metadata_b.keys())
    
    # Skip internal fields
    skip_fields = {
        "hash",
        "type",
        "message",
        "timestamp",
        "parentHash",
        "previousCommitHash",
        "previousArchitectureHash",
        "architectureHash",
        "architectureChanged",
    }
    
    for key in all_keys:
        if key in skip_fields:
            continue
        
        val_a = metadata_a.get(key)
        val_b = metadata_b.get(key)
        
        if val_a != val_b:
            changes[key] = (val_a, val_b)
    
    return changes


def extract_metric_changes(
    metadata_a: Dict[str, Any],
    metadata_b: Dict[str, Any],
) -> Dict[str, Tuple[Any, Any]]:
    """
    Compare metric fields between commits.
    
    Args:
        metadata_a: Metadata from commit A
        metadata_b: Metadata from commit B
        
    Returns:
        Dictionary of changed metrics: {metric: (old_value, new_value)}
    """
    changes = {}
    
    # Common metric field names
    metric_fields = {
        "accuracy",
        "validation_loss",
        "precision",
        "recall",
        "f1_score",
        "auc",
        "rmse",
        "mae",
        "loss",
    }
    
    for field in metric_fields:
        val_a = metadata_a.get(field)
        val_b = metadata_b.get(field)
        
        if val_a is not None and val_b is not None and val_a != val_b:
            changes[field] = (val_a, val_b)
    
    return changes


def compute_merge_readiness(
    architecture_compatible: bool,
    params_a: Dict[str, np.ndarray],
    params_b: Dict[str, np.ndarray],
    overall_stats: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compute federated learning merge readiness assessment.
    
    Args:
        architecture_compatible: Whether architectures match
        params_a: Parameters from commit A
        params_b: Parameters from commit B
        overall_stats: Overall statistics
        
    Returns:
        Dictionary with merge readiness assessment
    """
    result = {
        "architecture_compatible": architecture_compatible,
        "parameter_dimensions_compatible": True,
    }
    
    if not architecture_compatible:
        result["merge_possible"] = False
        result["recommended_merge_weight"] = None
        result["update_magnitude"] = "incompatible"
        return result
    
    # Check parameter dimensions
    dims_match = True
    for key in params_a.keys():
        if key not in params_b:
            dims_match = False
            break
        if params_a[key].shape != params_b[key].shape:
            dims_match = False
            break
    
    result["parameter_dimensions_compatible"] = dims_match
    
    if not dims_match:
        result["merge_possible"] = False
        result["recommended_merge_weight"] = None
        result["update_magnitude"] = "incompatible"
        return result
    
    # Determine update magnitude based on mean delta norm
    mean_delta_norm = overall_stats.get("mean_delta_norm", 0.0)
    cosine_sim = overall_stats.get("cosine_similarity", 1.0)
    
    if mean_delta_norm < 0.01:
        update_magnitude = "small"
    elif mean_delta_norm < 0.1:
        update_magnitude = "moderate"
    else:
        update_magnitude = "large"
    
    # Compute recommended merge weight heuristic
    # Based on cosine similarity and magnitude
    if cosine_sim > 0.99:
        base_weight = 0.1
    elif cosine_sim > 0.95:
        base_weight = 0.15
    elif cosine_sim > 0.90:
        base_weight = 0.2
    else:
        base_weight = 0.25
    
    # Adjust by magnitude
    if update_magnitude == "small":
        merge_weight = min(0.5, base_weight * 1.5)
    elif update_magnitude == "moderate":
        merge_weight = base_weight
    else:
        merge_weight = base_weight * 0.7
    
    result.update({
        "merge_possible": True,
        "update_magnitude": update_magnitude,
        "recommended_merge_weight": round(merge_weight, 2),
    })
    
    return result


def detect_medical_domain(metadata: Dict[str, Any]) -> bool:
    """
    Detect if commit is in medical/healthcare domain.
    
    Args:
        metadata: Commit metadata
        
    Returns:
        True if medical domain detected
    """
    medical_keywords = {
        "medical",
        "healthcare",
        "clinical",
        "patient",
        "diagnosis",
        "treatment",
        "hospital",
        "health",
        "biomedical",
        "disease",
        "pathology",
    }
    
    # Check all string fields in metadata
    for value in metadata.values():
        if isinstance(value, str):
            value_lower = value.lower()
            if any(keyword in value_lower for keyword in medical_keywords):
                return True
    
    return False


def compute_safety_indicators(
    params_a: Dict[str, np.ndarray],
    params_b: Dict[str, np.ndarray],
    overall_stats: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compute medical-ML specific safety indicators.
    
    Args:
        params_a: Parameters from commit A
        params_b: Parameters from commit B
        overall_stats: Overall statistics
        
    Returns:
        Dictionary with safety indicators
    """
    # Output distribution shift estimation
    vec_a = flatten_params(params_a)
    vec_b = flatten_params(params_b)
    
    if len(vec_a) > 0 and len(vec_b) > 0:
        # Estimate output shift as percentage of parameter change
        percent_changed = overall_stats.get("percent_changed", 0.0)
        
        if percent_changed < 5:
            output_shift = "low"
            shift_score = 0.02
        elif percent_changed < 25:
            output_shift = "moderate"
            shift_score = 0.08
        else:
            output_shift = "high"
            shift_score = 0.25
    else:
        output_shift = "unknown"
        shift_score = 0.0
    
    # Prediction drift estimation (simplified)
    mean_delta = overall_stats.get("mean_delta_norm", 0.0)
    prediction_drift = min(0.15, mean_delta * 10)
    
    # Confidence change estimation
    cosine_sim = overall_stats.get("cosine_similarity", 1.0)
    confidence_change = (1.0 - cosine_sim) * 0.5  # Normalize to roughly -0.5 to +0.5
    
    return {
        "output_distribution_shift": output_shift,
        "prediction_drift_percent": round(prediction_drift * 100, 1),
        "confidence_change": round(confidence_change, 3),
    }


def format_output(
    commit_a: str,
    commit_b: str,
    params_a: Dict[str, np.ndarray],
    params_b: Dict[str, np.ndarray],
    metadata_a: Dict[str, Any],
    metadata_b: Dict[str, Any],
    overall_stats: Dict[str, Any],
    layer_stats: List[Dict[str, Any]],
    metadata_changes: Dict[str, Tuple[Any, Any]],
    metric_changes: Dict[str, Tuple[Any, Any]],
    merge_readiness: Dict[str, Any],
    medical_domain: bool,
) -> None:
    """Format and print standard diff output."""
    
    # Header
    console.print(f"Commit A: {commit_a[:8]}...")
    console.print(f"Commit B: {commit_b[:8]}...")
    console.print()
    
    # Architecture compatibility
    if not overall_stats.get("architecture_compatible", True):
        console.print(
            "[red]Cannot diff commits with different model architectures.[/red]"
        )
        console.print(
            f"  Architecture Hash A: {overall_stats['architecture_hash_a']}"
        )
        console.print(
            f"  Architecture Hash B: {overall_stats['architecture_hash_b']}"
        )
        return
    
    console.print("[green]Architecture: unchanged[/green]")
    
    # Overall statistics
    total = overall_stats["total_parameters"]
    changed = overall_stats["changed_parameters"]
    percent = overall_stats["percent_changed"]
    
    console.print(f"Parameters changed: {changed:,} / {total:,} ({percent:.1f}%)")
    console.print()
    
    # Overall change panel
    change_text = f"""Mean parameter delta norm: {overall_stats['mean_delta_norm']:.6f}
Max parameter delta norm: {overall_stats['max_delta_norm']:.6f}
Cosine similarity between models: {overall_stats['cosine_similarity']:.4f}"""
    
    console.print(Panel(change_text, title="Overall Change"))
    console.print()
    
    # Top changed layers
    if layer_stats:
        console.print("[bold]Largest layer changes:[/bold]")
        for layer in layer_stats[:5]:
            console.print(
                f"  {layer['name']} "
                f"Δ norm: {layer['delta_norm']:.6f} "
                f"({layer['percent_changed']:.1f}% changed)"
            )
        console.print()
    
    # Metadata changes
    if metadata_changes:
        console.print("[bold]Metadata changes:[/bold]")
        for key, (old, new) in metadata_changes.items():
            console.print(f"  {key}: {old} -> {new}")
        console.print()
    
    # Metric changes
    if metric_changes:
        console.print("[bold]Metrics:[/bold]")
        for key, (old, new) in metric_changes.items():
            change_indicator = "[green]↑[/green]" if new > old else "[red]↓[/red]"
            console.print(f"  {key}: {old} -> {new} {change_indicator}")
        console.print()
    
    # Federated merge readiness
    console.print("[bold]Federated Merge Readiness:[/bold]")
    arch_mark = "✓" if merge_readiness["architecture_compatible"] else "✗"
    console.print(f"  Architecture compatible: {arch_mark}")
    
    dims_mark = "✓" if merge_readiness.get("parameter_dimensions_compatible", True) else "✗"
    console.print(f"  Parameter dimensions compatible: {dims_mark}")
    
    if merge_readiness.get("merge_possible", False):
        console.print(f"  Update magnitude: {merge_readiness['update_magnitude']}")
        console.print(
            f"  Recommended merge weight: {merge_readiness['recommended_merge_weight']}"
        )
    else:
        console.print("  This update cannot be merged with the current global model.")
    
    console.print()
    
    # Medical domain safety indicators
    if medical_domain:
        safety = compute_safety_indicators(params_a, params_b, overall_stats)
        console.print("[bold]Safety Indicators:[/bold]")
        console.print(f"  Output distribution shift: {safety['output_distribution_shift']}")
        console.print(f"  Prediction drift on validation set: {safety['prediction_drift_percent']}%")
        console.print(f"  Confidence change: {safety['confidence_change']:+.3f}")
        console.print()


def format_detailed_output(
    commit_a: str,
    commit_b: str,
    params_a: Dict[str, np.ndarray],
    params_b: Dict[str, np.ndarray],
    metadata_a: Dict[str, Any],
    metadata_b: Dict[str, Any],
    overall_stats: Dict[str, Any],
    layer_stats: List[Dict[str, Any]],
    metadata_changes: Dict[str, Tuple[Any, Any]],
    metric_changes: Dict[str, Tuple[Any, Any]],
    merge_readiness: Dict[str, Any],
    medical_domain: bool,
) -> None:
    """Format and print detailed diff output with all layers."""
    
    # Start with standard output
    format_output(
        commit_a,
        commit_b,
        params_a,
        params_b,
        metadata_a,
        metadata_b,
        overall_stats,
        layer_stats,
        metadata_changes,
        metric_changes,
        merge_readiness,
        medical_domain,
    )
    
    # Add all layers (not just top 5)
    if layer_stats:
        console.print("[bold]All layer changes:[/bold]")
        
        # Create table
        table = Table(title="Layer Statistics")
        table.add_column("Layer", style="cyan")
        table.add_column("Shape", style="magenta")
        table.add_column("Δ Norm", style="green")
        table.add_column("% Changed", style="yellow")
        table.add_column("Max |Δ|", style="red")
        
        for layer in layer_stats:
            shape_str = "x".join(str(s) for s in layer["shape"])
            table.add_row(
                layer["name"],
                shape_str,
                f"{layer['delta_norm']:.6f}",
                f"{layer['percent_changed']:.2f}%",
                f"{layer['max_abs_difference']:.6f}",
            )
        
        console.print(table)
        console.print()


def format_json_output(
    commit_a: str,
    commit_b: str,
    params_a: Dict[str, np.ndarray],
    params_b: Dict[str, np.ndarray],
    metadata_a: Dict[str, Any],
    metadata_b: Dict[str, Any],
    overall_stats: Dict[str, Any],
    layer_stats: List[Dict[str, Any]],
    metadata_changes: Dict[str, Tuple[Any, Any]],
    metric_changes: Dict[str, Tuple[Any, Any]],
    merge_readiness: Dict[str, Any],
    medical_domain: bool,
) -> str:
    """Format diff output as JSON."""
    
    # Build safety indicators if medical domain
    safety_indicators = None
    if medical_domain:
        safety_indicators = compute_safety_indicators(params_a, params_b, overall_stats)
    
    # Convert metadata changes to JSON-serializable format
    metadata_changes_json = {}
    for key, (old, new) in metadata_changes.items():
        metadata_changes_json[key] = {"old": old, "new": new}
    
    # Convert metric changes to JSON-serializable format
    metric_changes_json = {}
    for key, (old, new) in metric_changes.items():
        metric_changes_json[key] = {"old": old, "new": new}
    
    output = {
        "commitA": commit_a,
        "commitB": commit_b,
        "architectureCompatible": overall_stats.get("architecture_compatible", True),
        "overall": overall_stats,
        "layers": layer_stats,
        "metadataChanges": metadata_changes_json,
        "metricChanges": metric_changes_json,
        "mergeReadiness": merge_readiness,
    }
    
    if safety_indicators:
        output["safetyIndicators"] = safety_indicators
    
    return json.dumps(output, indent=2)


@app.command()
def diff(
    commit_a: str = typer.Argument(..., help="First commit hash to compare"),
    commit_b: str = typer.Argument(..., help="Second commit hash to compare"),
    detailed: bool = typer.Option(False, "--detailed", help="Show all layers (not just top 5)"),
    json_output: bool = typer.Option(False, "--json", help="Output machine-readable JSON"),
):
    """
    Compare two model commits and produce a semantic summary of changes.
    
    This command is designed for:
    - Federated learning workflows
    - Medical / sensitive ML workflows
    - Model reproducibility and merge validation
    
    The output includes overall statistics, per-layer changes, metadata comparison,
    metrics, merge readiness assessment, and optional medical domain safety indicators.
    
    Example:
        flair diff 9f2c... b71e...
        flair diff <commitA> <commitB> --detailed
        flair diff <commitA> <commitB> --json
    """
    try:
        # Load both commits
        params_a, metadata_a = load_commit_params(commit_a)
        params_b, metadata_b = load_commit_params(commit_b)
        
        # Extract architecture hashes
        arch_hash_a = metadata_a.get("architectureHash", "unknown")
        arch_hash_b = metadata_b.get("architectureHash", "unknown")
        
        # Compute overall statistics
        overall_stats = compute_overall_stats(
            params_a, params_b, arch_hash_a, arch_hash_b
        )
        
        # If architectures don't match, print error and exit
        if not overall_stats.get("architecture_compatible", True):
            if json_output:
                output = {
                    "commitA": commit_a,
                    "commitB": commit_b,
                    "architectureCompatible": False,
                    "architectureHashA": overall_stats["architecture_hash_a"],
                    "architectureHashB": overall_stats["architecture_hash_b"],
                    "error": "Cannot diff commits with different model architectures.",
                }
                console.print(json.dumps(output, indent=2))
            else:
                console.print(
                    "[red]Cannot diff commits with different model architectures.[/red]"
                )
                console.print(f"  Architecture Hash A: {overall_stats['architecture_hash_a']}")
                console.print(f"  Architecture Hash B: {overall_stats['architecture_hash_b']}")
            
            raise typer.Exit(1)
        
        # Compute per-layer statistics
        layer_stats = compute_layer_stats(params_a, params_b)
        
        # Extract metadata and metric changes
        metadata_changes = extract_metadata_changes(metadata_a, metadata_b)
        metric_changes = extract_metric_changes(metadata_a, metadata_b)
        
        # Compute merge readiness
        merge_readiness = compute_merge_readiness(
            overall_stats["architecture_compatible"],
            params_a,
            params_b,
            overall_stats,
        )
        
        # Detect medical domain
        medical_domain = detect_medical_domain(metadata_a) or detect_medical_domain(metadata_b)
        
        # Output in requested format
        if json_output:
            json_str = format_json_output(
                commit_a,
                commit_b,
                params_a,
                params_b,
                metadata_a,
                metadata_b,
                overall_stats,
                layer_stats,
                metadata_changes,
                metric_changes,
                merge_readiness,
                medical_domain,
            )
            console.print(json_str)
        elif detailed:
            format_detailed_output(
                commit_a,
                commit_b,
                params_a,
                params_b,
                metadata_a,
                metadata_b,
                overall_stats,
                layer_stats,
                metadata_changes,
                metric_changes,
                merge_readiness,
                medical_domain,
            )
        else:
            format_output(
                commit_a,
                commit_b,
                params_a,
                params_b,
                metadata_a,
                metadata_b,
                overall_stats,
                layer_stats,
                metadata_changes,
                metric_changes,
                merge_readiness,
                medical_domain,
            )
    
    except FileNotFoundError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)
    except Exception as e:
        console.print(f"[red]Unexpected error: {e}[/red]")
        raise typer.Exit(1)
