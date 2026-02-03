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

### Create sample model files

Generate sample model scaffolds to help you get started quickly. The generated files include example architectures and usage patterns.

```bash
flair new --example pytorch
## ✓ PyTorch sample model created: model_pytorch.py
## 
## The file includes:
##   • Sample CNN model class
##   • Example save/load functions
##   • Usage examples
## 
## To save your model for Flair:
##   1. Modify the model as needed
##   2. Run the script to generate model.pt
##   3. Use 'flair params create --model model.pt'

flair new --example tensorflow
## ✓ TensorFlow sample model created: model_tensorflow.py
## 
## The file includes:
##   • Sample CNN model (Sequential API)
##   • Alternative Functional API example
##   • Example save/load functions
##   • Usage examples

flair new --example pytorch --output my_model.py  # Custom output filename
## ✓ PyTorch sample model created: my_model.py
```

**Note:** The generated files are only sample scaffolds. You are free to modify or ignore them. Flair does not require any specific architecture format.

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
saves repo metadata to .flair/repo.json plus branch pointers in .flair/HEAD and .flair/branches.json,
and downloads the latest artifacts (base_model.<ext>, params.<ext>, zkml_proof.json,
zkml_settings.json, zkml_verification_key.json) into the repo root

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

## Commit Workflow

### Create a new local commit
Creates a new commit in `.flair/.local_commits/` with a unique UUID. This must be done before creating params or ZKP.

```bash
flair add
## ✓ New local commit created
##   Commit hash: a1b2c3d4...
##   Location: .flair/.local_commits/a1b2c3d4.../
## 
## Next steps:
##   1. Run 'flair params create' to add model parameters
##   2. Run 'flair zkp create' to generate zero-knowledge proof
##   3. Run 'flair commit -m "Your message"' to finalize commit
##   4. Run 'flair push' to upload commit to repository
```

**Note:** You cannot create a new commit until the current one is complete (has both params and ZKP).

### Create model params
Extracts model parameters and saves them to the current commit directory.
Automatically detects framework (.pt, .pth for PyTorch, .h5, .keras for TensorFlow, or .onnx).

**Prerequisites:** Must run `flair add` first to create a commit.

```bash
flair params create                # Auto-detect model in current directory
flair params create --model model.pt  # Specify PyTorch model
flair params create --model model.h5  # Specify TensorFlow model
## ✓ Parameters saved to commit directory
##   File: params.pt
##   Hash: 1a2b3c4d5e6f7g8h...
## 
## Next steps:
##   1. (Optional) Run 'flair zkp create' to generate zero-knowledge proof
##   2. Run 'flair commit -m "Your message"' to finalize commit and compute delta
##   3. Run 'flair push' to upload commit to repository
```

**Extraction details:**
1. PyTorch: Extracts state_dict and saves as .pt
2. TensorFlow: Extracts weights as numpy arrays and saves as .npz
3. ONNX: Extracts initializers and saves as .npz

**Storage optimization (Advanced):**
Full parameters are automatically managed by the `flair commit` command:
- **Genesis commit (CHECKPOINT)**: Full parameters retained
- **Subsequent commits (DELTA)**: Delta computed and stored; cleanup deletes full params from older commits
- **Latest 2 commits**: Always retain full parameters for reliable delta computation
- **Older commits**: Only store deltas (~90-95% smaller than full params)
- **Reconstruction**: If a previous commit's full params are deleted, they are automatically reconstructed from the CHECKPOINT by applying deltas serially

This strategy provides significant storage savings (95%+ for large commit histories) while maintaining data integrity.

**Note:** You cannot overwrite existing params. To create new params, run `flair add` to create a new commit first.

## Zero-Knowledge Proofs (ZKP)

### Create a ZKP for your model
Generates a zero-knowledge proof for the model in the current commit directory.
Automatically detects model framework, converts to ONNX if needed, and generates
the proof using EZKL directly in the CLI. No external server required.

**Prerequisites:** 
- Must run `flair add` to create a commit
- Must run `flair params create` to extract parameters (optional but recommended)

Supports:
- PyTorch models (.pt, .pth)
- TensorFlow models (.h5, .keras)
- ONNX models (.onnx)

