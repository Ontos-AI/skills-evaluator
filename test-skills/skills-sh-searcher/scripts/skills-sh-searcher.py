#!/usr/bin/env python3
"""
Skills.sh Searcher - Main Entry Point

Search, download, and install skills from skills.sh ecosystem
Usage:
    skills-sh-searcher search <keywords>           # Search skills
    skills-sh-searcher download <skill_id> <output_dir>   # Download skill
    skills-sh-searcher install <skill_dir>     # Install skill
"""

import sys
import subprocess
from pathlib import Path

# Add scripts directory to path
scripts_dir = Path(__file__).parent / 'scripts'
sys.path.insert(0, str(scripts_dir))

from fetch_skills_sh import fetch_skills_sh_leaderboard, search_skills, filter_by_keywords
from download_skill import download_skill_from_github, install_skill


def cmd_search(args):
    """Search for skills"""
    keywords = args.keywords
    
    if not keywords:
        print("Error: Please provide keywords to search")
        print("Example: skills-sh-searcher search pdf document")
        return 1
    
    skills = search_skills(list(keywords), limit=args.limit)
    
    print(f"\nFound {len(skills)} skills matching: {', '.join(keywords)}")
    print("=" * 80)
    
    for i, skill in enumerate(skills, 1):
        print(f"\n{i}. {skill['skill_name']}")
        print(f"   Installs: {skill['installs']}")
        print(f"   Skill ID: {skill['skill_id']}")
        print(f"   Skills.sh URL: {skill['skill_url']}")
    
    return 0


def cmd_download(args):
    """Download a skill"""
    skill_id = args.skill_id
    output_dir = args.output
    
    if not skill_id or not output_dir:
        print("Error: Please provide both skill_id and output_dir")
        print("Example: skills-sh-searcher download anthropics/skills/pdf /Users/user/.opencode/skill/")
        return 1
    
    result = download_skill_from_github(skill_id, output_dir)
    
    if result.get('success'):
        print(f"\nSuccessfully downloaded skill to: {result['skill_dir']}")
        print(f"GitHub URL: {result['github_url']}")
        
        # Ask to install
        response = input("\nDo you want to install this skill now? (y/N): ").strip().lower()
        if response in ['y', 'yes']:
            install_skill(result['skill_dir'])
        else:
            print("\nYou can install it later with: npx skills add", skill_id)
    else:
        print(f"\nFailed to download skill: {result.get('error', 'Unknown error')}")
        return 1
    
    return 0


def cmd_install(args):
    """Install a skill"""
    skill_dir = args.skill_dir
    
    if not skill_dir:
        print("Error: Please provide skill directory")
        print("Example: skills-sh-searcher install /Users/user/.opencode/skill/anthropics/skills/pdf")
        return 1
    
    print(f"Installing skill from: {skill_dir}")
    
    if install_skill(skill_dir):
        print("\nSkill installed successfully!")
    else:
        print("\nInstallation failed. You can try manually with:")
        skill_dir_path = Path(skill_dir)
        if skill_dir_path.exists():
            skill_md = skill_dir_path / 'SKILL.md'
            if skill_md.exists():
                import re
                with open(skill_md, 'r') as f:
                    content = f.read()
                url_match = re.search(r'github_url:\s*(https://github\.com/[^\s]+)', content)
                if url_match:
                    skill_id = url_match.group(1).replace('https://github.com/', '')
                    print(f"  npx skills add {skill_id}")
    
    return 0


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Search and download skills from skills.sh ecosystem',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Sub-command help')
    
    # Search command
    search_parser = subparsers.add_parser('search', help='Search for skills by keywords')
    search_parser.add_argument('keywords', nargs='+', help='Keywords to search for')
    search_parser.add_argument('--limit', type=int, default=10, help='Maximum number of results (default: 10)')
    search_parser.set_defaults(func=cmd_search)
    
    # Download command
    download_parser = subparsers.add_parser('download', help='Download a specific skill')
    download_parser.add_argument('skill_id', help='Skill ID in format owner/repo/skill_name')
    download_parser.add_argument('output_dir', help='Output directory path')
    download_parser.set_defaults(func=cmd_download)
    
    # Install command
    install_parser = subparsers.add_parser('install', help='Install a skill from local directory')
    install_parser.add_argument('skill_dir', help='Path to skill directory')
    install_parser.set_defaults(func=cmd_install)
    
    # Parse arguments
    args = parser.parse_args()
    
    # Execute command
    if hasattr(args, 'func'):
        sys.exit(args.func(args))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
