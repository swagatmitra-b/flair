# 🚀 GET STARTED WITH FLAIR ZKP - 3 STEPS

## Step 1: Install (5 minutes)

```bash
# Install core dependencies
pip install requests typer rich

# Install model conversion tools
pip install torch onnx tensorflow tf2onnx

# Verify installation
python -c "from flair_cli.cli import zkp; print('✓ Ready!')"
```

**✅ Check**: All imports should succeed without errors

---

## Step 2: Start ZKML Server (1 minute)

Open a new terminal and run:

```bash
# Navigate to server directory
cd repository_manager/zkml_server

# Install server dependencies
pip install flask flask-cors ezkl numpy

# Start the server
python app.py
```

**Expected output**:
```
Starting ZKML Server on 0.0.0.0:2003
 * Running on http://0.0.0.0:2003
```

**✅ Check**: Server is running on port 2003

In another terminal, test health:
```bash
curl http://localhost:2003/health
```

---

## Step 3: Create Your First ZKP (5 minutes)

In the main terminal:

```bash
# Navigate to your ML project directory
cd /path/to/your/ml/project

# Initialize a Flair repository
flair init --name my-ml-repo --framework pytorch

# Create a Zero-Knowledge Proof
flair zkp create

# Check the result
flair zkp status

# Verify the proof
flair zkp verify
```

**What happens**:
1. `flair init` creates `.flair/` directory with config
2. `flair zkp create` finds your model and generates proof
3. `flair zkp status` shows proof information
4. `flair zkp verify` verifies the proof

**✅ Success indicators**:
```
✓ ZKP created successfully!
Saved to: .flair/.zkp/proof.json

✓ Proof verified successfully!
Verification log saved to: .flair/.zkp/.verified
```

---

## Next Steps

### Explore Options
```bash
# See all available options
flair zkp --help
flair zkp create --help
flair zkp verify --help

# Check current status
flair zkp status
```

### Try Different Models

**TensorFlow Model:**
```bash
flair zkp create --model model.h5 --input-dims "[1, 28, 28, 1]"
```

**Custom Input Dimensions:**
```bash
flair zkp create --input-dims "[1, 3, 512, 512]"
```

**Different Backend:**
```bash
flair zkp create --backend tensorflow
```

---

## Common Issues & Quick Fixes

### ❌ "Could not connect to ZKML server"
**Fix**: Make sure server is running
```bash
# In a separate terminal
cd repository_manager/zkml_server
python app.py
```

### ❌ "No model found"
**Fix**: Specify model path
```bash
flair zkp create --model /path/to/model.pt
```

### ❌ "Not in a Flair repository"
**Fix**: Initialize repository first
```bash
flair init --name my-repo --framework pytorch
```

### ❌ "PyTorch to ONNX conversion failed"
**Fix**: Install required packages
```bash
pip install torch onnx
```

---

## File Structure After Setup

```
your-ml-repo/
├── .flair/
│   ├── repo_config.json
│   └── .zkp/
│       ├── proof.json        ← Your proof
│       └── .verified         ← Verification log
├── model.pt                  ← Your model
└── (your other files)
```

---

## Understanding the Output

### When Creating Proof

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

**What happened**:
1. Found your PyTorch model
2. Converted it to ONNX (required format)
3. Sent to ZKML server
4. Server generated cryptographic proof
5. Downloaded and stored locally

### When Verifying Proof

```
Verifying Zero-Knowledge Proof...
Proof timestamp: 2025-01-22T10:30:00.123456

Sending to ZKML server...
[████████████████████████████] 100%

✓ Proof verified successfully!
Verification log saved to: .flair/.zkp/.verified
```

**What happened**:
1. Loaded your proof
2. Sent to ZKML server for verification
3. Server verified it's authentic
4. Saved verification timestamp

### Status Report

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

**What you see**:
- When the proof was created
- What model and framework were used
- Whether it's been verified
- When verification happened

---

## What's Happening Behind the Scenes

### Proof Creation
1. **Detect** - Find your model file
2. **Convert** - Change format to ONNX if needed
3. **Send** - Upload to ZKML server
4. **Generate** - Server creates cryptographic proof
5. **Download** - Get compressed artifacts
6. **Store** - Save in `.flair/.zkp/proof.json`

### Proof Verification
1. **Load** - Read proof from `.flair/.zkp/proof.json`
2. **Send** - Upload to ZKML server
3. **Verify** - Server checks proof is valid
4. **Log** - Save verification result to `.flair/.zkp/.verified`

---

## Supported Models

### PyTorch
```bash
# File extensions: .pt, .pth
flair zkp create --model model.pt --backend pytorch
```