```bash
flair zkp create                                    # Auto-detect model with default input dims [1, 3, 224, 224]
## Generating Zero-Knowledge Proof using EZKL...
## This may take several minutes depending on model complexity...
## 
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
## Saved to: a1b2c3d4.../
## Proof files: proof.zlib, verification_key.zlib, settings.zlib
## 
## Next steps:
##   • Run 'flair commit -m "Your message"' to finalize this commit
##   • Run 'flair push' to push this commit to the repository

flair zkp create --input-dims "[1, 3, 256, 256]"   # Custom input dimensions
flair zkp create --model custom.pt                  # Specify model file
flair zkp create --backend pytorch                  # Specify backend (pytorch/tensorflow/numpy)
flair zkp create --model model.h5 --input-dims "[1, 224, 224, 3]"  # TensorFlow model
```

**Note:** You cannot overwrite an existing ZKP. To create a new ZKP, run `flair add` to create a new commit first.

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

### Finalize commit with message
Finalizes the commit by setting the message, determining commit type (CHECKPOINT for genesis, DELTA for subsequent), computing parameter deltas, and cleaning up old storage.

**Prerequisites:**
- Must run `flair add` to create a commit
- Must run `flair params create` to extract parameters
- Must run `flair zkp create` to generate zero-knowledge proof

**Commit Types:**
- **CHECKPOINT**: First commit in repository. Stores full parameters.
- **DELTA**: Subsequent commits. Computes and stores only parameter differences from previous commit.

```bash
flair commit -m "Initial model commit"
## ✓ Computing delta from previous commit...
## Previous commit: Genesis (CHECKPOINT)
## 
## ✓ Commit finalized
##   Commit hash: a1b2c3d4f5g6h7i8...
##   Commit type: CHECKPOINT
##   Message: Initial model commit
##   Parameters: Full params retained (100 MB)
## 
## Next step:
##   Run 'flair push' to upload commit to repository

flair commit -m "Updated with training data v2"
## ✓ Computing delta from previous commit...
## Previous commit: a1b2c3d4f5g6h7i8...
## ✓ PyTorch delta computed (2.34 MB)
## 
## ✓ Commit finalized
##   Commit hash: b2c3d4e5f6g7h8i9...
##   Commit type: DELTA
##   Message: Updated with training data v2
##   Parameters: Delta stored (2.34 MB), full params retained for next delta
##   Storage cleanup: Removed full params from 1 old commit
## 
## Next step:
##   Run 'flair push' to upload commit to repository
```

**How it works:**
1. Checks if this is the first commit in the repository (genesis)
2. Sets `commitType` to `CHECKPOINT` for genesis, `DELTA` for subsequent commits
3. For DELTA commits:
   - Loads current and previous parameters
   - Computes delta: `delta = current - previous`
   - Stores delta in `.delta_params/` folder
   - Cleans up full parameters from old DELTA commits (keeps latest 2 + all CHECKPOINT)
4. Stores message and commitType in commit.json
5. The push command uses this type to determine which file to upload:
   - CHECKPOINT: uploads full params from `.params/` folder
   - DELTA: uploads delta params from `.delta_params/` folder

**Parameter Reconstruction (Automatic Fallback):**
If a previous commit's full parameters were deleted during cleanup, they are automatically reconstructed:
- Traverses backward through commit history to find the CHECKPOINT
- Loads the CHECKPOINT full parameters
- Applies deltas serially forward to reconstruct the target commit
- Returns reconstructed parameters for delta computation
- Reconstruction is transparent and maintains data integrity

**Storage Optimization Summary:**
- Genesis CHECKPOINT commit keeps full params
- Latest 2 commits always keep full params (for reliable delta computation)
- Older DELTA commits store only deltas (95% smaller)
- Total savings: 95%+ for large commit histories
- Safety: Automatic reconstruction ensures no data loss

**Note:** You cannot finalize a commit twice. To create a new commit, run `flair add` first.

## Push Commits

### Push commits to remote repository
Uploads all completed local commits serially to the remote repository. Supports batch pushing of multiple commits in chronological order. Each commit uses either CHECKPOINT or DELTA type based on position in history.

**New Batch Push Capability:**
- Create multiple local commits before pushing
- Push all completed commits at once in chronological order
- Automatic synchronization with remote HEAD
- Skips incomplete commits (stops at first incomplete)
- Each commit goes through full 5-step validation

**Prerequisites (for each commit):**
- Must run `flair add` to create a commit
- Must run `flair params create` to extract model parameters
- Must run `flair zkp create` to generate zero-knowledge proof
- Must run `flair commit -m "message"` to finalize commit, compute delta, and determine type
- Commit must be complete (params, ZKP, delta computation, and finalized message)

**Upload behavior based on commit type:**
- **CHECKPOINT** (genesis): Uploads full parameters from `.params/` folder (~100 MB for typical models)
- **DELTA**: Uploads delta parameters from `.delta_params/` folder (difference from previous commit, ~2-8 MB typical)

