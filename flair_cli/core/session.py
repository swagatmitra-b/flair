"""
Session management: stores session token and wallet address in a file under ~/.flair/session.json
NOTE: We never store private keys.
"""
from pathlib import Path
from pydantic import BaseModel
import json
from typing import Optional


SESSION_PATH = Path.home() / ".flair" / "session.json"


class Session(BaseModel):
    token: str
    wallet_address: Optional[str]
    expires_at: Optional[str]


def load_session() -> Optional[Session]:
    if SESSION_PATH.exists():
        data = json.loads(SESSION_PATH.read_text(encoding="utf-8"))
        return Session(**data)
    return None


def save_session(session: Session):
    SESSION_PATH.parent.mkdir(parents=True, exist_ok=True)
    SESSION_PATH.write_text(session.json(), encoding="utf-8")


def clear_session():
    if SESSION_PATH.exists():
        SESSION_PATH.unlink()
