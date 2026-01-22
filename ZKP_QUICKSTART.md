# ZKP Quick Start Guide

Get started with Zero-Knowledge Proofs in Flair in 5 minutes!

## Prerequisites

```bash
# Install required packages
pip install requests torch onnx tensorflow tf2onnx
```

## Step 1: Start ZKML Server

In a terminal (keep it running):
```bash
cd repository_manager/zkml_server
pip install flask flask-cors ezkl numpy torch tensorflow
python app.py
```

You should see:
```
Starting ZKML Server on 0.0.0.0:2003
 * Running on http://0.0.0.0:2003
```

## Step 2: Initialize Your Repository

In another terminal:
```bash
# Create/navigate to your repo
mkdir my-ml-repo
cd my-ml-repo

# Initialize with Flair
flair init --name my-ml-repo --framework pytorch

# Add your model file
# (if you don't have one, the demo uses a dummy model)
```

## Step 3: Create a ZKP

```bash
# Create proof (will auto-detect your model)
flair zkp create
```

**What happens:**
1. Finds your model file
2. Converts to ONNX if needed
3. Uploads to ZKML server
4. Generates proof (takes 1-30 minutes depending on model size)
5. Saves to `.flair/.zkp/proof.json`

**Example output:**
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
```

## Step 4: Verify the Proof

```bash
# Verify proof
flair zkp verify
```

**Example output:**
```
Verifying Zero-Knowledge Proof...
Proof timestamp: 2025-01-22T10:30:00.123456

Sending to ZKML server...
[████████████████████████████] 100%

✓ Proof verified successfully!
Verification log saved to: .flair/.zkp/.verified
```

## Step 5: Check Status

```bash
# See proof and verification status
flair zkp status
```

**Example output:**
```
ZKP Status for my-ml-repo
Location: /path/to/repo/.flair/.zkp

Proof Information:
  Model: model.pt
  Framework: pytorch
  Input Dims: [1, 3, 224, 224]
  Created: 2025-01-22T10:30:00.123456

Verification Status: ✓
  Verified: 2025-01-22T10:35:00.654321
```

## Common Commands

### With Different Input Dimensions

```bash
# For smaller images (CIFAR-10)
flair zkp create --input-dims "[1, 3, 32, 32]"

# For grayscale images
flair zkp create --input-dims "[1, 1, 224, 224]"

# For tabular data
flair zkp create --input-dims "[1, 128]"
```

### With Explicit Model Path

```bash
# Specify model file
flair zkp create --model ./models/trained.h5 --backend tensorflow

# Custom TensorFlow model
flair zkp create --model model.keras --input-dims "[1, 28, 28, 1]"
```

## Troubleshooting

### "Could not connect to ZKML server"

**Fix**: Make sure ZKML server is running
```bash
# In another terminal
cd repository_manager/zkml_server
python app.py
```

### "Not in a Flair repository"

**Fix**: Initialize repository first
```bash
flair init --name my-repo --framework pytorch
```

### "No model found"

**Fix**: Specify model path explicitly
```bash
flair zkp create --model /path/to/model.pt
```

### "PyTorch to ONNX conversion failed"

**Fix**: Install required packages
```bash
pip install torch onnx
```

### "Proof verification failed"

**Fix**: Regenerate the proof
```bash
flair zkp create  # Creates new proof
flair zkp verify  # Verify the new proof
```

## What's Happening Behind the Scenes?

### ZKP Creation Process

```
Your Model (.pt/.h5/onnx)
    ↓
Convert to ONNX (if needed)
    ↓
Send to ZKML Server
    ↓
Server generates random test data
    ↓
Server creates ZK circuit from ONNX
    ↓
Server generates proof (EZKL)
    ↓
Server verifies proof locally
    ↓
Compressed artifacts returned to CLI
    ↓
Saved in .flair/.zkp/proof.json
```

### ZKP Verification Process

```
Read proof from .flair/.zkp/proof.json
    ↓
Send compressed artifacts to server
    ↓
Server decompresses artifacts
    ↓
Server runs verification algorithm
    ↓
Result: verified or not verified
    ↓
Save verification log to .flair/.zkp/.verified
```

## File Structure

After completing all steps:

```
my-ml-repo/
├── .flair/
│   ├── repo_config.json
│   ├── session_token.json
│   └── .zkp/
│       ├── proof.json        ← Your proof
│       └── .verified         ← Verification result
├── model.pt                  ← Your model
└── (other files)
```

## Next Steps

1. **Explore Options**: `flair zkp --help`
2. **Read Full Docs**: Check [ZKP_COMMANDS.md](./ZKP_COMMANDS.md)
3. **Integrate with Commits**: Use verified proofs with `flair add` and `flair commit`
4. **Monitor Status**: Use `flair zkp status` regularly

## Common Use Cases

### Data Scientist Use Case
```bash
# Create proof for model verification
flair zkp create

# Verify proof integrity
flair zkp verify

# Check all proofs
flair zkp status
```

### Production Use Case
```bash
# Batch create proofs for multiple models
for model in models/*.pt; do
  flair zkp create --model "$model"
  flair zkp verify
done
```

### Testing Use Case
```bash
# Test with small dimensions for fast proof
flair zkp create --input-dims "[1, 3, 32, 32]"

# Verify quickly
flair zkp verify
```

## Performance Tips

1. **First Run**: Proof generation takes longer (SRS setup)
2. **Smaller Dimensions**: Use smaller input dims for testing
3. **Hardware**: Run ZKML server on powerful machine
4. **Patience**: Large models may take 1-2 hours

## Example Workflow with Different Frameworks

### PyTorch

```bash
# Create repo with PyTorch
flair init --name pytorch-repo --framework pytorch

# Create proof (auto-detects .pt files)
flair zkp create

# Verify
flair zkp verify

# Status
flair zkp status
```

### TensorFlow

```bash
# Create repo with TensorFlow
flair init --name tf-repo --framework tensorflow

# Create proof (auto-detects .h5 or .keras files)
flair zkp create

# Verify
flair zkp verify
```

### ONNX

```bash
# Create repo with ONNX
flair init --name onnx-repo --framework onnx

# Create proof (uses .onnx file directly, no conversion)
flair zkp create

# Verify
flair zkp verify
```

## Success Indicators

✅ **Successful proof creation:**
- Proof file written to `.flair/.zkp/proof.json`
- Message: "✓ ZKP created successfully!"

✅ **Successful verification:**
- Verification log written to `.flair/.zkp/.verified`
- Message: "✓ Proof verified successfully!"

## Getting Help

1. Run command with `--help`: `flair zkp --help`, `flair zkp create --help`
2. Check ZKML server logs for detailed errors
3. Review `.flair/.zkp/.verified` for verification details
4. Consult [ZKP_COMMANDS.md](./ZKP_COMMANDS.md) for comprehensive guide

## Summary

You now have a complete ZKP system for your ML models:
- ✅ Create cryptographic proofs of model integrity
- ✅ Verify proofs without exposing model weights
- ✅ Support for PyTorch, TensorFlow, and ONNX
- ✅ Automatic model conversion
- ✅ Clear status and monitoring

**Happy proving! 🔐**
