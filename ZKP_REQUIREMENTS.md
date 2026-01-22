# ZKP Requirements and Dependencies

This file documents all requirements for using the Zero-Knowledge Proof functionality in Flair.

## Core Flair CLI Dependencies

These should already be installed with Flair:

```
typer>=0.9.0           # CLI framework
rich>=13.0.0           # Terminal output and formatting
pydantic>=2.0.0        # Data validation
pyyaml>=6.0            # Configuration files
requests>=2.31.0       # HTTP requests
```

Install with:
```bash
pip install -r flair_cli/requirements.txt
```

## Optional: Model Conversion Dependencies

These are only needed if converting models to ONNX format.

### PyTorch to ONNX

For PyTorch models (`.pt`, `.pth`):

```
torch>=2.0.0           # PyTorch framework
onnx>=1.14.0           # ONNX format
```

Install with:
```bash
pip install torch onnx
```

**Check installation:**
```bash
python -c "import torch; import onnx; print('✓ PyTorch and ONNX installed')"
```

### TensorFlow to ONNX

For TensorFlow models (`.h5`, `.keras`):

```
tensorflow>=2.13.0     # TensorFlow framework
tf2onnx>=1.14.0        # TensorFlow to ONNX converter
```

Install with:
```bash
pip install tensorflow tf2onnx
```

**Check installation:**
```bash
python -c "import tensorflow; import tf2onnx; print('✓ TensorFlow and tf2onnx installed')"
```

### Using Pre-Converted ONNX Models

If your models are already in ONNX format (`.onnx`):
- No conversion dependencies needed
- These dependencies are optional

### Installation Summary

```bash
# Required for all Flair functionality
pip install -r flair_cli/requirements.txt

# Optional: Only if converting PyTorch models
pip install torch onnx

# Optional: Only if converting TensorFlow models  
pip install tensorflow tf2onnx

# Optional: Both for maximum compatibility
pip install torch onnx tensorflow tf2onnx
```

## ZKML Server Dependencies

The ZKML server has separate requirements (runs on different machine/process).

### Server Core Dependencies

```
flask>=2.3.0           # Web framework
flask-cors>=4.0.0      # CORS support
ezkl>=5.0.0            # Zero-knowledge proofs
numpy>=1.24.0          # Numerical computing
```

### Server ML Framework Support

```
torch>=2.0.0           # PyTorch backend
tensorflow>=2.13.0     # TensorFlow backend
```

### Install Server Dependencies

```bash
cd repository_manager/zkml_server

# Option 1: Using requirements.txt (if it exists)
pip install -r requirements.txt

# Option 2: Manual installation
pip install flask flask-cors ezkl numpy torch tensorflow

# Option 3: Minimal installation (numpy only)
pip install flask flask-cors ezkl numpy
```

**Create requirements.txt:**
```bash
cat > requirements.txt << 'EOF'
flask==2.3.3
flask-cors==4.0.0
ezkl==5.0.0
numpy==1.24.0
torch==2.0.1
tensorflow==2.13.0
EOF
```

## Compatibility Matrix

### By Python Version

| Python | CLI | PyTorch→ONNX | TF→ONNX | ZKML Server |
|--------|-----|--------------|---------|-------------|
| 3.8    | ✅  | ⚠️ Limited   | ⚠️ Limited | ⚠️ Limited |
| 3.9    | ✅  | ✅ Full      | ✅ Full | ✅ Full    |
| 3.10   | ✅  | ✅ Full      | ✅ Full | ✅ Full    |
| 3.11   | ✅  | ✅ Full      | ✅ Full | ✅ Full    |
| 3.12   | ✅  | ⚠️ Limited   | ⚠️ Limited | ⚠️ Limited |

**Recommended**: Python 3.10 or 3.11

## Operating System Support

### Linux
```bash
# Ubuntu/Debian
sudo apt-get install python3-pip python3-dev
pip install -r requirements.txt

# RHEL/CentOS
sudo yum install python3-pip python3-devel
pip install -r requirements.txt
```

✅ **Full Support** - Recommended for ZKML server

### macOS
```bash
# Intel Macs
pip install -r requirements.txt

# Apple Silicon Macs
# Some packages may need compilation or specific builds
pip install --pre torch torchvision torchaudio -i https://download.pytorch.org/whl/nightly/cpu
```

✅ **Supported** - Native support for PyTorch and TensorFlow

### Windows
```bash
# Using pip
pip install -r requirements.txt

# Or using conda (recommended for Windows)
conda install pytorch torchvision torchaudio cpuonly -c pytorch
conda install tensorflow -c conda-forge
pip install flask flask-cors ezkl
```

⚠️ **Limited Support** - Some issues with EZKL, WSL2 recommended for ZKML server

## Hardware Requirements

### For ZKML Server

**Minimum:**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 10 GB (for artifacts)
- Time per proof: 10-60 minutes (simple models)

**Recommended:**
- CPU: 8+ cores
- RAM: 16 GB+
- Storage: 50 GB SSD
- GPU: Optional (not yet supported by EZKL)

**For Large Models:**
- CPU: 16+ cores
- RAM: 32+ GB
- Storage: 100+ GB NVMe SSD
- Time per proof: 1-3+ hours

### For Flair CLI

**Minimum:**
- CPU: 2 cores
- RAM: 2 GB (4 GB recommended)
- Storage: 1 GB
- Network: 1 Mbps connection to ZKML server

## Network Requirements

### ZKML Server

