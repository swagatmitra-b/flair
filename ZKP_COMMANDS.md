# ZKP (Zero-Knowledge Proof) Command Documentation

## Overview

The Flair CLI includes commands to create and verify Zero-Knowledge Proofs (ZKPs) for machine learning models. This enables cryptographic verification of model integrity without exposing the model's weights or proprietary training data.

## Architecture

The ZKP system consists of two main components:

1. **Flair CLI (`flair zkp`)** - Client-side command interface for creating and verifying proofs
2. **ZKML Server** - Backend service that performs proof generation and verification using EZKL

### Data Flow

```
Model File (PyTorch/TensorFlow)
    ↓
[Automatic ONNX Conversion if needed]
    ↓
ZKML Server (/upload endpoint)
    ↓
Proof Generation (EZKL)
    ↓
Compressed Artifacts (proof, verification_key, settings)
    ↓
Stored in .flair/.zkp/ directory
    ↓
[Later] Verification via ZKML Server (/verify_proof endpoint)
```

## Prerequisites

### Installation

Install required packages for model conversion:

```bash
# For PyTorch to ONNX conversion
pip install torch onnx

# For TensorFlow to ONNX conversion
pip install tensorflow tf2onnx

# Core dependencies (usually already installed)
pip install requests numpy
```

### ZKML Server Setup

The ZKML server must be running before creating or verifying proofs:

```bash
cd repository_manager/zkml_server

# Install dependencies
pip install flask flask-cors ezkl numpy torch tensorflow

# Start the server
python app.py
```

The server will start on `http://localhost:2003`

## Commands

### 1. Create ZKP

Create a Zero-Knowledge Proof for your model.

**Command:**
```bash
flair zkp create [OPTIONS]
```

**Options:**
- `--model TEXT` - Path to model file (auto-detected if not provided)
- `--input-dims TEXT` - Input dimensions as JSON string (default: `[1, 3, 224, 224]`)
- `--backend TEXT` - Backend: pytorch, tensorflow, or numpy (auto-detected from repo config)

**Examples:**

```bash
# Auto-detect model in current directory
flair zkp create

# With custom input dimensions
flair zkp create --input-dims "[1, 3, 256, 256]"

# Explicitly specify model and backend
flair zkp create --model model.pt --backend pytorch

# With TensorFlow model
flair zkp create --model model.h5 --backend tensorflow

# Auto-detect with custom dimensions
flair zkp create --input-dims "[1, 28, 28]"
```

**What It Does:**

1. **Model Detection**: Searches for model files matching the repository's framework
   - PyTorch: `.pt`, `.pth`
   - TensorFlow: `.h5`, `.keras`
   - ONNX: `.onnx`

2. **ONNX Conversion**: If the model is not already ONNX format, converts it automatically
   - Handles framework-specific requirements
   - Cleans up temporary ONNX files after proof creation

3. **Proof Generation**: Sends the ONNX model to ZKML server which:
   - Generates input test data with specified dimensions
   - Calibrates settings with batch data
   - Compiles the circuit
   - Generates witness
   - Performs setup (proving key, verification key)
   - Generates the proof
   - Verifies the proof locally

4. **Artifact Storage**: Saves compressed artifacts to `.flair/.zkp/proof.json`:
   ```json
   {
     "timestamp": "2025-01-22T10:30:00.123456",
     "model_file": "model.pt",
     "framework": "pytorch",
     "input_dims": [1, 3, 224, 224],
     "proof": "compressed_proof_data",
     "verification_key": "compressed_vk_data",
     "settings": "compressed_settings"
   }
   ```

**Output:**
```
Creating ZKP for model: model.pt
Framework: pytorch

Converting pytorch model to ONNX format...
✓ Successfully converted to model.onnx

Uploading model to ZKML server...
[████████████████████████████] 100%

Saving proof artifacts...
✓ ZKP created successfully!
Saved to: .flair/.zkp/proof.json
Cleaned up temporary ONNX file
```

**Error Handling:**

- **No model found**: Specify `--model` path explicitly
- **Framework mismatch**: Specify `--backend` explicitly
- **Conversion failed**: Install required packages (torch, tensorflow, tf2onnx)
- **ZKML server not running**: Start the server with `python zkml_server/app.py`

### 2. Verify ZKP

Verify an existing Zero-Knowledge Proof.

**Command:**
```bash
flair zkp verify
```

**No options required** - uses the proof from `.flair/.zkp/proof.json`

