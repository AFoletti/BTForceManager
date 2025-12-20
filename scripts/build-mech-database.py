#!/usr/bin/env python3
"""
Build Mech Database Script

Fetches mech data from helm-core-fragment MTF files and enriches with BV from MUL API.
Supports incremental updates by tracking the last processed commit SHA.

Usage:
    python build-mech-database.py [--limit N] [--full]
    
Options:
    --limit N   Process only N mechs (for testing)
    --full      Force full rebuild, ignore existing data
"""

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
HELM_REPO = "IsaBison/helm-core-fragment"
HELM_BRANCH = "master"
MTF_PATH = "mtf/meks"
OUTPUT_FILE = "data/mech-catalog.json"
MUL_API_BASE = "http://masterunitlist.info/Unit/QuickList"
REQUEST_DELAY = 1.0  # seconds between MUL API requests


def log(msg):
    """Print timestamped log message."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def github_api_get(endpoint):
    """Make a GitHub API request."""
    url = f"https://api.github.com{endpoint}"
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "BTForceManager-MechCatalog")
    
    # Use token if available (for higher rate limits)
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"token {token}")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        log(f"GitHub API error: {e.code} {e.reason}")
        return None


def get_current_commit_sha():
    """Get the current HEAD commit SHA of helm-core-fragment."""
    data = github_api_get(f"/repos/{HELM_REPO}/commits/{HELM_BRANCH}")
    if data:
        return data["sha"]
    return None


def get_changed_files(base_sha, head_sha):
    """Get list of changed .mtf files between two commits."""
    data = github_api_get(f"/repos/{HELM_REPO}/compare/{base_sha}...{head_sha}")
    if not data:
        return None
    
    changed_mtf = []
    for file in data.get("files", []):
        filename = file.get("filename", "")
        status = file.get("status", "")
        if filename.startswith(MTF_PATH) and filename.endswith(".mtf"):
            if status in ("added", "modified"):
                changed_mtf.append(filename)
    
    return changed_mtf


def get_all_mtf_files():
    """Get list of all .mtf files in the repository."""
    # Use Git tree API to get all files at once
    data = github_api_get(f"/repos/{HELM_REPO}/git/trees/{HELM_BRANCH}?recursive=1")
    if not data:
        return []
    
    mtf_files = []
    for item in data.get("tree", []):
        path = item.get("path", "")
        if path.startswith(MTF_PATH) and path.endswith(".mtf"):
            mtf_files.append(path)
    
    return mtf_files


def download_mtf_file(path):
    """Download a single MTF file content."""
    url = f"https://raw.githubusercontent.com/{HELM_REPO}/{HELM_BRANCH}/{urllib.parse.quote(path)}"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "BTForceManager-MechCatalog")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        log(f"Failed to download {path}: {e.code}")
        return None


def parse_mtf_content(content):
    """Parse MTF file content and extract relevant fields.
    
    Handles two MTF formats:
    - New format: chassis:Name, model:Variant, mul id:1234
    - Old format: Version:1.1, then chassis on line 2, model on line 3
    """
    data = {}
    lines = content.split("\n")
    
    # First pass: look for key:value pairs (new format)
    for line in lines:
        line = line.strip()
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip().lower()
            value = value.strip()
            
            if key == "chassis":
                data["chassis"] = value
            elif key == "model":
                data["model"] = value
            elif key == "mul id":
                try:
                    data["mulId"] = int(value)
                except ValueError:
                    pass
            elif key == "mass":
                try:
                    data["tonnage"] = int(value)
                except ValueError:
                    pass
            elif key == "techbase":
                data["techbase"] = value
            elif key == "era":
                try:
                    data["era"] = int(value)
                except ValueError:
                    pass
    
    # Second pass: handle old format (Version on line 1, chassis on line 2, model on line 3)
    if "chassis" not in data and len(lines) >= 3:
        line1 = lines[0].strip() if len(lines) > 0 else ""
        line2 = lines[1].strip() if len(lines) > 1 else ""
        line3 = lines[2].strip() if len(lines) > 2 else ""
        
        # Check if line 1 is "Version:X.X" (old format indicator)
        if line1.lower().startswith("version:") or (line2 and ":" not in line2):
            # Old format: line 2 is chassis, line 3 is model
            if line1.lower().startswith("version:"):
                chassis_line = line2
                model_line = line3
            else:
                # No version line, chassis is line 1
                chassis_line = lines[0].strip() if lines else ""
                model_line = lines[1].strip() if len(lines) > 1 else ""
            
            if chassis_line and ":" not in chassis_line:
                data["chassis"] = chassis_line
            if model_line and ":" not in model_line:
                data["model"] = model_line
        
        # Also scan for Mass in old format (Mass:90 or mass:90)
        if "tonnage" not in data:
            for line in lines:
                line = line.strip()
                if line.lower().startswith("mass:"):
                    try:
                        data["tonnage"] = int(line.split(":")[1].strip())
                    except (ValueError, IndexError):
                        pass
                    break
    
    # Build full name
    if "chassis" in data and "model" in data:
        data["name"] = f"{data['chassis']} {data['model']}"
    elif "chassis" in data:
        data["name"] = data["chassis"]
    
    return data


def query_mul_for_bv(mul_id):
    """Query MUL API to get BV for a specific unit ID."""
    # MUL doesn't have a direct ID lookup, so we'll scrape from details page
    url = f"http://masterunitlist.info/Unit/Details/{mul_id}"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "BTForceManager-MechCatalog")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode("utf-8", errors="replace")
            
            # Parse BV from the HTML - look for pattern like <dt>Battle Value</dt>\s*<dd>610</dd>
            match = re.search(r'<dt>Battle Value</dt>\s*<dd>(\d+)</dd>', html)
            if match:
                return int(match.group(1))
            
            # Alternative: look for BattleValue in any format
            match = re.search(r'Battle\s*Value[^>]*>\s*(\d+)', html, re.IGNORECASE)
            if match:
                return int(match.group(1))
                
    except urllib.error.HTTPError as e:
        log(f"MUL API error for ID {mul_id}: {e.code}")
    except Exception as e:
        log(f"Error querying MUL for ID {mul_id}: {e}")
    
    return None


def load_existing_catalog():
    """Load existing mech catalog if it exists."""
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            log(f"Warning: Could not load existing catalog: {e}")
    return None


def save_catalog(catalog):
    """Save mech catalog to file."""
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
    log(f"Saved catalog to {OUTPUT_FILE}")


def main():
    parser = argparse.ArgumentParser(description="Build mech database from helm-core-fragment")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of mechs to process (0 = all)")
    parser.add_argument("--full", action="store_true", help="Force full rebuild")
    args = parser.parse_args()
    
    log("Starting mech database build...")
    
    # Load existing catalog
    existing = None if args.full else load_existing_catalog()
    existing_mechs = {}
    last_commit = None
    
    if existing:
        last_commit = existing.get("metadata", {}).get("sourceCommit")
        for mech in existing.get("mechs", []):
            if "mulId" in mech:
                existing_mechs[mech["mulId"]] = mech
        log(f"Loaded existing catalog with {len(existing_mechs)} mechs, last commit: {last_commit[:8] if last_commit else 'N/A'}")
    
    # Get current commit
    current_commit = get_current_commit_sha()
    if not current_commit:
        log("ERROR: Could not get current commit SHA")
        sys.exit(1)
    log(f"Current helm-core-fragment commit: {current_commit[:8]}")
    
    # Determine which files to process
    if last_commit and last_commit != current_commit and not args.full:
        log(f"Checking for changes since {last_commit[:8]}...")
        mtf_files = get_changed_files(last_commit, current_commit)
        if mtf_files is None:
            log("Could not get diff, falling back to full scan")
            mtf_files = get_all_mtf_files()
        elif len(mtf_files) == 0:
            log("No MTF files changed since last run")
            mtf_files = []
        else:
            log(f"Found {len(mtf_files)} changed MTF files")
    else:
        log("Performing full scan of all MTF files...")
        mtf_files = get_all_mtf_files()
        log(f"Found {len(mtf_files)} total MTF files")
    
    # Apply limit if specified
    if args.limit > 0 and len(mtf_files) > args.limit:
        log(f"Limiting to {args.limit} files (--limit)")
        mtf_files = mtf_files[:args.limit]
    
    # Process MTF files
    new_mechs = []
    mechs_needing_bv = []
    
    for i, path in enumerate(mtf_files):
        log(f"Processing [{i+1}/{len(mtf_files)}]: {os.path.basename(path)}")
        
        content = download_mtf_file(path)
        if not content:
            continue
        
        mech_data = parse_mtf_content(content)
        if not mech_data.get("name"):
            log(f"  Skipping - no chassis/model found")
            continue
        
        mech_data["sourceFile"] = os.path.basename(path)
        
        # Check if we already have BV for this mech
        mul_id = mech_data.get("mulId")
        if mul_id and mul_id in existing_mechs:
            existing_bv = existing_mechs[mul_id].get("bv")
            if existing_bv:
                mech_data["bv"] = existing_bv
                log(f"  {mech_data['name']} - using cached BV: {existing_bv}")
            else:
                mechs_needing_bv.append(mech_data)
        elif mul_id:
            mechs_needing_bv.append(mech_data)
        else:
            log(f"  {mech_data['name']} - no MUL ID found")
        
        new_mechs.append(mech_data)
        
        # Small delay to be nice to GitHub
        time.sleep(0.1)
    
    # Query MUL API for BV on mechs that need it
    if mechs_needing_bv:
        log(f"Querying MUL API for {len(mechs_needing_bv)} mechs...")
        for i, mech in enumerate(mechs_needing_bv):
            mul_id = mech.get("mulId")
            log(f"  [{i+1}/{len(mechs_needing_bv)}] {mech['name']} (MUL ID: {mul_id})...")
            
            bv = query_mul_for_bv(mul_id)
            if bv:
                mech["bv"] = bv
                log(f"    BV: {bv}")
            else:
                log(f"    BV: not found")
            
            # Rate limiting delay
            time.sleep(REQUEST_DELAY)
    
    # Merge with existing data
    final_mechs = dict(existing_mechs)  # Start with existing
    for mech in new_mechs:
        mul_id = mech.get("mulId")
        if mul_id:
            final_mechs[mul_id] = mech
    
    # Convert back to list and sort by name
    mechs_list = sorted(final_mechs.values(), key=lambda m: m.get("name", ""))
    
    # Build final catalog
    catalog = {
        "metadata": {
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "sourceCommit": current_commit,
            "sourceRepo": HELM_REPO,
            "totalUnits": len(mechs_list),
            "unitsWithBV": sum(1 for m in mechs_list if m.get("bv"))
        },
        "mechs": mechs_list
    }
    
    # Save
    save_catalog(catalog)
    
    log(f"Done! Total mechs: {len(mechs_list)}, with BV: {catalog['metadata']['unitsWithBV']}")


if __name__ == "__main__":
    main()
