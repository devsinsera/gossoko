#!/usr/bin/env python3
"""FTPS upload for Gossoko — dist/ -> sinsera.co/gossoko/.

Run `npm run build` first (or `npm run deploy`, which tests + builds + uploads).

Same rules as every other Sinsera deployer:
  - TLS 1.2, NOT 1.3: Hostgator's Pure-FTPd data channel cuts uploads over
    32 KB short under TLS 1.3 while the client thinks it worked.
  - every file is size-checked as it lands, with retry + reconnect;
  - HTML last, so a page is never uploaded over chunks that did not land.
Nothing on the server is deleted (old hashed chunks are harmless).

The remote folder is derived from `base` in vite.config.ts, so the upload
target and the asset base cannot drift apart. It is NOT read from the
environment: a sourced sibling .env.local once sent a deploy to the wrong folder.
Credentials: SINSERA_FTP_HOST / USER / PASS from .env.local or a sibling
LoopRoom/.env.local. The password is never printed.
"""
import ftplib
import os
import re
import ssl
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def load_env() -> dict:
    env = {}
    for f in (ROOT / ".env.local", ROOT.parent / "LoopRoom" / ".env.local"):
        if f.exists():
            for line in f.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    env.update({k: v for k, v in os.environ.items() if k.startswith("SINSERA_FTP_")})
    return env


m = re.search(r"base:\s*'([^']+)'", (ROOT / "vite.config.ts").read_text())
if not m:
    sys.exit("cannot read base from vite.config.ts")
REMOTE = m.group(1).rstrip("/")
if REMOTE in ("", "/"):
    sys.exit("Refusing to deploy to the domain ROOT — that is the Sinsera Core shell.")

E = load_env()
try:
    HOST, USER, PW = E["SINSERA_FTP_HOST"], E["SINSERA_FTP_USER"], E["SINSERA_FTP_PASS"]
except KeyError as e:
    sys.exit(f"missing credential {e} — set SINSERA_FTP_* in .env.local")

index = DIST / "index.html"
if not index.exists():
    sys.exit("dist/index.html missing — run `npm run build` first")
if f"{REMOTE}/assets/" not in index.read_text():
    sys.exit(f"dist/ was not built for {REMOTE} — check base in vite.config.ts")


def tls12():
    ctx = ssl._create_stdlib_context()
    ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    return ctx


ftp = None
made: set = set()


def connect() -> None:
    global ftp
    ftp = ftplib.FTP_TLS(HOST, timeout=60, context=tls12())
    ftp.login(USER, PW)
    ftp.prot_p()


def ensure(d: str) -> None:
    if d in made or d in ("", "/"):
        return
    ensure(d.rsplit("/", 1)[0])
    try:
        ftp.mkd(d)
    except Exception:
        pass  # already there
    made.add(d)


def put(local: Path, remote: str, tries: int = 5) -> None:
    for i in range(tries):
        try:
            ensure(remote.rsplit("/", 1)[0])
            with open(local, "rb") as fh:
                ftp.storbinary(f"STOR {remote}", fh)
            got, want = ftp.size(remote), local.stat().st_size
            if got != want:
                raise IOError(f"landed {got} of {want} bytes")
            return
        except Exception as e:
            print(f"  retry {i + 1} {remote}: {e}")
            time.sleep(2 * (i + 1))
            made.clear()
            try:
                connect()
            except Exception:
                pass
    sys.exit(f"FAILED after {tries} tries: {remote}")


connect()
files = sorted((p for p in DIST.rglob("*") if p.is_file()), key=lambda p: (p.suffix == ".html", str(p)))
for p in files:
    rel = p.relative_to(DIST).as_posix()
    put(p, f"{REMOTE}/{rel}")
    print(f"  up {rel}")
print(f"OK — {len(files)} files verified at {HOST}:{REMOTE}/  →  https://sinsera.co{REMOTE}/")
