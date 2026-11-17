"""Check that the real executable opens a native window; no screenshots."""
import os
import subprocess
import sys
import time
from pathlib import Path

binary = Path(sys.argv[1]).resolve()
process = subprocess.Popen([str(binary)])
try:
    deadline = time.monotonic() + 45
    found = False
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Application exited early: {process.returncode}")
        if os.name == "nt":
            import ctypes
            from ctypes import wintypes
            handles = []
            callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
            def visit(hwnd, _):
                pid = wintypes.DWORD()
                ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                if pid.value == process.pid and ctypes.windll.user32.IsWindowVisible(hwnd):
                    handles.append(hwnd)
                return True
            ctypes.windll.user32.EnumWindows(callback_type(visit), 0)
            found = bool(handles)
        else:
            result = subprocess.run(["xdotool", "search", "--onlyvisible", "--pid", str(process.pid)], capture_output=True)
            found = result.returncode == 0 and bool(result.stdout.strip())
        if found:
            time.sleep(5)
            if process.poll() is not None:
                raise RuntimeError("Application closed after opening its window")
            print("Native window opened and application remained running.")
            break
        time.sleep(1)
    if not found:
        raise RuntimeError("No visible native window within 45 seconds")
finally:
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
