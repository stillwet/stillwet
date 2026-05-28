#!/usr/bin/env python3
"""Migrate Cursor agent/chat history after renaming XtinadomMerch -> StillWet."""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

OLD_PATH = Path(r"C:\Users\britt\Documents\GitHub\XtinadomMerch")
NEW_PATH = Path(r"C:\Users\britt\Documents\GitHub\StillWet")
OLD_WS = "b9e3f41717a7d299fa8994788673b8c9"
NEW_WS = "051751c3dd0d572b5923c33448d531e5"

OLD_PROJECT = Path(
    r"C:\Users\britt\.cursor\projects\c-Users-britt-Documents-GitHub-XtinadomMerch"
)
NEW_PROJECT = Path(
    r"C:\Users\britt\.cursor\projects\c-Users-britt-Documents-GitHub-StillWet"
)

CURSOR_USER = Path(r"C:\Users\britt\AppData\Roaming\Cursor\User")
OLD_WS_DIR = CURSOR_USER / "workspaceStorage" / OLD_WS
NEW_WS_DIR = CURSOR_USER / "workspaceStorage" / NEW_WS
GLOBAL_DB = CURSOR_USER / "globalStorage" / "state.vscdb"

REPLACEMENTS = [
    (r"C:\Users\britt\Documents\GitHub\XtinadomMerch", str(NEW_PATH)),
    (r"c:\Users\britt\Documents\GitHub\XtinadomMerch", str(NEW_PATH).replace("/", "\\").lower()),
    (r"C:/Users/britt/Documents/GitHub/XtinadomMerch", str(NEW_PATH).replace("\\", "/")),
    (r"file:///c%3A/Users/britt/Documents/GitHub/XtinadomMerch", "file:///c%3A/Users/britt/Documents/GitHub/StillWet"),
    (
        r"C:\Users\britt\.cursor\projects\c-Users-britt-Documents-GitHub-XtinadomMerch",
        str(NEW_PROJECT),
    ),
    (
        r"c-Users-britt-Documents-GitHub-XtinadomMerch",
        "c-Users-britt-Documents-GitHub-StillWet",
    ),
    ("XtinadomMerch", "StillWet"),
    ("xtinadom/XtinadomMerch", "StillWet/StillWet"),
]


def replace_paths(text: str) -> str:
    out = text
    for old, new in REPLACEMENTS:
        out = out.replace(old, new)
    return out


def backup_file(path: Path, stamp: str) -> Path:
    dest = path.with_suffix(path.suffix + f".backup-{stamp}")
    shutil.copy2(path, dest)
    return dest


def merge_project_dirs(apply: bool) -> int:
    copied = 0
    if not OLD_PROJECT.is_dir():
        raise SystemExit(f"Old project dir missing: {OLD_PROJECT}")
    NEW_PROJECT.mkdir(parents=True, exist_ok=True)
    for item in OLD_PROJECT.iterdir():
        dest = NEW_PROJECT / item.name
        if item.is_dir():
            if not apply:
                copied += sum(1 for _ in item.rglob("*") if _.is_file())
                continue
            if dest.exists():
                for src_file in item.rglob("*"):
                    if src_file.is_file():
                        rel = src_file.relative_to(item)
                        target = dest / rel
                        if not target.exists():
                            target.parent.mkdir(parents=True, exist_ok=True)
                            shutil.copy2(src_file, target)
                            copied += 1
            else:
                shutil.copytree(item, dest)
                copied += sum(1 for _ in dest.rglob("*") if _.is_file())
        elif item.is_file() and (not dest.exists() or item.stat().st_size > dest.stat().st_size):
            if apply:
                shutil.copy2(item, dest)
            copied += 1
    return copied


