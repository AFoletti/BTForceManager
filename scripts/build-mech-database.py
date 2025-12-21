#!/usr/bin/env python3
"""
Build Mech Database Script

Uses MekBay CSV export as primary source for mech data (names, BV, etc.),
then enriches with tonnage from MegaMek mm-data MTF files.

Usage:
    python build-mech-database.py [--limit N]
    
Options:
    --limit N   Process only N mechs (for testing)
"""

import csv
import json
import os
import re
import sys
import time
import argparse
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone

# Configuration
CSV_FILE = "data/mek_catalog.csv"
OUTPUT_FILE = "data/mech-catalog.json"
MM_DATA_REPO = "MegaMek/mm-data"
MM_DATA_BRANCH = "main"
MTF_PATH = "data/mekfiles/meks"
REQUEST_DELAY = 0.05  # seconds between mm-data file downloads


def log(msg):
    """Print timestamped log message."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def github_api_get(endpoint):
    """Make a GitHub API request."""
    url = f"https://api.github.com{endpoint}"
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "BTForceManager-MechCatalog")
    
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"token {token}")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        log(f"GitHub API error: {e.code} {e.reason}")
        return None


def normalize_name(name):
    """Normalize a mech name for matching."""
    # Remove various quote styles, underscores, and parentheses
    n = re.sub(r"['\"`_()]", "", name.lower())
    n = re.sub(r"\s+", " ", n).strip()
    return n


def load_mm_data_index():
    """Load the index of all MTF files from mm-data repository."""
    log("Loading mm-data file index...")
    data = github_api_get(f"/repos/{MM_DATA_REPO}/git/trees/{MM_DATA_BRANCH}?recursive=1")
    if not data:
        return {}, {}
    
    mtf_files = {}  # normalized name -> original name
    mtf_paths = {}  # normalized name -> full path
    
    for f in data.get("tree", []):
        path = f["path"]
        if path.startswith(MTF_PATH) and path.endswith(".mtf"):
            name = os.path.basename(path).replace(".mtf", "")
            
            # Store exact match
            mtf_files[name.lower()] = name
            mtf_paths[name.lower()] = path
            
            # Store normalized match
            normalized = normalize_name(name)
            if normalized not in mtf_files:
                mtf_files[normalized] = name
                mtf_paths[normalized] = path
    
    log(f"Indexed {len(mtf_paths)} MTF files")
    return mtf_files, mtf_paths


def find_mtf_path(full_name, mtf_files, mtf_paths):
    """Find the MTF file path for a given mech name."""
    # Try exact match
    if full_name.lower() in mtf_paths:
        return mtf_paths[full_name.lower()]
    
    # Try normalized match
    normalized = normalize_name(full_name)
    if normalized in mtf_paths:
        return mtf_paths[normalized]
    
    return None


def download_mtf_file(path):
    """Download a single MTF file content."""
    url = f"https://raw.githubusercontent.com/{MM_DATA_REPO}/{MM_DATA_BRANCH}/{urllib.parse.quote(path)}"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "BTForceManager-MechCatalog")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return None


def parse_tonnage_from_mtf(content):
    """Extract tonnage (mass) from MTF file content."""
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("#"):
            continue
        if line.lower().startswith("mass:"):
            try:
                return int(line.split(":")[1].strip())
            except (ValueError, IndexError):
                pass
    return None


def load_csv_data(csv_file, limit=0):
    """Load mech data from MekBay CSV export."""
    mechs = []
    
    with open(csv_file, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit > 0 and i >= limit:
                break
            
            chassis = row.get("chassis", "").strip()
            model = row.get("model", "").strip()
            
            if not chassis:
                continue
            
            full_name = f"{chassis} {model}".strip()
            
            # Parse BV
            try:
                bv = int(row.get("BV", 0))
            except ValueError:
                bv = 0
            
            # Parse MUL ID
            try:
                mul_id = int(row.get("mul_id", 0)) or None
            except ValueError:
                mul_id = None
            
            # Parse year
            try:
                year = int(row.get("year", 0)) or None
            except ValueError:
                year = None
            
            mech = {
                "name": full_name,
                "chassis": chassis,
                "model": model,
                "bv": bv,
                "mulId": mul_id,
                "year": year,
                "techbase": row.get("techBase", "").strip() or None,
                "role": row.get("role", "").strip() or None,
            }
            
            mechs.append(mech)
    
    return mechs


def save_catalog(catalog):
    """Save mech catalog to file."""
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
    log(f"Saved catalog to {OUTPUT_FILE}")


def main():
    parser = argparse.ArgumentParser(description="Build mech database from MekBay CSV + mm-data")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of mechs to process (0 = all)")
    args = parser.parse_args()
    
    log("Starting mech database build...")
    
    # Load CSV data
    log(f"Loading CSV from {CSV_FILE}...")
    mechs = load_csv_data(CSV_FILE, args.limit)
    log(f"Loaded {len(mechs)} mechs from CSV")
    
    # Load mm-data index
    mtf_files, mtf_paths = load_mm_data_index()
    
    # Enrich with tonnage from mm-data
    log("Enriching with tonnage from mm-data...")
    matched = 0
    unmatched = 0
    
    for i, mech in enumerate(mechs):
        if (i + 1) % 500 == 0:
            log(f"  Progress: {i + 1}/{len(mechs)}")
        
        path = find_mtf_path(mech["name"], mtf_files, mtf_paths)
        
        if path:
            content = download_mtf_file(path)
            if content:
                tonnage = parse_tonnage_from_mtf(content)
                if tonnage:
                    mech["tonnage"] = tonnage
                    matched += 1
                else:
                    unmatched += 1
            else:
                unmatched += 1
            
            time.sleep(REQUEST_DELAY)
        else:
            unmatched += 1
    
    log(f"Tonnage matched: {matched}/{len(mechs)} ({100*matched//len(mechs)}%)")
    
    # Sort by name
    mechs.sort(key=lambda m: m.get("name", ""))
    
    # Build catalog
    catalog = {
        "metadata": {
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "source": "MekBay CSV + MegaMek mm-data",
            "totalUnits": len(mechs),
            "unitsWithTonnage": sum(1 for m in mechs if m.get("tonnage")),
            "unitsWithBV": sum(1 for m in mechs if m.get("bv"))
        },
        "mechs": mechs
    }
    
    # Save
    save_catalog(catalog)
    
    log(f"Done! Total: {len(mechs)}, with tonnage: {catalog['metadata']['unitsWithTonnage']}, with BV: {catalog['metadata']['unitsWithBV']}")


if __name__ == "__main__":
    main()
