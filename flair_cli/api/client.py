from .auth import verify_auth
from .basemodel import get_base_model_url, upload_base_model, delete_base_model
from .repo import create_repo, list_repos, get_repo, clone_repository
from .artifacts import register_artifact, download_artifact
from .commit import create_commit, list_commits, get_commit
from .utils import _base_url, _client_with_auth

# __all__ restricts what gets exported if someone does "from client import *"

__all__ = [
    "verify_auth",
    "get_base_model_url",
    "upload_base_model",
    "delete_base_model",
    "create_repo",
    "list_repos",
    "get_repo",
    "clone_repository",
    "clone_repository",
    "register_artifact",
    "download_artifact",
    "create_commit",
    "list_commits",
    "get_commit",
    "_base_url",
    "_client_with_auth",
]