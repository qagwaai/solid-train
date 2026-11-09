"""Package and verify versioned universe artifacts using Python 3.11+ stdlib."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import tempfile
import zipfile


MANIFEST = "delivery-manifest.json"
DEFAULT_DIRECTORIES = (
    "artifacts/non-sol-bulk-v1-delivery",
    "artifacts/non-sol-market-density-v2",
)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def safe_name(name):
    path = PurePosixPath(name)
    if (not name or "\\" in name or ":" in name or path.is_absolute()
            or any(part in ("", ".", "..") for part in name.split("/"))):
        raise ValueError(f"Unsafe archive path: {name}")
    return path


def verify(archive, root=None):
    archive = Path(archive).resolve()
    with zipfile.ZipFile(archive) as source, tempfile.TemporaryDirectory(
            prefix="universe-verify-") as directory:
        names = source.namelist()
        if len(names) != len({name.casefold() for name in names}):
            raise ValueError("Duplicate or case-colliding archive entries")
        for name in names:
            safe_name(name)
        manifest = json.loads(source.read(MANIFEST))
        if not isinstance(manifest, dict) or set(names) != set(manifest) | {MANIFEST}:
            raise ValueError("Archive entries do not match manifest")
        extracted = Path(directory)
        source.extractall(extracted)
        for name, expected in manifest.items():
            path = extracted.joinpath(*safe_name(name).parts)
            if (path.stat().st_size != expected["bytes"]
                    or digest(path) != expected["sha256"]):
                raise ValueError(f"Extracted hash/size mismatch: {name}")
            if root is not None:
                original = Path(root).resolve().joinpath(*safe_name(name).parts)
                if (original.stat().st_size != expected["bytes"]
                        or digest(original) != expected["sha256"]):
                    raise ValueError(f"Original hash/size mismatch: {name}")
    return {
        "archive": str(archive),
        "sha256": digest(archive),
        "archiveBytes": archive.stat().st_size,
        "payloadFilesVerified": len(manifest),
        "archiveEntries": len(names),
        "uncompressedPayloadBytes": sum(item["bytes"] for item in manifest.values()),
    }


def pack(root, directories, output):
    root = Path(root).resolve()
    output = Path(output).resolve()
    files = {}
    for directory in directories:
        safe_name(directory)
        folder = root.joinpath(*PurePosixPath(directory).parts)
        if not folder.is_dir() or not folder.resolve().is_relative_to(root):
            raise ValueError(f"Missing or outside-root input directory: {directory}")
        for path in folder.rglob("*"):
            if path.is_symlink() or not path.resolve().is_relative_to(root):
                raise ValueError(f"Symlink or outside-root input: {path}")
            if path.is_file():
                if path.resolve() == output:
                    raise ValueError("Archive output cannot be inside an input directory")
                files[path.relative_to(root).as_posix()] = path
    if not files:
        raise ValueError("No payload files found")
    if len(files) != len({name.casefold() for name in files}):
        raise ValueError("Case-colliding input paths")
    if any(output.is_relative_to(root.joinpath(*PurePosixPath(d).parts))
           for d in directories):
        raise ValueError("Archive output cannot be inside an input directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    stream = output.open("xb")
    verified = False
    try:
        with stream:
            manifest = {}
            with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED,
                                 compresslevel=9, allowZip64=True) as archive:
                for name, path in sorted(files.items()):
                    content = path.read_bytes()
                    manifest[name] = {
                        "bytes": len(content),
                        "sha256": hashlib.sha256(content).hexdigest(),
                    }
                    archive.writestr(name, content)
                archive.writestr(MANIFEST, json.dumps(manifest, indent=2) + "\n")
        result = verify(output, root)
        verified = True
        return result
    finally:
        if not verified:
            output.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("pack", help="Create ZIP; verify extracted and original hashes")
    create.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    create.add_argument("--directory", action="append", help="Root-relative input; repeat for each directory")
    create.add_argument("--output", type=Path, required=True)
    check = commands.add_parser("verify", help="Extract to temporary storage and verify all hashes")
    check.add_argument("--archive", type=Path, required=True)
    check.add_argument("--root", type=Path, help="Also compare original files beneath this root")
    args = parser.parse_args()
    try:
        if args.command == "pack":
            result = pack(args.root, args.directory or DEFAULT_DIRECTORIES, args.output)
        else:
            result = verify(args.archive, args.root)
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile) as error:
        parser.exit(1, f"Universe archive failed: {error}\n")
    result["withinGitHub100MiBLimit"] = result["archiveBytes"] < 100 * 1024 * 1024
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