def patch_json_paths_in_tree(root: Path) -> int:
    changed = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in {".jsonl", ".json", ".txt", ".md"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        updated = replace_paths(text)
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    return changed


def new_workspace_uri() -> dict:
    return {
        "$mid": 1,
        "fsPath": str(NEW_PATH),
        "_sep": 1,
        "external": "file:///c%3A/Users/britt/Documents/GitHub/StillWet",
        "path": "/c:/Users/britt/Documents/GitHub/StillWet",
        "scheme": "file",
    }


def migrate_global_composers(conn: sqlite3.Connection) -> tuple[int, int]:
    row = conn.execute(
        "SELECT value FROM ItemTable WHERE key=?", ("composer.composerHeaders",)
    ).fetchone()
    if not row:
        return 0, 0
    data = json.loads(row[0])
    composers = data.get("allComposers", [])
    updated = 0
    for comp in composers:
        wid = comp.get("workspaceIdentifier")
        if not isinstance(wid, dict):
            continue
        ws_id = wid.get("id")
        uri = wid.get("uri") or {}
        fs_path = (uri.get("fsPath") or "").lower()
        if ws_id != OLD_WS and OLD_PATH.name.lower() not in fs_path and "xtinadom" not in fs_path:
            continue
        wid["id"] = NEW_WS
        wid["uri"] = new_workspace_uri()
        if "trackedGitRepos" in comp:
            for repo in comp["trackedGitRepos"]:
                if isinstance(repo, dict) and "repoPath" in repo:
                    repo["repoPath"] = replace_paths(str(repo["repoPath"]))
        updated += 1
    if updated:
        conn.execute(
            "UPDATE ItemTable SET value=? WHERE key=?",
            (json.dumps(data, separators=(",", ":")), "composer.composerHeaders"),
        )
    return updated, len(composers)


def migrate_workspace_db(db_path: Path, apply: bool) -> int:
    if not apply:
        return 0
    conn = sqlite3.connect(db_path)
    changed = 0
    rows = conn.execute("SELECT key, value FROM ItemTable").fetchall()
    for key, value in rows:
        if not isinstance(value, str):
            continue
        new_value = replace_paths(value)
        if key == "workbench.backgroundComposer.workspacePersistentData":
            try:
                obj = json.loads(new_value)
                if "cachedSelectedRemote" in obj and isinstance(obj["cachedSelectedRemote"], dict):
                    obj["cachedSelectedRemote"]["url"] = replace_paths(
                        str(obj["cachedSelectedRemote"].get("url", ""))
                    )
                if "cachedSelectedGitState" in obj:
                    pass
                if "rootUri" in obj.get("cachedSelectedRemote", {}):
                    pass
                new_value = json.dumps(obj, separators=(",", ":"))
            except json.JSONDecodeError:
                pass
        if new_value != value:
            conn.execute(
                "UPDATE ItemTable SET value=? WHERE key=?", (new_value, key)
            )
            changed += 1
    conn.commit()
    conn.close()
    return changed


def copy_workspace_state(apply: bool, stamp: str) -> None:
    if not OLD_WS_DIR.is_dir():
        raise SystemExit(f"Old workspace dir missing: {OLD_WS_DIR}")
    NEW_WS_DIR.mkdir(parents=True, exist_ok=True)
    workspace_json = NEW_WS_DIR / "workspace.json"
    if workspace_json.exists():
        workspace_json_text = workspace_json.read_text(encoding="utf-8")
    else:
        workspace_json_text = json.dumps(
            {"folder": "file:///c%3A/Users/britt/Documents/GitHub/StillWet"}
        )

    for name in ("state.vscdb", "state.vscdb.backup"):
        src = OLD_WS_DIR / name
        if not src.is_file():
            continue
        dest = NEW_WS_DIR / name
        if apply:
            if dest.exists():
                backup_file(dest, stamp)
            shutil.copy2(src, dest)

    for sub in ("images", "anysphere.cursor-retrieval"):
        src = OLD_WS_DIR / sub
        if not src.is_dir():
            continue
        dest = NEW_WS_DIR / sub
        if apply:
            if dest.exists():
                shutil.copytree(src, dest, dirs_exist_ok=True)
            else:
                shutil.copytree(src, dest)

    if apply:
        workspace_json.write_text(workspace_json_text, encoding="utf-8")
        for wal in ("state.vscdb-wal", "state.vscdb-shm"):
            p = NEW_WS_DIR / wal
            if p.exists():
                try:
                    p.unlink()
                except OSError as exc:
                    print(
                        f"Warning: could not remove {p.name} ({exc}). "
                        "Quit Cursor fully and delete it, or re-run with Cursor closed."
                    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    print("Cursor history migration: XtinadomMerch -> StillWet")
    print("Mode:", "APPLY" if args.apply else "DRY RUN")

    project_files = merge_project_dirs(args.apply)
    print(f"Project dir files to merge/copy: {project_files}")

    if args.apply:
        backup_file(GLOBAL_DB, stamp)
        if (NEW_WS_DIR / "state.vscdb").exists():
            backup_file(NEW_WS_DIR / "state.vscdb", stamp)

    copy_workspace_state(args.apply, stamp)
    print("Workspace state copied from old hash folder.")

    if args.apply:
        migrate_workspace_db(NEW_WS_DIR / "state.vscdb", True)
        patched = patch_json_paths_in_tree(NEW_PROJECT)
        print(f"Patched path strings in {patched} project files.")

        conn = sqlite3.connect(GLOBAL_DB)
        updated, total = migrate_global_composers(conn)
        conn.commit()
        conn.close()
        print(f"Retagged {updated}/{total} composer headers to StillWet workspace.")
    else:
        conn = sqlite3.connect(GLOBAL_DB)
        updated, total = migrate_global_composers(conn)
        conn.close()
        print(f"Would retag {updated}/{total} composer headers.")

    print("Done. Quit and reopen Cursor, then open the StillWet folder.")


if __name__ == "__main__":
    main()
