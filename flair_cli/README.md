# Flair CLI commands

## Init repository with automatic base model detection
flair init --description "My model"
## Found 2 base model file(s):
##   1. model.pt
##   2. architecture.onnx
## Would you like to upload a base model now? [y/N]: y
## Select file number (1-2): 1
## ✓ Base model uploaded successfully!

## Skip base model prompt during init
flair init --skip-base-model

## Upload base model manually
flair basemodel add model.pt

## Replace existing base model
flair basemodel add new_model.h5
## ⚠ Base model already exists
## Do you want to replace it? [y/N]: y

## Force upload without prompts
flair basemodel add model.keras --force

## Check if base model exists
flair basemodel check

## Delete base model
flair basemodel delete




# authentication routes
flair auth login
flair auth status
flair auth logout




