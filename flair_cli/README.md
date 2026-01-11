# Flair CLI

Flair is a record-only repository and commit ledger for ML model evolution.
This CLI is Python-first, scriptable, and designed to be used in CI/CD and ML orchestration.

Key points:
- Language: Python 3.10+
- CLI framework: Typer
- HTTP: httpx
- Terminal output: rich
- Config & validation: pydantic
- Storage: Managed by backend via HTTP (no client-side encryption)
- Auth: SIWS (Sign-In With Solana) using Phantom

Quickstart examples

Authenticate (SIWS):

1. Request a SIWS message to sign:

    flair auth login --address <your-solana-address>

2. Sign the message with your wallet (Phantom) and then exchange the signature for a session token:

    flair auth login --address <your-address> --message "<signed-message>" --signature "<signature>"

Create repo:

    flair repo create --name my-model --description "Test" --private

Create a commit (delta or checkpoint) using an existing artifact reference:

    flair commit delta --repo <repo_id> --artifact-ref <artifact_id_or_uri> --metadata '{"framework":"pytorch","round":1}'

Reconstruct (download) commit artifact:

    flair reconstruct --repo <repo_id> --commit <hash> --out-dir ./recon

Config is saved at `~/.flair/config.yaml` and session at `~/.flair/session.json`.

Security notes:
- Flair never stores wallet private keys.
- Artifacts are stored transparently without client-side encryption.

For full help on commands, run `flair --help` or `flair <command> --help`.