**Example:**

```bash
# Verify the current proof
flair zkp verify
```

**What It Does:**

1. **Proof Loading**: Reads the proof artifacts from `.flair/.zkp/proof.json`

2. **Server Verification**: Sends proof to ZKML server which:
   - Decompresses all artifacts
   - Runs EZKL verification algorithm
   - Returns verification status

3. **Log Storage**: Saves verification result to `.flair/.zkp/.verified`:
   ```json
   {
     "timestamp": "2025-01-22T10:35:00.654321",
     "proof_timestamp": "2025-01-22T10:30:00.123456",
     "verified": true,
     "model_file": "model.pt",
     "framework": "pytorch",
     "input_dims": [1, 3, 224, 224]
   }
   ```

**Output (Success):**
```
Verifying Zero-Knowledge Proof...
Proof timestamp: 2025-01-22T10:30:00.123456

Sending to ZKML server...
[████████████████████████████] 100%

✓ Proof verified successfully!
Verification log saved to: .flair/.zkp/.verified
```

**Output (Failure):**
```
Verifying Zero-Knowledge Proof...
Proof timestamp: 2025-01-22T10:30:00.123456

Sending to ZKML server...
[████████████████████████████] 100%

✗ Proof verification failed!
Verification log saved to: .flair/.zkp/.verified
```

### 3. ZKP Status

Check the status of ZKP generation and verification.

**Command:**
```bash
flair zkp status
```

**Example:**

```bash
flair zkp status
```

**Output (With Proof):**
```
ZKP Status for my-repo
Location: /path/to/repo/.flair/.zkp

Proof Information:
  Model: model.pt
  Framework: pytorch
  Input Dims: [1, 3, 224, 224]
  Created: 2025-01-22T10:30:00.123456

Verification Status: ✓
  Verified: 2025-01-22T10:35:00.654321
```

**Output (No Proof):**
```
ZKP Status for my-repo
Location: /path/to/repo/.flair/.zkp

No proofs created yet. Run 'flair zkp create'
```

## Supported Models

### PyTorch Models

**File Extensions**: `.pt`, `.pth`

**Requirements**: 
- `torch` and `onnx` packages
- Model must be loadable with `torch.load()`

**Example**:
```bash
flair zkp create --model my_model.pt --backend pytorch
```

### TensorFlow Models

**File Extensions**: `.h5`, `.keras`

**Requirements**:
- `tensorflow` and `tf2onnx` packages
- Model must be loadable with `tf.keras.models.load_model()`

**Example**:
```bash
flair zkp create --model my_model.h5 --backend tensorflow
```

### ONNX Models

**File Extensions**: `.onnx`

**No conversion needed** - uses the model directly.

**Example**:
```bash
flair zkp create --model my_model.onnx
```

## Input Dimensions

### Understanding Input Dimensions

Input dimensions define the shape of test data passed through your model during proof generation. The format is a JSON array:

```
[batch_size, channels, height, width]  # For vision models
[batch_size, feature_size]             # For tabular models
[batch_size, sequence_length, features] # For sequence models
```

### Default Dimensions

The default `[1, 3, 224, 224]` is suitable for:
- Batch size: 1 (single sample)
- RGB images: 3 channels
- ImageNet-standard: 224×224 pixels

### Common Configurations

**Image Classification (ResNet, VGG, etc.)**:
```bash
flair zkp create --input-dims "[1, 3, 224, 224]"
```

**Grayscale Images**:
```bash
flair zkp create --input-dims "[1, 1, 224, 224]"
```

**Small Images (CIFAR-10)**:
```bash
flair zkp create --input-dims "[1, 3, 32, 32]"
```

**High-Resolution Images**:
```bash
flair zkp create --input-dims "[1, 3, 512, 512]"
```

**Tabular/Dense Features**:
```bash
flair zkp create --input-dims "[1, 128]"
```

**Time Series**:
```bash
flair zkp create --input-dims "[1, 100, 50]"
```

## File Structure

After creating and verifying a proof, your repository will have:

```
my-repo/
├── .flair/
│   ├── repo_config.json
│   └── .zkp/
│       ├── proof.json          # Proof artifacts
│       └── .verified           # Verification log
├── model.pt
└── other_files...
```

### proof.json

Contains all proof artifacts and metadata:
- Compressed proof data
- Compressed verification key
- Compressed settings
- Timestamp and model information

### .verified

