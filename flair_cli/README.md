# Flair CLI routes

Lines starting with `##` indicate command output.

## Authentication
```bash
flair auth login
flair auth status
flair auth logout
```

## Init repository with automatic base model detection
```bash
flair init --description "My model"
## Found 2 base model file(s):
##   1. model.pt
##   2. architecture.onnx
## Would you like to upload a base model now? [y/N]: y
## Select file number (1-2): 1
## ✓ Base model uploaded successfully!
```

## Skip base model prompt during init
```bash
flair init --skip-base-model
```

## Upload base model manually
```bash
flair basemodel add model.pt
```

## Replace existing base model
```bash
flair basemodel add new_model.h5
## ⚠ Base model already exists
## Do you want to replace it? [y/N]: y
```

## Force upload without prompts
```bash
flair basemodel add model.keras --force
```

## Check if base model exists
```bash
flair basemodel check
```

## Delete base model
```bash
flair basemodel delete
```





