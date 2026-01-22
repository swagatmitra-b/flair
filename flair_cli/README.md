# Flair CLI routes

Lines starting with `##` indicate command output.

## Authentication

```bash
flair auth login
## Opening browser for SIWS authentication...
## ✓ Authenticated as you@example.com
flair auth status
## Logged in: you@example.com
flair auth logout
## ✓ Logged out
```

## Repository Commands

### Init repository with automatic base model detection

```bash
flair init --description "My model"
## Found 2 base model file(s):
##   1. model.pt
##   2. architecture.onnx
## Would you like to upload a base model now? [y/N]: y
## Select file number (1-2): 1
## ✓ Base model uploaded successfully!
```

### Skip base model prompt during init

```bash
flair init --skip-base-model
## ✓ Repository initialized without base model upload
```

## cloning a repository

saves to .flair/repo.json and .flair/branch.json and creates three files
base_model.<ext>, params.<ext>, zkml_proof.json, zkml_settings.json,
zkml_verification_key.json in the root directory

```bash
flair clone <repo_hash>
flair clone <repo_hash> --target-dir ./repo
flair clone <repo_hash> --branch main
flair clone <repo_hash> --branch-hash main
## Cloning repository...
## ✓ Saved metadata to .flair/repo.json
## ✓ Downloaded base_model, params, zkml_proof, zkml_settings, zkml_verification_key
## Current branch: main
```

## Base model Commands

### Upload base model manually

```bash
flair basemodel add model.pt
## Uploading model.pt (42.0 MB)...
## ✓ Base model uploaded
```

### Replace existing base model (admin command)

```bash
flair basemodel add new_model.h5
## ⚠ Base model already exists
## Do you want to replace it? [y/N]: y
## Uploading new_model.h5 (55.3 MB)...
## ✓ Base model replaced
```

### Force upload without prompts

```bash
flair basemodel add model.keras --force
## Uploading model.keras (120.7 MB)...
## ✓ Base model uploaded (forced)
```

### Check if base model exists

```bash
flair basemodel check
## Base model exists: true
## Name: base_model.pt
## Size: 42.0 MB
```

### Delete base model (admin command)

```bash
flair basemodel delete
## ✓ Base model deleted
```

### Download base model

```bash
flair basemodel download
flair basemodel download --target-dir ./models
## Downloading base model to ./models/base_model.pt
## ✓ Download complete
```

## Branch Functions

### create a new branch
```bash
flair branch new-feature  # Create new branch from current
## ✓ Branch 'new-feature' created from current
```

### list all branches
```bash
flair branch              # List all branches
## Branches:
## * main
##   new-feature
```

### delete a branch
```bash
flair branch -d old-branch  # Delete a branch
## ✓ Branch 'old-branch' deleted
```


### switch branches
```bash
flair checkout main              # Uses cache if available, downloads otherwise
flair checkout feature --no-cache # Force fresh download from API
## Caching artifacts for 'main'...
## ✓ Restored artifacts from cache
## ✓ Switched to branch 'feature'
```

## Params
### Create model params
automatically detects framework used (.pt, .pth), tensorflow (.h5, .keras),
or ONNX (.onnx), extracts weights as follows: 
1. PyTorch: Extracts state_dict and saves as .pt
2. TensorFlow: Extracts weights as numpy arrays and saves as .npz
3. ONNX: Extracts initializers and saves as .npz

```bash
flair add .                        # Auto-detect and extract from model in current dir
flair add --model model.pt         # Specify PyTorch model
flair add --model model.h5         # Specify TensorFlow model
flair add --model model.onnx -o weights  # Custom output name
```

## Zero-Knowledge Proofs (ZKP)

### Create a ZKP for your model
Automatically detects model framework, converts to ONNX if needed, and generates
a zero-knowledge proof using EZKL directly in the CLI. No external server required.

Supports:
- PyTorch models (.pt, .pth)
- TensorFlow models (.h5, .keras)
- ONNX models (.onnx)

```bash
flair zkp create                                    # Auto-detect model with default input dims [1, 3, 224, 224]
## Step 1/10: Generating input data...
## Step 2/10: Generating calibration data...
## Step 3/10: Generating settings...
## Step 4/10: Calibrating settings...
## Step 5/10: Compiling circuit...
## Step 6/10: Getting SRS (Structured Reference String)...
## Step 7/10: Generating witness...
## Step 8/10: Setting up proving and verification keys...
## Step 9/10: Generating proof...
## Step 10/10: Verifying proof...
## ✓ All EZKL steps completed successfully!
## ✓ ZKP created successfully!
## Saved to: .flair/.zkp/proof.json

flair zkp create --input-dims "[1, 3, 256, 256]"   # Custom input dimensions
flair zkp create --model custom.pt                  # Specify model file
flair zkp create --backend pytorch                  # Specify backend (pytorch/tensorflow/numpy)
flair zkp create --model model.h5 --input-dims "[1, 224, 224, 3]"  # TensorFlow model
```

### Verify a ZKP
Verifies a previously generated proof using EZKL directly.

```bash
flair zkp verify
## Decoding proof artifacts...
## Running EZKL verification...
## ✓ Proof verified successfully!
## Verification log saved to: .flair/.zkp/.verified
```

### Check ZKP status
Display information about created proofs and verification status.

```bash
flair zkp status
## ZKP Status for my-model
## Location: .flair/.zkp
##
## Proof Information:
##   Model: model.pt
##   Framework: pytorch
##   Input Dims: [1, 3, 224, 224]
##   Created: 2026-01-22T10:30:45.123456
##
## Verification Status: ✓
##   Verified: 2026-01-22T10:35:12.789012
```

**Note:** ZKP generation requires EZKL and Python 3.9-3.11. Install with:
```bash
pip install ezkl
```