Verification log showing:
- Verification timestamp
- Original proof timestamp
- Verification result (true/false)
- Model and framework info

## Workflow Examples

### Example 1: Complete ZKP Workflow

```bash
# Initialize repository
flair init --name my-repo --framework pytorch

# Create ZKP for your model
flair zkp create

# Check status
flair zkp status

# Verify the proof
flair zkp verify

# Check final status
flair zkp status
```

### Example 2: Multiple Input Dimensions

```bash
# Create proof with default dimensions
flair zkp create --input-dims "[1, 3, 224, 224]"

# Later, create another proof with different dimensions
# (overwrites the previous one)
flair zkp create --input-dims "[1, 3, 512, 512]"
```

### Example 3: Specify All Parameters

```bash
flair zkp create \
  --model ./models/trained_model.h5 \
  --backend tensorflow \
  --input-dims "[1, 28, 28, 1]"
```

## Troubleshooting

### Error: "Not in a Flair repository"

**Solution**: Run `flair init` in your repository directory first.

```bash
flair init --name my-repo --framework pytorch
```

### Error: "No model found"

**Solution**: Specify the model path explicitly:

```bash
flair zkp create --model path/to/model.pt
```

### Error: "Could not connect to ZKML server"

**Solution**: Start the ZKML server in another terminal:

```bash
cd repository_manager/zkml_server
python app.py
```

### Error: "PyTorch to ONNX conversion failed"

**Solution**: Install required packages:

```bash
pip install torch onnx
```

Ensure your model is compatible with ONNX export. Some operations may not be supported.

### Error: "TensorFlow to ONNX conversion failed"

**Solution**: Install required packages:

```bash
pip install tensorflow tf2onnx
```

Ensure the model was saved in Keras format (`.h5` or `.keras`).

### Large Input Dimensions Cause Slow Proof Generation

**Note**: Larger input dimensions mean more data to process, leading to longer proof generation times. For testing, use smaller dimensions like `[1, 3, 224, 224]`.

### Proof Verification Fails

**Possible Causes**:
- Proof artifacts were corrupted
- Model was modified after proof creation
- Different backend used during verification

**Solution**: Regenerate the proof:

```bash
flair zkp create --force  # (if implemented)
```

## Performance Considerations

### Proof Generation Time

Typical times on standard hardware:

| Model Complexity | Input Size | Time |
|---|---|---|
| Simple (LeNet) | [1, 1, 28, 28] | 2-5 minutes |
| Medium (ResNet18) | [1, 3, 224, 224] | 10-30 minutes |
| Large (ResNet50) | [1, 3, 224, 224] | 1-2 hours |

### Storage

Compressed proof artifacts typically use:
- **Small models**: 5-20 MB
- **Medium models**: 20-100 MB
- **Large models**: 100+ MB

## Security Considerations

⚠️ **Important**:

1. **Private Keys**: Never commit `.flair/.zkp/` to version control if it contains sensitive information
2. **Model Weights**: The proof does not expose model weights (they're private in the circuit)
3. **Input Data**: Test data used for proof generation is randomly generated, not from actual training data
4. **Verification**: Anyone can verify the proof with the verification key

## Advanced Usage

### Automatic Input Dimension Detection

The system attempts to auto-detect input dimensions from your model:

```python
# From zkp_utils.py
from flair_cli.cli.zkp_utils import detect_input_shape_from_model

shape = detect_input_shape_from_model(Path("model.pt"), "pytorch")
print(shape)  # [1, 3, 224, 224]
```

### Manual Server Request

For advanced use cases, interact directly with the ZKML server:

```bash
# Upload and create proof
curl -X POST http://localhost:2003/upload \
  -F "file=@model.onnx" \
  -F "dimensions={\"input_dims\": [1, 3, 224, 224]}" \
  -F "backend=numpy"

# Verify proof
curl -X POST http://localhost:2003/verify_proof \
  -H "Content-Type: application/json" \
  -d '{
    "proof": "...",
    "verification_key": "...",
    "settings": "..."
  }'
```

## Related Commands

- `flair init` - Initialize repository (required before ZKP)
- `flair add` - Extract and save model parameters
- `flair branch` - Manage branches (ZKP is per branch)
- `flair commit` - Create commits (can include ZKP verification)

## Support and Issues

For issues or questions:
1. Check the Troubleshooting section above
2. Verify ZKML server is running
3. Check `.flair/.zkp/` directory contents
4. Review ZKML server logs for detailed errors
5. Contact the development team with error output
