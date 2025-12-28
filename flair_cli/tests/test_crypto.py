import base64
from flair_cli.core import crypto


def test_aes_roundtrip():
    key = crypto.generate_dek()
    plaintext = b"hello world"
    enc = crypto.aes_encrypt(plaintext, key)
    dec = crypto.aes_decrypt(enc, key)
    assert dec == plaintext


def test_dek_wrap_unwrap():
    dek = crypto.generate_dek()
    rmk = crypto.generate_rmk()
    enc_dek = crypto.encrypt_dek_with_rmk(dek, rmk)
    dec_dek = crypto.decrypt_dek_with_rmk(enc_dek, rmk)
    assert dec_dek == dek


# Note: SealedBox tests require a keypair; we do a basic encrypt/decrypt using generated keys.

def test_sealedbox_rmk_wrap():
    rmk = crypto.generate_rmk()
    # Generate key pair
    from nacl.public import PrivateKey
    priv = PrivateKey.generate()
    pub = priv.public_key
    enc = crypto.encrypt_rmk_for_wallet(rmk, bytes(pub))
    # Decrypt using sk
    # To use decrypt_rmk_for_wallet we need Ed25519 secret key, but here we have Curve25519 keys.
    # This is a smoke test that encrypt/decrypt via SealedBox with the curve key works.
    from nacl.public import SealedBox
    dec = SealedBox(priv).decrypt(enc)
    assert dec == rmk