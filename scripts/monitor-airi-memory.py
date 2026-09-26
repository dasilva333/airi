#!/usr/bin/env python3
"""
AIRI macOS Deep Memory & Leak Sentinel
======================================
Automated real-time memory leak diagnosis for AIRI on macOS.
Integrates /usr/bin/footprint and /usr/bin/vmmap to track:
  - Physical Footprint (Current & Peak)
  - Dirty Memory (Actual modified physical RAM)
  - PartitionAlloc ArrayBuffers (app-specific tag 16 / Memory Tag 255)
  - Canvas2D / ImageBitmap / GPU Textures (app-specific tag 14 / Memory Tag 253)
  - V8 JavaScript VM Heap (JS VM)
  - Native C++ Malloc (MALLOC_LARGE, MALLOC_SMALL)
  - Leak Velocity (MB/sec) and Root-Cause Diagnostics

Usage:
  python3 scripts/monitor-airi-memory.py
  python3 scripts/monitor-airi-memory.py --deep
  python3 scripts/monitor-airi-memory.py --dump <pid>
  python3 scripts/monitor-airi-memory.py --log airi-memory.log
  python3 scripts/monitor-airi-memory.py --once
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from typing import Dict, List, Optional, Tuple

# Terminal ANSI colors
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_RED = "\033[31m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_BLUE = "\033[34m"
C_MAGENTA = "\033[35m"
C_CYAN = "\033[36m"
C_GRAY = "\033[90m"
C_WHITE_BG_RED = "\033[41;37;1m"


def parse_size_str(val_str: str) -> float:
    """Converts strings like '1584K', '25.4M', '1.2G', '512B', '10 GB' to Megabytes (MB)."""
    val_str = val_str.strip().upper()
    if not val_str or val_str == "0" or val_str == "0 B" or val_str == "-":
        return 0.0
    try:
        clean = re.sub(r"[^\d.]", "", val_str)
        if not clean:
            return 0.0
        val = float(clean)
        if "G" in val_str:
            return val * 1024.0
        elif "M" in val_str:
            return val
        elif "K" in val_str:
            return val / 1024.0
        elif "B" in val_str:
            return val / (1024.0 * 1024.0)
        return val / 1024.0
    except ValueError:
        return 0.0


# Category explanation dictionary for Chromium/Electron on macOS
CATEGORY_ANNOTATIONS = {
    "app-specific tag 16": "PartitionAlloc ArrayBuffers (ImageData, Uint8Array, raw pixels)",
    "Memory Tag 255": "PartitionAlloc ArrayBuffers (ImageData, Uint8Array, raw pixels)",
    "app-specific tag 14": "Blink Layout / Canvas / ImageBitmap / GPU buffers",
    "Memory Tag 253": "Blink Layout / Canvas / ImageBitmap / GPU buffers",
    "IOAccelerator": "Metal / WebGPU command buffers & textures",
    "JS VM": "V8 JavaScript Engine Heap (objects, Pinia, reactive proxies)",
    "MALLOC_LARGE": "Large native C++ allocations (>32KB buffers)",
    "MALLOC_SMALL": "Small native allocations (<32KB)",
    "untagged (VM_ALLOCATE)": "Raw mmap allocations (WASM memory / ONNX runtime)",
    "stack": "Thread stacks (Web Workers / background threads)",
}


class MemoryCategory:
    def __init__(self, name: str, dirty_mb: float, regions: int = 0):
        self.name = name
        self.dirty_mb = dirty_mb
        self.regions = regions
        self.annotation = CATEGORY_ANNOTATIONS.get(name, "")


class AiriProcess:
    def __init__(self, pid: int, ppid: int, rss_kb: int, vsz_kb: int, cpu_pct: float, cmd: str):
        self.pid = pid
        self.ppid = ppid
        self.rss_mb = round(rss_kb / 1024.0, 2)
        self.vsz_mb = round(vsz_kb / 1024.0, 2)
        self.cpu_pct = cpu_pct
        self.cmd = cmd
        self.role, self.detail = self._classify_role(cmd)
        self.dirty_mb: Optional[float] = None
        self.peak_mb: Optional[float] = None
        self.categories: List[MemoryCategory] = []
        self.history: List[Tuple[float, float]] = []  # [(timestamp, rss_mb)]

    def _classify_role(self, cmd: str) -> Tuple[str, str]:
        cmd_lower = cmd.lower()
        if "--type=renderer" in cmd_lower:
            m_client = re.search(r"--renderer-client-id=(\d+)", cmd)
            client_id = f"client-id={m_client.group(1)}" if m_client else "renderer"
            if m_client and m_client.group(1) in ("4", "5"):
                return "RENDERER", f"Primary Stage/Workers ({client_id})"
            return "RENDERER", f"Window ({client_id})"
        elif "--type=gpu-process" in cmd_lower:
            return "GPU", "Metal/WebGPU context"
        elif "--type=utility" in cmd_lower:
            if "audio" in cmd_lower:
                return "UTILITY", "Audio Service"
            elif "video_capture" in cmd_lower:
                return "UTILITY", "Video Capture Service"
            elif "network" in cmd_lower:
                return "UTILITY", "Network Service"
            return "UTILITY", "Helper Utility"
        elif "server-filesystem" in cmd_lower:
            return "MCP", "Filesystem MCP Server"
        elif "mate-engine" in cmd_lower or "stagemate" in cmd_lower:
            return "SIDECAR", "Unity Stage-Mate"
        elif "electron-vite" in cmd_lower:
            return "VITE-DEV", "Vite Dev Server (Node)"
        elif "electron" in cmd_lower or "airi" in cmd_lower:
            return "MAIN", "Electron Browser Main"
        return "HELPER", "Subprocess"


def is_airi_candidate(cmd: str) -> bool:
    cmd_lower = cmd.lower()
    if any(ex in cmd_lower for ex in ["monitor-airi-memory", "language_server", "antigravity", "vscode"]):
        return False

    if "/airi.app/contents/macos/airi" in cmd_lower or "airi helper" in cmd_lower:
        return True

    if "stage-tamagotchi" in cmd_lower and ("electron" in cmd_lower or "electron-vite" in cmd_lower):
        return True

    if "mate-engine" in cmd_lower or "stagemate" in cmd_lower:
        return True

    return False


def find_airi_processes() -> List[AiriProcess]:
    """Finds all running processes related to AIRI via macOS ps using full tree discovery."""
    try:
        res = subprocess.run(
            ["/bin/ps", "-axo", "pid,ppid,rss,vsz,%cpu,command"],
            capture_output=True,
            text=True,
            check=True
        )
    except Exception as e:
        print(f"Error executing ps: {e}", file=sys.stderr)
        return []

    lines = res.stdout.strip().split("\n")
    if len(lines) <= 1:
        return []

    all_raw: Dict[int, Tuple[int, int, int, float, str]] = {}
    children_map: Dict[int, List[int]] = {}

    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split(None, 5)
        if len(parts) < 6:
            continue

        try:
            pid = int(parts[0])
            ppid = int(parts[1])
            rss_kb = int(parts[2])
            vsz_kb = int(parts[3])
            cpu_pct = float(parts[4])
            cmd = parts[5]
            all_raw[pid] = (ppid, rss_kb, vsz_kb, cpu_pct, cmd)
            children_map.setdefault(ppid, []).append(pid)
        except ValueError:
            continue

    roots = [pid for pid, (_, _, _, _, cmd) in all_raw.items() if is_airi_candidate(cmd)]
    tree_pids = []
    queue = list(roots)
    while queue:
        curr = queue.pop(0)
        tree_pids.append(curr)
        for child in children_map.get(curr, []):
            if child not in tree_pids and child not in queue:
                queue.append(child)

    airi_procs: List[AiriProcess] = []
    for pid in tree_pids:
        ppid, rss_kb, vsz_kb, cpu_pct, cmd = all_raw[pid]
        cmd_lower = cmd.lower()
        if "monitor-airi-memory" in cmd_lower or "/bin/ps" in cmd_lower:
            continue
        airi_procs.append(AiriProcess(pid, ppid, rss_kb, vsz_kb, cpu_pct, cmd))

    role_order = {"MAIN": 0, "RENDERER": 1, "GPU": 2, "UTILITY": 3, "MCP": 4, "SIDECAR": 5, "VITE-DEV": 6, "HELPER": 7}
    airi_procs.sort(key=lambda p: (role_order.get(p.role, 99), -p.rss_mb))
    return airi_procs


def inspect_deep_footprint(pid: int) -> Tuple[Optional[float], Optional[float], List[MemoryCategory]]:
    """Runs macOS /usr/bin/footprint -p <pid> to extract dirty memory, peak, and categorized breakdown."""
    try:
        res = subprocess.run(
            ["/usr/bin/footprint", "-p", str(pid)],
            capture_output=True,
            text=True,
            timeout=8
        )
        if res.returncode != 0:
            return inspect_deep_vmmap(pid)
    except Exception:
        return inspect_deep_vmmap(pid)

    output = res.stdout
    footprint_mb = None
    peak_mb = None
    categories: List[MemoryCategory] = []

    m_foot = re.search(r"Footprint:\s+([\d.]+\s*[BKMGT]B?)", output, re.IGNORECASE)
    if m_foot:
        footprint_mb = parse_size_str(m_foot.group(1))

    m_peak = re.search(r"phys_footprint_peak:\s+([\d.]+\s*[BKMGT]B?)", output, re.IGNORECASE)
    if m_peak:
        peak_mb = parse_size_str(m_peak.group(1))

    for line in output.split("\n"):
        m = re.match(r"^\s*([\d.]+\s*[BKMGT]B?)\s+([\d.]+\s*[BKMGT]B?)\s+([\d.]+\s*[BKMGT]B?)\s+(\d+)\s+(.+)$", line)
        if m:
            dirty_str, _, _, regions_str, cat = m.groups()
            cat = cat.strip()
            if cat not in ("Category", "TOTAL") and not cat.startswith("---"):
                dirty_mb = parse_size_str(dirty_str)
                if dirty_mb >= 1.0:  # Only capture categories with at least 1MB dirty
                    categories.append(MemoryCategory(cat, round(dirty_mb, 1), int(regions_str)))

    categories.sort(key=lambda c: -c.dirty_mb)
    return footprint_mb, peak_mb, categories


def inspect_deep_vmmap(pid: int) -> Tuple[Optional[float], Optional[float], List[MemoryCategory]]:
    """Fallback: runs macOS /usr/bin/vmmap -summary <pid>."""
    try:
        res = subprocess.run(
            ["/usr/bin/vmmap", "-summary", str(pid)],
            capture_output=True,
            text=True,
            timeout=6
        )
        if res.returncode != 0:
            return None, None, []
    except Exception:
        return None, None, []

    output = res.stdout
    footprint_mb = None
    peak_mb = None
    categories: List[MemoryCategory] = []

    m_foot = re.search(r"Physical footprint:\s+([\d.]+[BKMGT]?)", output, re.IGNORECASE)
    if m_foot:
        footprint_mb = parse_size_str(m_foot.group(1))

    m_peak = re.search(r"Physical footprint \(peak\):\s+([\d.]+[BKMGT]?)", output, re.IGNORECASE)
    if m_peak:
        peak_mb = parse_size_str(m_peak.group(1))

    in_table = False
    for line in output.split("\n"):
        if "REGION TYPE" in line and "DIRTY" in line:
            in_table = True
            continue
        if in_table:
            if line.startswith("==="):
                continue
            if not line.strip() or line.startswith("ReadOnly") or line.startswith("Writable"):
                break
            parts = line.split()
            if len(parts) >= 4:
                region_parts = []
                idx = 0
                while idx < len(parts) and not re.match(r"^[\d.]+[BKMGT]?$", parts[idx]):
                    region_parts.append(parts[idx])
                    idx += 1
                region_name = " ".join(region_parts)
                if idx + 2 < len(parts):
                    dirty_val = parse_size_str(parts[idx + 2])
                    if dirty_val >= 1.0:
                        categories.append(MemoryCategory(region_name, round(dirty_val, 1), 0))

    categories.sort(key=lambda c: -c.dirty_mb)
    return footprint_mb, peak_mb, categories


def diagnose_leak(p: AiriProcess, delta_mb: float, elapsed_sec: float) -> Optional[str]:
    """Generates an automated leak diagnosis based on process role and category growth."""
    rate = delta_mb / max(1.0, elapsed_sec)
    if delta_mb < 30.0 and rate < 1.0:
        return None

    diagnostics = [
        f"{C_WHITE_BG_RED} 🚨 CRITICAL MEMORY LEAK DETECTED {C_RESET}",
        f"  Process: {C_BOLD}{p.role} (PID {p.pid}){C_RESET} — {p.detail}",
        f"  Growth:  {C_RED}+{delta_mb:.1f} MB in {elapsed_sec:.0f}s ({rate:.1f} MB/s){C_RESET}",
    ]

    top_cat = p.categories[0] if p.categories else None
    if top_cat:
        diagnostics.append(f"  Primary Category: {C_YELLOW}{top_cat.name}{C_RESET} ({top_cat.dirty_mb:.1f} MB across {top_cat.regions} regions)")
        if top_cat.annotation:
            diagnostics.append(f"  Description:      {C_CYAN}{top_cat.annotation}{C_RESET}")

    # Root Cause Recommendations
    diagnostics.append(f"  {C_BOLD}Diagnosis & Recommended Action:{C_RESET}")
    if top_cat and ("tag 16" in top_cat.name or "Tag 255" in top_cat.name):
        diagnostics.append(f"    • {C_BOLD}PartitionAlloc ArrayBuffer Leak:{C_RESET} Repeated 3K/4K screen capture buffers or raw image data")
        diagnostics.append(f"      are not being garbage collected. Ensure capture frames are downscaled before decoding,")
        diagnostics.append(f"      and avoid storing uncompressed Uint8Array frames in persistent store arrays.")
    elif top_cat and ("tag 14" in top_cat.name or "Tag 253" in top_cat.name):
        diagnostics.append(f"    • {C_BOLD}Canvas / ImageBitmap Leak:{C_RESET} Temporary HTML5/OffscreenCanvas objects or ImageBitmaps")
        diagnostics.append(f"      are retaining GPU backing stores. Explicitly call canvas.width = 0; canvas.height = 0;")
        diagnostics.append(f"      and imageBitmap.close() after each inference/OCR tick.")
    elif top_cat and "JS VM" in top_cat.name:
        diagnostics.append(f"    • {C_BOLD}V8 JavaScript Heap Leak:{C_RESET} Reactive arrays (e.g. observationBuffer, chronoLogBuffer,")
        diagnostics.append(f"      event listeners) are growing unbounded in Pinia stores.")
    else:
        diagnostics.append(f"    • Continuous background allocations without explicit buffer deallocation.")

    return "\n".join(diagnostics)


def format_table(procs: List[AiriProcess], baseline: Dict[int, float], start_time: float, deep_mode: bool) -> str:
    lines = []
    lines.append(f"{C_BOLD}{'PID':<8} {'ROLE':<12} {'CPU%':<7} {'RSS (MB)':<11} {'DIRTY (MB)':<12} {'DELTA (Δ)':<12} {'SUBSYSTEM / WINDOW'}{C_RESET}")
    lines.append("─" * 96)

    total_rss = 0.0
    total_dirty = 0.0
    total_delta = 0.0
    elapsed_sec = time.time() - start_time
    leak_warnings = []

    for p in procs:
        total_rss += p.rss_mb
        base = baseline.get(p.pid, p.rss_mb)
        delta = p.rss_mb - base
        total_delta += delta

        if delta > 30.0:
            delta_str = f"{C_RED}▲ +{delta:.1f} MB{C_RESET}"
        elif delta > 5.0:
            delta_str = f"{C_YELLOW}▲ +{delta:.1f} MB{C_RESET}"
        elif delta < -5.0:
            delta_str = f"{C_GREEN}▼ {delta:.1f} MB{C_RESET}"
        else:
            delta_str = f"{C_GRAY}─ 0.0 MB{C_RESET}"

        dirty_display = f"{p.dirty_mb:.1f} MB" if p.dirty_mb is not None else "—"
        if p.dirty_mb is not None:
            total_dirty += p.dirty_mb

        role_color = C_CYAN if p.role == "MAIN" else (C_MAGENTA if p.role == "RENDERER" else (C_BLUE if p.role == "GPU" else C_RESET))

        lines.append(f"{p.pid:<8} {role_color}{p.role:<12}{C_RESET} {p.cpu_pct:<7.1f} {p.rss_mb:<11.1f} {dirty_display:<12} {delta_str:<21} {C_GRAY}{p.detail}{C_RESET}")

        if deep_mode and p.categories:
            top_cats = p.categories[:4]
            for cat in top_cats:
                reg_str = f" ({cat.regions} regions)" if cat.regions > 0 else ""
                annot_str = f" [{cat.annotation}]" if cat.annotation else ""
                lines.append(f"  {C_GRAY}↳ {cat.name}: {C_BOLD}{cat.dirty_mb:.1f} MB{C_RESET}{C_GRAY}{reg_str}{annot_str}{C_RESET}")

        # Check for leak warning
        leak_diag = diagnose_leak(p, delta, elapsed_sec)
        if leak_diag:
            leak_warnings.append(leak_diag)

    lines.append("─" * 96)
    total_delta_str = f"+{total_delta:.1f} MB" if total_delta >= 0 else f"{total_delta:.1f} MB"
    color_total_delta = C_RED if total_delta > 50.0 else (C_YELLOW if total_delta > 10.0 else C_GREEN)
    dirty_sum_str = f"{total_dirty:.1f} MB" if total_dirty > 0 else "—"
    lines.append(f"{C_BOLD}TOTALS: {len(procs)} processes | RSS: {total_rss:.1f} MB | Dirty Footprint: {dirty_sum_str} | Growth: {color_total_delta}{total_delta_str}{C_RESET}")

    if leak_warnings:
        lines.append("\n" + "\n\n".join(leak_warnings))

    return "\n".join(lines)


def dump_single_process(pid: int):
    """Deep forensic dump of a single target PID."""
    print(f"\n{C_BOLD}🔍 Forensic Deep Memory Dump for PID {pid}{C_RESET}\n")
    footprint, peak, categories = inspect_deep_footprint(pid)
    print(f"Physical Footprint:      {C_CYAN}{footprint:.1f} MB{C_RESET}" if footprint else "Physical Footprint: Unknown")
    print(f"Physical Footprint Peak: {C_MAGENTA}{peak:.1f} MB{C_RESET}" if peak else "Physical Footprint Peak: Unknown")
    print("\n" + f"{C_BOLD}{'DIRTY (MB)':<12} {'REGIONS':<10} {'CATEGORY':<28} {'INTERPRETATION'}{C_RESET}")
    print("─" * 85)
    for c in categories:
        print(f"{c.dirty_mb:<12.1f} {c.regions:<10} {c.name:<28} {C_GRAY}{c.annotation}{C_RESET}")


def run_monitor(interval: float, deep: bool, once: bool, as_json: bool, log_file: Optional[str] = None, dump_pid: Optional[int] = None):
    if dump_pid:
        dump_single_process(dump_pid)
        return

    baseline_rss: Dict[int, float] = {}
    tick = 0
    start_time = time.time()

    if not as_json:
        print(f"\n{C_BOLD}🔍 AIRI macOS Deep Memory & Leak Sentinel{C_RESET}")
        print(f"{C_GRAY}Engine: /usr/bin/footprint & /usr/bin/vmmap | Auto-refresh: {interval}s{C_RESET}\n")

    first_find = True

    try:
        while True:
            procs = find_airi_processes()

            if not procs:
                if once:
                    if not as_json:
                        print(f"{C_YELLOW}⚪ AIRI is not currently running.{C_RESET}")
                        print(f"{C_GRAY}Launch AIRI with 'pnpm -F @proj-airi/stage-tamagotchi dev' or open AIRI.app,{C_RESET}")
                        print(f"{C_GRAY}then run without '--once' to start continuous monitoring.{C_RESET}\n")
                    else:
                        print(json.dumps({"running": False, "process_count": 0, "processes": []}, indent=2))
                    return
                if not as_json:
                    sys.stdout.write(f"\r{C_YELLOW}⏳ Waiting for AIRI to launch... (monitoring will start automatically){C_RESET}  ")
                    sys.stdout.flush()
                time.sleep(1.0)
                continue

            if first_find and not as_json:
                sys.stdout.write("\r" + " " * 80 + "\r")
                print(f"{C_GREEN}🟢 Detected {len(procs)} AIRI process(es)! Locking on...{C_RESET}\n")
                first_find = False

            for p in procs:
                if p.pid not in baseline_rss:
                    baseline_rss[p.pid] = p.rss_mb

            # Deep inspect top memory consumers (or any process > 150MB)
            if deep:
                heaviest = sorted(procs, key=lambda p: -p.rss_mb)[:4]
                for p in heaviest:
                    foot, peak, cats = inspect_deep_footprint(p.pid)
                    p.dirty_mb = foot
                    p.peak_mb = peak
                    p.categories = cats

            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

            if as_json:
                data = {
                    "timestamp": timestamp,
                    "tick": tick,
                    "process_count": len(procs),
                    "total_rss_mb": round(sum(p.rss_mb for p in procs), 2),
                    "processes": [
                        {
                            "pid": p.pid,
                            "ppid": p.ppid,
                            "role": p.role,
                            "subsystem": p.detail,
                            "cpu_pct": p.cpu_pct,
                            "rss_mb": p.rss_mb,
                            "dirty_mb": p.dirty_mb,
                            "peak_mb": p.peak_mb,
                            "delta_mb": round(p.rss_mb - baseline_rss.get(p.pid, p.rss_mb), 2),
                            "categories": [{"name": c.name, "dirty_mb": c.dirty_mb, "regions": c.regions, "annotation": c.annotation} for c in p.categories],
                            "cmd": p.cmd
                        }
                        for p in procs
                    ]
                }
                print(json.dumps(data, indent=2))
            else:
                table_output = format_table(procs, baseline_rss, start_time, deep)
                print(f"\n[{C_CYAN}{timestamp}{C_RESET}] Tick #{tick + 1} (Monitoring for {time.time() - start_time:.0f}s):")
                print(table_output)

            if log_file:
                with open(log_file, "a") as f:
                    clean_text = re.sub(r"\033\[[0-9;]*m", "", table_output) if not as_json else json.dumps(data)
                    f.write(f"\n--- {timestamp} (Tick #{tick + 1}) ---\n" + clean_text + "\n")

            if once:
                break

            tick += 1
            time.sleep(interval)

    except KeyboardInterrupt:
        if not as_json:
            print(f"\n{C_YELLOW}🛑 Monitoring stopped by user.{C_RESET}")


def main():
    parser = argparse.ArgumentParser(description="AIRI macOS Deep Memory & Leak Sentinel")
    parser.add_argument("-i", "--interval", type=float, default=3.0, help="Sampling interval in seconds (default: 3.0)")
    parser.add_argument("-d", "--deep", action="store_true", help="Perform deep footprint/vmmap category breakdown (tag 16, tag 14, JS VM, IOAccelerator)")
    parser.add_argument("--once", action="store_true", help="Take a single snapshot and exit")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("-o", "--log", type=str, help="Append output to a log file")
    parser.add_argument("--dump", type=int, help="Perform an immediate deep forensic dump for a specific PID")

    args = parser.parse_args()
    run_monitor(interval=args.interval, deep=args.deep, once=args.once, as_json=args.json, log_file=args.log, dump_pid=args.dump)


if __name__ == "__main__":
    main()
