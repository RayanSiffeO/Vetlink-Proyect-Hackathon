from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import venv
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_DIR = ROOT / "services" / "api"
WEB_DIR = ROOT / "apps" / "web"
DIST_INDEX = WEB_DIR / "dist" / "index.html"
REQUIREMENTS = API_DIR / "requirements.txt"


def venv_python(venv_dir: Path) -> Path:
    return venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run(command: list[str], cwd: Path | None = None) -> None:
    printable = " ".join(str(part) for part in command)
    print(f"  $ {printable}")
    subprocess.run(command, cwd=str(cwd) if cwd else None, check=True)


def command_path(name: str) -> str | None:
    return shutil.which(name)


def run_package_tool(tool: str, args: list[str], cwd: Path) -> None:
    path = command_path(tool)
    if path is None:
        raise RuntimeError(f"No encuentro '{tool}'. Instala Node.js 20+ o usa Docker.")
    if os.name == "nt" and path.lower().endswith((".cmd", ".bat")):
        run([os.environ.get("COMSPEC", "cmd.exe"), "/c", path, *args], cwd)
        return
    run([path, *args], cwd)


def select_venv() -> Path:
    existing = API_DIR / ".venv"
    if venv_python(existing).exists():
        return existing
    return ROOT / ".venv"


def ensure_python_environment(venv_dir: Path) -> Path:
    python = venv_python(venv_dir)
    if not python.exists():
        print("1/3 Creando entorno Python…")
        venv.EnvBuilder(with_pip=True).create(venv_dir)
    marker = venv_dir / ".vetlink-deps"
    if marker.exists():
        return python
    print("2/3 Instalando dependencias Python…")
    run([str(python), "-m", "pip", "install", "--upgrade", "pip"])
    run([str(python), "-m", "pip", "install", "-r", str(REQUIREMENTS)])
    marker.write_text("ready\n", encoding="utf-8")
    return python


def build_web(build: bool) -> None:
    if DIST_INDEX.is_file() and not build:
        return
    print("3/3 Compilando la interfaz web…")
    if not (WEB_DIR / "node_modules").is_dir():
        runner = "pnpm" if command_path("pnpm") else "npm"
        run_package_tool(runner, ["install"], WEB_DIR)
    runner = "pnpm" if command_path("pnpm") else "npm"
    run_package_tool(runner, ["run", "build"], WEB_DIR)
    if not DIST_INDEX.is_file():
        raise RuntimeError("El build web no generó apps/web/dist/index.html")


def free_port(port: int) -> int:
    for candidate in range(port, port + 30):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if probe.connect_ex(("127.0.0.1", candidate)) != 0:
                return candidate
    raise RuntimeError(f"No hay ningún puerto libre entre {port} y {port + 29}")


def open_browser_later(url: str) -> None:
    timer = threading.Timer(1.5, lambda: webbrowser.open(url))
    timer.daemon = True
    timer.start()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Arranca VetLink en un solo proceso")
    parser.add_argument("--port", type=int, default=8000, help="Puerto preferido (por defecto 8000)")
    parser.add_argument("--host", default="127.0.0.1", help="Host de escucha (por defecto 127.0.0.1)")
    parser.add_argument("--build", action="store_true", help="Fuerza recompilar la interfaz")
    parser.add_argument("--no-browser", action="store_true", help="No abre el navegador")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if sys.version_info < (3, 11):
        print("VetLink necesita Python 3.11 o superior.")
        return 1
    try:
        venv_dir = select_venv()
        python = ensure_python_environment(venv_dir)
        build_web(args.build)
        port = free_port(args.port)
        display_host = "127.0.0.1" if args.host in {"0.0.0.0", "::"} else args.host
        url = f"http://{display_host}:{port}"
        print(f"\nVetLink listo en {url}")
        print("Pulsa Ctrl+C para parar.\n")
        if not args.no_browser:
            open_browser_later(url)
        run(
            [
                str(python),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                args.host,
                "--port",
                str(port),
            ],
            API_DIR,
        )
    except KeyboardInterrupt:
        print("\nVetLink detenido.")
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"\nNo se pudo arrancar VetLink: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