**Features:**
- **Serial pushing**: Pushes commits in creation time order (oldest first)
- **Smart filtering**: Only pushes complete commits, skips incomplete ones
- **Remote sync**: Fetches remote HEAD via `/latest` endpoint to avoid duplicates
- **Auto-branching**: Creates branch if it doesn't exist (e.g., first push creates 'main')
- **ZKML validation**: Validates ZKML proof uniqueness before upload
- **IPFS upload**: Uploads binary proof artifacts and parameters to IPFS
- **HEAD update**: Updates local HEAD with latest pushed commit hash
- **Progress tracking**: Shows X/Y commits pushed with detailed per-commit logs

```bash
# First push - single CHECKPOINT commit (genesis)
flair push -u origin main
## 
## Pushing to branch: main
## Found 1 local commit(s)
## Branch 'main' not found. Creating...
## ✓ Branch 'main' created
## Remote HEAD: Genesis (no commits yet)
## Pushing 1 commit(s) serially...
## 
## ═══ Commit 1/1 ═══
## Hash: a1b2c3d4...
## Type: CHECKPOINT
## Message: Initial model commit
## Parent: Genesis...
## 
## Step 1/5: Initiating commit session...
## ✓ Session initiated
## Step 2/5: Checking ZKML proof uniqueness...
## ✓ ZKML proof verified as unique
## Step 3/5: Uploading ZKML proofs...
## ✓ ZKML proofs uploaded
## Step 4/5: Uploading parameters...
## ✓ Parameters uploaded (hash: 1a2b3c4d...)
## Step 5/5: Finalizing commit...
## ✓ Commit 1 created successfully!
##   Hash: a1b2c3d4...
##   Type: CHECKPOINT
## 
## ═══════════════════════════════════
## ✓ Push complete!
##   Branch: main
##   Commits pushed: 1/1
##   Latest commit: a1b2c3d4...
## ═══════════════════════════════════
## 
## ✓ HEAD updated

# Batch push - multiple DELTA commits at once
flair push main
## Pushing to branch: main
## Found 4 local commit(s)
## Remote HEAD: a1b2c3d4...
## Skipping incomplete commit: z9y8x7w6...  # Being worked on
## Pushing 3 commit(s) serially...
## 
## ═══ Commit 1/3 ═══
## Hash: b2c3d4e5...
## Type: DELTA
## Message: Updated with training data v2
## Parent: a1b2c3d4...
## 
## Step 1/5: Initiating commit session...
## ✓ Session initiated
## Step 2/5: Checking ZKML proof uniqueness...
## ✓ ZKML proof verified as unique
## Step 3/5: Uploading ZKML proofs...
## ✓ ZKML proofs uploaded
## Step 4/5: Uploading parameters...
## ✓ Parameters uploaded (hash: 2b3c4d5e...)
## Step 5/5: Finalizing commit...
## ✓ Commit 1 created successfully!
##   Hash: b2c3d4e5...
##   Type: DELTA
## 
## ═══ Commit 2/3 ═══
## Hash: c3d4e5f6...
## Type: DELTA
## Message: Improved accuracy to 95%
## Parent: b2c3d4e5...
## [... 5 steps ...]
## ✓ Commit 2 created successfully!
##   Hash: c3d4e5f6...
##   Type: DELTA
## 
## ═══ Commit 3/3 ═══
## Hash: d4e5f6g7...
## Type: DELTA
## Message: Fine-tuned hyperparameters
## Parent: c3d4e5f6...
## [... 5 steps ...]
## ✓ Commit 3 created successfully!
##   Hash: d4e5f6g7...
##   Type: DELTA
## 
## ═══════════════════════════════════
## ✓ Push complete!
##   Branch: main
##   Commits pushed: 3/3
##   Latest commit: d4e5f6g7...
## ═══════════════════════════════════
## 
## ✓ HEAD updated

# Push to current branch (from HEAD)
flair push
## ✓ All commits already pushed. Branch is up to date.
```

**Push Workflow:**
1. Fetches all local commits sorted by creation time (oldest first)
2. Gets remote HEAD commit from `/latest` endpoint
3. Filters only complete commits (params + ZKP + finalized message)
4. Stops at first incomplete commit (skip the one being worked on)
5. Compares local commits with remote HEAD to find divergence point
6. For each commit to push (serially):
   - Step 1: Initiates commit session with parent commit hash
   - Step 2: Checks ZKML proof CID uniqueness
   - Step 3: Uploads ZKML binary files (proof.zlib, verification_key.zlib, settings.zlib)
   - Step 4: Uploads parameters binary file with SHA256 hash
   - Step 5: Finalizes commit with message, paramHash, and architecture
   - Updates parent hash for next commit in chain
