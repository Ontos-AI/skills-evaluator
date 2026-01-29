#!/usr/bin/env python3
"""
Download skill from GitHub and convert to opencode format

Fetches skill from GitHub and creates a proper SKILL.md
"""

import logging
import requests
import json
from pathlib import Path
import subprocess
import sys
from typing import Dict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def download_skill_from_github(skill_id: str, output_dir: str) -> Dict:
    """
    Download skill from GitHub to .opencode/skill/

    Args:
        skill_id: GitHub owner/repo/skill_name
        output_dir: Output directory

    Returns:
        Downloaded skill info
    """
    logger.info(f"Downloading skill from GitHub: {skill_id}")

    try:
        # Convert skill_id to GitHub URL
        github_url = f"https://github.com/{skill_id.replace('/', '/')}"
        
        # Try to get repo info using GitHub API
        api_url = f"https://api.github.com/repos/{skill_id}"
        response = requests.get(api_url, timeout=30)
        
        if response.status_code == 200:
            repo_info = response.json()
            description = repo_info.get('description', '')
            
            # Create skill directory
            skill_name = skill_id.split('/')[-1]
            skill_dir = Path(output_dir) / skill_name
            skill_dir.mkdir(parents=True, exist_ok=True)
            
            # Create SKILL.md
            skill_md_path = skill_dir / 'SKILL.md'
            
            # Generate SKILL.md content
            skill_md_content = f"""---
name: {skill_name}
description: {description[:200]}
github_url: {github_url}
github_hash: {repo_info.get('updated_at', 'unknown')}
version: 1.0.0
created_at: {repo_info.get('created_at', 'unknown')}
source: skills.sh
installs: {repo_info.get('stargazers_count', 0)}
---

# {skill_name}

This skill was downloaded from skills.sh and is part of the Open Agent Skills Ecosystem.

## Overview

{description[:500]}

## Installation

Install this skill using:
```bash
npx skills add {skill_id}
```

## Source

- **Skills.sh**: https://skills.sh/{skill_id}
- **GitHub**: {github_url}

## Usage

[TODO: Add specific usage instructions here]

## Notes

This skill was automatically downloaded and converted by the Skills Learning Agent.
"""
            
            with open(skill_md_path, 'w', encoding='utf-8') as f:
                f.write(skill_md_content)
            
            logger.info(f"Successfully downloaded skill to: {skill_dir}")
            
            return {
                'success': True,
                'skill_name': skill_name,
                'skill_dir': str(skill_dir),
                'github_url': github_url
            }
        
        else:
            logger.error(f"GitHub API returned status {response.status_code}")
            return {
                'success': False,
                'error': f"GitHub API error: {response.status_code}"
            }

    except Exception as e:
        logger.error(f"Error downloading skill: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def install_skill(skill_dir: str) -> bool:
    """
    Install skill using npx skills add command

    Args:
        skill_dir: Path to skill directory

    Returns:
        True if successful
    """
    try:
        skill_dir_path = Path(skill_dir)
        
        if not skill_dir_path.exists():
            logger.error(f"Skill directory not found: {skill_dir}")
            return False
        
        # Read SKILL.md to get skill_id
        skill_md = skill_dir_path / 'SKILL.md'
        if not skill_md.exists():
            logger.error(f"SKILL.md not found: {skill_md}")
            return False
        
        with open(skill_md, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract github_url to find skill_id
        import re
        url_match = re.search(r'github_url:\s*(https://github\.com/[^\s]+)', content)
        if not url_match:
            logger.error("Could not find github_url in SKILL.md")
            return False
        
        github_url = url_match.group(1)
        skill_id = github_url.replace('https://github.com/', '')
        
        # Install using npx skills add
        logger.info(f"Installing skill: {skill_id}")
        
        result = subprocess.run(
            ['npx', 'skills', 'add', skill_id],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            logger.info(f"Successfully installed skill: {skill_id}")
            return True
        else:
            logger.error(f"Failed to install skill. Return code: {result.returncode}")
            logger.error(f"Stdout: {result.stdout}")
            logger.error(f"Stderr: {result.stderr}")
            return False

    except Exception as e:
        logger.error(f"Error installing skill: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 download_skill.py <skill_id> <output_dir>")
        print("Example: python3 download_skill.py anthropics/skills/pdf /Users/user/.opencode/skill/")
        sys.exit(1)
    
    skill_id = sys.argv[1]
    output_dir = sys.argv[2]
    
    result = download_skill_from_github(skill_id, output_dir)
    
    if result.get('success'):
        # Optionally install
        skill_dir = result.get('skill_dir', '')
        if install_skill(skill_dir):
            print("\nSkill installed successfully!")
        else:
            print("\nSkill downloaded but installation failed. You can manually install with:")
            print(f"  npx skills add {skill_id}")
