"""
Cryptographic utilities for Flair CLI.

Design decisions and security notes:
- Artifact encryption uses AES-256-GCM via cryptography.AESGCM.
- Each artifact gets a random 32-byte DEK (data encryption key).
- DEK is encrypted with the Repo Master Key (RMK) using AES-GCM.
- RMK is a 32-byte symmetric key generated per-repo.
- RMK encryption per-wallet uses public-key sealed boxes (PyNaCl SealedBox).
  Solana wallets are Ed25519 keys; we convert Ed25519 public keys to Curve25519
  to support public-key encryption (compatibility provided by libsodium / PyNaCl bindings).

Important: The CLI never stores private keys. Decrypting an RMK for a wallet requires
that wallet to provide a way to decrypt (for example, performed client-side by the wallet API).
For demo/testing purposes, helper functions are provided that take an Ed25519 private key
and decrypt the sealed box. In production the wallet should be used to do this step.
"""
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
from typing import Tuple
import nacl.bindings
import nacl.public
import base64


def generate_dek() -> bytes:
    """Return a 32-byte random DEK (AES-256)."""
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