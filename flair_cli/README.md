# Flair CLI

Flair is a record-only repository and commit ledger for ML model evolution.
This CLI is Python-first, scriptable, and designed to be used in CI/CD and ML orchestration.

Key points:
- Language: Python 3.10+
- CLI framework: Typer
- HTTP: httpx
- Terminal output: rich
- Config & validation: pydantic
- Encryption: cryptography (AES-256-GCM)
- Storage: IPFS via Pinata
- Auth: SIWS (Sign-In With Solana) using Phantom

Quickstart examples

Authenticate (SIWS):

1. Request a SIWS message to sign:

    flair auth login --address <your-solana-address>

2. Sign the message with your wallet (Phantom) and then exchange the signature for a session token:

    flair auth login --address <your-address> --message "<signed-message>" --signature "<signature>"

Create repo with optional base model upload:

    flair repo create --name my-model --description "Test" --private --base-model ./model.pt --wallet-pubkey "<pubkey>"

Create a commit (delta or checkpoint):

    # For private repos, pass --encrypt and --rmk-b64 to encrypt the DEK with an RMK
    flair commit delta --repo <repo_id> --file ./delta.bin --metadata '{"framework":"pytorch","round":1}' --encrypt --rmk-b64 <base64-rmk>

Reconstruct commit:

    flair reconstruct --repo <repo_id> --commit <hash> --rmk-b64 <base64-rmk> --out-dir ./recon

Config is saved at `~/.flair/config.yaml` and session at `~/.flair/session.json`.

Security notes:
- Flair never stores wallet private keys. RMK encryption for wallets relies on wallet APIs in production.
- Use CI secrets or environment variables for Pinata credentials.

For full help on commands, run `flair --help` or `flair <command> --help`.