7. Updates `.flair/HEAD` with latest pushed commit hash and branch info
8. Displays summary: commits pushed (X/Y) and final HEAD

**Error handling:**
- Skips commits with missing params or ZKP files (continues to next)
- Validates ZKML proof uniqueness for each commit (prevents duplicate proofs)
- Continues pushing remaining commits if one fails
- Shows clear error messages for failed commits (✗ Commit X: reason)

## Directory structure (CLI)

# Created in each repo after `flair init`
```bash
.flair/
	repo_config.json         # Repo metadata from init (framework, description, repo hash)
	repo.json                # Remote repo snapshot used by clone/checkout
	HEAD                     # Current branch pointer (name + branchHash)
	branches.json            # Cached branch list for the repo
	.local_commits/          # Local commits directory
		<uuidv4>/              # Each commit has its own directory
			commit.json          # Commit metadata (params, zkp, message, status)
			params.pt|npz        # Extracted model weights (framework-dependent)
			.delta_params/       # Delta parameters directory
				delta.pt|npz       # Parameter differences from previous commit
			proof.zlib           # Compressed ZK proof
			verification_key.zlib  # Compressed VK
			settings.zlib        # Compressed settings
	.cache/                  # Per-branch cached artifacts (managed by checkout)
		<branch>/              # Cached params/zkp files for that branch

# HEAD file contains the following:
## "currentBranch": branch_data.get("name"),
## "branchHash": branch_data.get("branchHash"),
## "description": branch_data.get("description"),
## "latestCommitHash": latest_commit.get("commitHash")  # Added by clone/push
```

## Complete Workflow Example

Here's a complete workflow from initialization to pushing a commit:

```bash
# 1. Initialize repository
flair init --description "My ML model repo"

# 2. Create a new local commit
flair add
## ✓ New local commit created
##   Commit hash: a1b2c3d4...

# 3. Extract model parameters
flair params create
## ✓ Parameters saved to commit directory
##   File: params.pt

# 4. Generate zero-knowledge proof
flair zkp create --input-dims "[1, 3, 224, 224]"
## ✓ All EZKL steps completed successfully!
## ✓ ZKP created successfully!

# 5. Finalize and push first commit
flair commit -m "Initial model commit"
flair push -u origin main
## ✓ Branch 'main' created
## ✓ Push complete! Commits pushed: 1/1

# 6. Create multiple commits locally (batch workflow)
# ... modify model (round 1) ...
flair add
flair params create
flair zkp create
flair commit -m "Improved accuracy to 95%"

# ... modify model (round 2) ...
flair add
flair params create
flair zkp create
flair commit -m "Fine-tuned hyperparameters"

# ... modify model (round 3) ...
flair add
flair params create
flair zkp create
flair commit -m "Added data augmentation"

# 7. Push all commits at once (batch push)
flair push main
## Pushing 3 commit(s) serially...
## ✓ Push complete! Commits pushed: 3/3

# 8. Continue working on next commit (not pushed yet)
flair add
flair params create
# ... still working, not finalized yet ...

# 9. Push again - skips incomplete commit
flair push main
## Skipping incomplete commit: abc123...
## ✓ All commits already pushed. Branch is up to date.

# 10. Switch branches
flair branch experimental
flair checkout experimental
flair add
flair params create
flair zkp create
flair commit -m "Experimental architecture"
flair push
```

## Validation Rules

The CLI enforces a strict sequential workflow to prevent incomplete commits:

1. **Creating a new commit (`flair add`):**
   - Blocked if the current commit is incomplete (missing params or ZKP)
   - Error: "Cannot create a new commit yet. Complete the current commit first."

2. **Creating params (`flair params create`):**
   - Blocked if params already exist in the current commit
   - Error: "This commit already has parameters. Run 'flair add' to create a new commit."

3. **Creating ZKP (`flair zkp create`):**
   - Blocked if ZKP already exists in the current commit
   - Error: "This commit already has a zero-knowledge proof. Run 'flair add' to create a new commit."

4. **Pushing (`flair push`):**
   - Requires both params and ZKP to be complete
   - Error: "Commit incomplete. Run 'flair params create' and/or 'flair zkp create'."

This ensures every commit is complete and prevents accidental overwrites.