### TensorFlow
```bash
# File extensions: .h5, .keras
flair zkp create --model model.h5 --backend tensorflow
```

### ONNX
```bash
# File extensions: .onnx
flair zkp create --model model.onnx
```

---

## Input Dimensions Guide

Different model types need different dimensions:

### For Image Models
```bash
# Standard ImageNet (224x224 RGB)
flair zkp create --input-dims "[1, 3, 224, 224]"

# Small images (32x32, like CIFAR-10)
flair zkp create --input-dims "[1, 3, 32, 32]"

# Grayscale images
flair zkp create --input-dims "[1, 1, 224, 224]"
```

### For Other Models
```bash
# Tabular/Dense data
flair zkp create --input-dims "[1, 128]"

# Time series data
flair zkp create --input-dims "[1, 100, 50]"
```

---

## Time Estimates

### First Run
| Model Size | Time | Notes |
|-----------|------|-------|
| Small | 5-15 min | Setup + proof |
| Medium | 15-45 min | Includes calibration |
| Large | 1-3+ hours | Complex circuits |

### Subsequent Runs
- Create: Same as above
- Verify: 1-5 minutes

---

## Troubleshooting Flowchart

```
Something not working?
│
├─ "Not in a Flair repository"
│  └─ Run: flair init --name my-repo --framework pytorch
│
├─ "No model found"
│  └─ Run: flair zkp create --model /path/to/model
│
├─ "Could not connect to ZKML server"
│  └─ Start server: python zkml_server/app.py
│
├─ "Conversion failed"
│  └─ Install: pip install torch onnx tensorflow tf2onnx
│
└─ Still stuck?
   └─ Check: flair zkp --help
   └─ Read: ZKP_COMMANDS.md
   └─ Check server logs
```

---

## Success Checklist

After completing all steps, check:

- [ ] ZKML server running (no errors)
- [ ] `flair zkp --help` shows 3 commands
- [ ] Repository initialized with `flair init`
- [ ] Model file exists in directory
- [ ] `flair zkp create` completes successfully
- [ ] `.flair/.zkp/proof.json` file created
- [ ] `flair zkp verify` shows ✓ verified
- [ ] `.flair/.zkp/.verified` file created
- [ ] `flair zkp status` shows full information

---

## What to Do Next

### 1. Learn More
Read the full documentation:
- **Quick reference**: `ZKP_QUICKSTART.md`
- **Full guide**: `ZKP_COMMANDS.md`
- **Setup guide**: `ZKP_REQUIREMENTS.md`

### 2. Try Different Scenarios
```bash
# Try different models
flair zkp create --model model2.pt

# Try different dimensions
flair zkp create --input-dims "[1, 3, 512, 512]"

# Try different frameworks
flair zkp create --framework tensorflow
```

### 3. Integrate with Your Workflow
```bash
# Combine with other Flair commands
flair add extract-params
flair branch create feature-branch
flair zkp create
flair commit push
```

### 4. Automate Proofs
Create scripts to generate proofs automatically:
```bash
#!/bin/bash
for model in models/*.pt; do
  flair zkp create --model "$model"
  flair zkp verify
done
```

---

## Performance Tips

1. **First Run**: Takes longer (SRS setup)
2. **Smaller Models**: Proof faster
3. **Smaller Dimensions**: Test quickly
4. **Powerful Hardware**: Faster proofs
5. **SSD Storage**: Better performance

---

## Getting Help

### Command Help
```bash
flair zkp --help           # All commands
flair zkp create --help    # Create options
flair zkp verify --help    # Verify options
```

### Server Status
```bash
curl http://localhost:2003/health
```

### Documentation
1. `ZKP_QUICKSTART.md` - Quick start
2. `ZKP_COMMANDS.md` - Full reference
3. `ZKP_REQUIREMENTS.md` - Setup
4. `ZKP_IMPLEMENTATION_SUMMARY.md` - Technical

---

## Summary

You now have everything to:
✅ Create cryptographic proofs of your ML models
✅ Verify proofs without exposing model weights
✅ Support PyTorch, TensorFlow, and ONNX
✅ Automatically convert models as needed

### Quick Command Reference
```bash
flair zkp create      # Create proof
flair zkp verify      # Verify proof
flair zkp status      # Check status
```

---

## 🎉 You're Ready!

Start with:
```bash
cd /path/to/your/project
flair init --name my-repo --framework pytorch
flair zkp create
flair zkp verify
```

**Happy proving! 🔐**

---

For more help, see:
- **Quick Questions**: `ZKP_QUICKSTART.md`
- **Detailed Info**: `ZKP_COMMANDS.md`
- **Technical Details**: `ZKP_IMPLEMENTATION_SUMMARY.md`