- Port: 2003 (configurable)
- Protocol: HTTP
- For local development: 127.0.0.1:2003
- For production: Configure firewall and reverse proxy

### Flair CLI

- Requires network access to ZKML server
- Default: http://localhost:2003
- Can be configured via environment variable or config file

## Verification Steps

### Check All Dependencies Installed

```bash
# Python version
python --version  # Should be 3.9+

# Flair CLI dependencies
python -c "import typer, rich, pydantic, yaml, requests; print('✓ CLI deps OK')"

# PyTorch (optional)
python -c "import torch, onnx; print('✓ PyTorch OK')" || echo "Not installed (optional)"

# TensorFlow (optional)
python -c "import tensorflow, tf2onnx; print('✓ TensorFlow OK')" || echo "Not installed (optional)"

# ZKML Server (if running locally)
python -c "import flask, ezkl, numpy; print('✓ ZKML deps OK')" || echo "Not installed (only needed for server)"
```

### Test ZKML Server

```bash
# Start server
cd repository_manager/zkml_server
python app.py &

# In another terminal, test health endpoint
curl http://localhost:2003/health
# Should return: {"status": "ok", "service": "ZKML Server", "version": "1.0.0"}
```

### Test Flair ZKP Commands

```bash
# Initialize test repo
mkdir test-repo
cd test-repo
flair init --name test --framework pytorch

# Check help
flair zkp --help

# Create test proof (will fail without model, but checks setup)
flair zkp create 2>&1 | grep -q "model" && echo "✓ CLI working"
```

## Troubleshooting Installation

### "ModuleNotFoundError: No module named 'torch'"

**Solution**: Install PyTorch
```bash
pip install torch
```

### "ModuleNotFoundError: No module named 'ezkl'"

**Solution**: Install EZKL (ZKML server only)
```bash
pip install ezkl
```

### "pip: command not found"

**Solution**: Use python -m pip
```bash
python -m pip install -r requirements.txt
```

### Permission denied errors

**Solution**: Use --user flag or virtual environment
```bash
# Using --user
pip install --user torch

# Using venv (recommended)
python -m venv venv
source venv/bin/activate  # Linux/macOS
# or
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### EZKL compilation errors (macOS/Windows)

**Solution**: Use pre-built wheels or conda
```bash
# Using conda
conda install ezkl -c conda-forge

# Or install build tools
# macOS: xcode-select --install
# Windows: Download Visual Studio C++ Build Tools
```

### TensorFlow installation issues

**Solution**: Use conda or specific version
```bash
# Using conda (easier)
conda install tensorflow -c conda-forge

# Or specific CPU version
pip install tensorflow-cpu==2.13.0
```

## Version Compatibility

### Tested Versions

| Package | Tested Version | Supported Range |
|---------|---|---|
| Python | 3.10 | 3.9-3.11 |
| PyTorch | 2.0.1 | 2.0+ |
| TensorFlow | 2.13 | 2.12+ |
| ONNX | 1.14 | 1.13+ |
| EZKL | 5.0 | 5.0+ |
| Flask | 2.3.3 | 2.3+ |

### Upgrade Instructions

```bash
# Update all packages
pip install --upgrade torch tensorflow onnx ezkl flask

# Or update specific package
pip install --upgrade torch==2.1.0
```

## Virtual Environment Setup (Recommended)

### Linux/macOS

```bash
# Create virtual environment
python3 -m venv flair_env

# Activate environment
source flair_env/bin/activate

# Install dependencies
pip install -r requirements.txt

# Deactivate when done
deactivate
```

### Windows

```bash
# Create virtual environment
python -m venv flair_env

# Activate environment
flair_env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Deactivate when done
deactivate
```

## Docker (Optional)

For ZKML server in container:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 2003

CMD ["python", "zkml_server/app.py"]
```

Build and run:
```bash
docker build -t zkml-server .
docker run -p 2003:2003 zkml-server
```

## Environment Variables

### Flair CLI

```bash
# ZKML server URL (defaults to http://localhost:2003)
export FLAIR_ZKML_SERVER="http://localhost:2003"

# Flair API base (already supported)
export FLAIR_API_BASE="http://localhost:2112"
```

### ZKML Server

```bash
# Server port (default 2003)
export ZKML_PORT=2003

# Debug mode
export FLASK_ENV=development
export FLASK_DEBUG=1
```

## Dependencies Summary Table

| Component | PyTorch | TensorFlow | ONNX | EZKL | Flask | Required |
|-----------|---------|-----------|------|------|-------|----------|
| CLI | Optional | Optional | No | No | No | Typer, Rich, Requests |
| Convert PT | Yes | No | Yes | No | No | torch, onnx |
| Convert TF | No | Yes | Yes | No | No | tensorflow, tf2onnx |
| ZKML Server | Yes | Yes | No | Yes | Yes | ezkl, flask, numpy |

## Next Steps

1. **Check Requirements**: Run verification steps above
2. **Install Missing**: Use pip install for any missing packages
3. **Start ZKML Server**: `python zkml_server/app.py`
4. **Test CLI**: `flair zkp --help`
5. **Follow Quick Start**: See [ZKP_QUICKSTART.md](./ZKP_QUICKSTART.md)

## Support

For installation issues:
1. Check Python version: `python --version`
2. Check package versions: `pip show torch tensorflow ezkl`
3. Try virtual environment: Create fresh venv and reinstall
4. Check GitHub issues for similar problems
5. Contact development team with error output

---

**Last Updated**: January 2025
**Python Support**: 3.9 - 3.11
**Maintained By**: Flair Development Team
