"""
Configuration management for Flair CLI.
Uses YAML file stored at ~/.flair/config.yaml and Pydantic models for validation.
"""
from pathlib import Path
from typing import Optional
import yaml
from pydantic import BaseModel, Field


class FlairConfig(BaseModel):
    api_base_url: Optional[str] = None
    pinata_api_key: Optional[str] = None
    pinata_api_secret: Optional[str] = None


CONFIG_PATH = Path.home() / ".flair" / "config.yaml"


def load_config() -> FlairConfig:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return FlairConfig(**data)
    return FlairConfig()


def save_config(cfg: FlairConfig):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg.dict(exclude_none=True), f)


# Convenience
config = load_config()