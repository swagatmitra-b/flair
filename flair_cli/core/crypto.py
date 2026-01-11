"""
DEPRECATED: Cryptographic utilities for Flair CLI.

This module is no longer used by the CLI. Flair is designed for complete transparency,
and all artifacts are stored and transmitted without encryption. The backend
repository manager handles all artifact management via HTTP endpoints.

Note: This module is kept for reference only and should not be imported by CLI commands.

Legacy design notes:
- Artifact encryption used AES-256-GCM via cryptography.AESGCM.
- Each artifact had a random 32-byte DEK (data encryption key).
- DEK was encrypted with the Repo Master Key (RMK) using AES-GCM.
- RMK was a 32-byte symmetric key generated per-repo.
- RMK encryption per-wallet used public-key sealed boxes (PyNaCl SealedBox).
"""
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
from typing import Tuple
import nacl.bindings
import nacl.public
import base64


def generate_dek() -> bytes:
    """Return a 32-byte random DEK (AES-256). DEPRECATED - not used."""
    return os.urandom(32)


def generate_rmk() -> bytes:
    """Return a 32-byte Repo Master Key (RMK)."""
    return os.urandom(32)


def aes_encrypt(plaintext: bytes, key: bytes) -> bytes:
    """Encrypt using AES-256-GCM. Returns nonce + ciphertext (ciphertext already contains tag)."""
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ct


def aes_decrypt(nonce_and_ct: bytes, key: bytes) -> bytes:
    """Decrypt AES-256-GCM using nonce prefix."""
    nonce = nonce_and_ct[:12]
    ct = nonce_and_ct[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None)


def encrypt_dek_with_rmk(dek: bytes, rmk: bytes) -> bytes:
    """Encrypt DEK using RMK (symmetric AES-GCM)."""
    return aes_encrypt(dek, rmk)


def decrypt_dek_with_rmk(encrypted_dek: bytes, rmk: bytes) -> bytes:
    """Decrypt encrypted DEK using RMK."""
    return aes_decrypt(encrypted_dek, rmk)


def encrypt_rmk_for_wallet(rmk: bytes, wallet_ed25519_pubkey: bytes) -> bytes:
    """
    Encrypt RMK for a Solana wallet's public key using SealedBox.
    Accepts wallet_ed25519_pubkey as raw bytes (32 bytes).
    Returns sealed box bytes (ciphertext).
    """
    # Convert Ed25519 public key to Curve25519 public key
    curve_pk = nacl.bindings.crypto_sign_ed25519_pk_to_curve25519(wallet_ed25519_pubkey)
    recipient_pk = nacl.public.PublicKey(curve_pk)
    sealed = nacl.public.SealedBox(recipient_pk).encrypt(rmk)
    return sealed


def decrypt_rmk_for_wallet(encrypted_rmk: bytes, wallet_ed25519_secretkey: bytes) -> bytes:
    """
    Decrypt RMK encrypted for a wallet using the wallet's Ed25519 secret key (64 bytes: priv+pub).
    WARNING: This requires the wallet secret key; the CLI must NOT store this key persistently.
    This function is provided for integration tests or controlled environments only.
    """
    curve_sk = nacl.bindings.crypto_sign_ed25519_sk_to_curve25519(wallet_ed25519_secretkey)
    priv = nacl.public.PrivateKey(curve_sk)
    box = nacl.public.SealedBox(priv)
    return box.decrypt(encrypted_rmk)


# Small helpers for encoding to store small binary blobs as base64 for JSON/YAML storage.

def b64_encode(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def b64_decode(s: str) -> bytes:
    return base64.b64decode(s.encode("ascii"))