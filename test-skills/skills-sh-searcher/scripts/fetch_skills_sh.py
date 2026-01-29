#!/usr/bin/env python3
"""
Fetch skills from skills.sh leaderboard

Parse skills.sh homepage and extract skill information
"""

import logging
import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import re
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fetch_skills_sh_leaderboard(limit: int = 50) -> List[Dict]:
    """
    Fetch skills from skills.sh leaderboard

    Args:
        limit: Number of skills to fetch

    Returns:
        List of skills with metadata
    """
    logger.info(f"Fetching top {limit} skills from skills.sh...")

    skills = []

    try:
        # Fetch skills.sh homepage
        url = "https://skills.sh"
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Skills.sh shows skills in a table/list format
        # Try to find skill links and information
        # Look for links in format /owner/repo/skill_name

        skill_links = []

        # Find all links that match skill pattern
        for a in soup.find_all('a', href=True):
            href = a.get('href', '')
            
            # Match pattern: /owner/repo/skill_name
            if href and href.startswith('/') and href.count('/') >= 3:
                parts = href.strip('/').split('/')
                if len(parts) >= 3:
                    skill_id = '/'.join(parts[:3])  # owner/repo/skill_name
                    
                    # Get skill name and install count from the link content
                    # Skills.sh shows installs and name in the link
                    text = a.get_text(strip=True)
                    
                    # Try to extract install count from text
                    install_match = re.search(r'(\d+(?:\.\d+)?[Kk]?)', text)
                    installs = 0
                    if install_match:
                        install_str = install_match.group(1).replace(',', '').replace('.', '')
                        installs = int(install_str)
                        # Handle K (thousands)
                        if 'K' in install_match.group(0):
                            installs *= 1000
                        elif 'k' in install_match.group(0):
                            installs *= 1000
                    
                    # Extract skill name
                    skill_name = skill_id.split('/')[-1]
                    
                    skill_links.append({
                        'skill_id': skill_id,
                        'skill_name': skill_name,
                        'installs': installs,
                        'skill_url': f"https://skills.sh{href}",
                        'full_url': f"https://skills.sh{href}",
                        'text_snippet': text
                    })

        # Remove duplicates and sort by installs
        seen = {}
        unique_skills = []
        for skill in skill_links:
            if skill['skill_id'] not in seen:
                seen[skill['skill_id']] = True
                unique_skills.append(skill)
        
        # Sort by installs
        unique_skills.sort(key=lambda x: x.get('installs', 0), reverse=True)
        
        skills = unique_skills[:limit]
        logger.info(f"Fetched {len(skills)} unique skills")

    except Exception as e:
        logger.error(f"Failed to fetch skills from skills.sh: {e}")
    
    return skills


def get_skill_details(skill_id: str) -> Dict:
    """
    Fetch detailed information about a specific skill

    Args:
        skill_id: Skill ID in format owner/repo/skill_name

    Returns:
        Skill details dictionary
    """
    logger.info(f"Fetching details for {skill_id}...")

    try:
        url = f"https://skills.sh/{skill_id}"
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract skill name
        title_elem = soup.find('h1') or soup.find('h2')
        skill_name = title_elem.get_text(strip=True) if title_elem else skill_id.split('/')[-1]

        # Extract description
        desc_elem = soup.find('p') or soup.find('div', class_=re.compile(r'description|summary', re.I))
        description = desc_elem.get_text(strip=True) if desc_elem else ''

        # Extract tags
        tags = []
        tag_elems = soup.find_all(['span', 'a'], class_=re.compile(r'tag|badge|category', re.I))
        for tag_elem in tag_elems:
            tag_text = tag_elem.get_text(strip=True)
            if tag_text and len(tag_text) < 30:
                tags.append(tag_text)

        # Get GitHub link if available
        github_url = f"https://github.com/{skill_id.replace('/', '/')}"
        skill_url = f"https://skills.sh/{skill_id}"

        # Get install count
        installs = 0
        full_text = soup.get_text()
        install_match = re.search(r'(\d+(?:\.\d+)?[Kk]?)', full_text)
        if install_match:
            install_str = install_match.group(1).replace(',', '').replace('.', '')
            installs = int(install_str) if install_str.isdigit() else 0
            if 'K' in install_match.group(0):
                installs *= 1000
            elif 'k' in install_match.group(0):
                installs *= 1000

        return {
            'skill_id': skill_id,
            'skill_name': skill_name,
            'description': description,
            'tags': tags,
            'installs': installs,
            'github_url': github_url,
            'skill_url': skill_url
        }

    except Exception as e:
        logger.error(f"Failed to fetch details for {skill_id}: {e}")
        return None


def filter_by_keywords(skills: List[Dict], keywords: List[str]) -> List[Dict]:
    """
    Filter skills by keywords

    Args:
        skills: List of skills
        keywords: List of keywords

    Returns:
        Filtered list of skills
    """
    if not keywords:
        return skills

    keywords_lower = [kw.lower() for kw in keywords]
    
    filtered_skills = []
    
    for skill in skills:
        # Search in skill name
        skill_name_lower = skill['skill_name'].lower()
        name_matches = sum(1 for kw in keywords_lower if kw in skill_name_lower)
        
        # Search in description snippet
        desc_lower = skill.get('text_snippet', '').lower()
        desc_matches = sum(1 for kw in keywords_lower if kw in desc_lower)
        
        # Search in tags
        tags_lower = [tag.lower() for tag in skill.get('tags', [])]
        tag_matches = sum(1 for kw in keywords_lower if kw in ' '.join(tags_lower))
        
        total_score = name_matches * 3 + desc_matches * 2 + tag_matches
        
        if total_score > 0:
            filtered_skills.append({
                **skill,
                'relevance_score': total_score
            })
    
    # Sort by relevance
    filtered_skills.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
    
    logger.info(f"Filtered to {len(filtered_skills)} skills matching keywords")
    
    return filtered_skills


def search_skills(keywords: List[str], limit: int = 10) -> List[Dict]:
    """
    Search for skills matching keywords

    Args:
        keywords: Search keywords
        limit: Maximum number of results

    Returns:
        List of matching skills
    """
    logger.info(f"Searching skills.sh for: {keywords}")
    
    # Fetch skills from leaderboard
    all_skills = fetch_skills_sh_leaderboard(limit=100)
    
    # Filter by keywords
    matching_skills = filter_by_keywords(all_skills, keywords)
    
    return matching_skills[:limit]


if __name__ == "__main__":
    # Test fetching skills
    print("\n" + "=" * 80)
    print("Fetching skills from skills.sh leaderboard")
    print("=" * 80)
    
    skills = fetch_skills_sh_leaderboard(limit=20)
    
    print(f"\nFound {len(skills)} skills:")
    for i, skill in enumerate(skills[:10], 1):
        print(f"\n{i}. {skill['skill_name']}")
        print(f"   Installs: {skill['installs']}")
        print(f"   Skill ID: {skill['skill_id']}")
        print(f"   URL: {skill['skill_url']}")
    
    # Test searching
    print("\n" + "=" * 80)
    print("Testing keyword search")
    print("=" * 80)
    
    matching = search_skills(['pdf', 'document'], limit=5)
    
    print(f"\nFound {len(matching)} matching skills:")
    for skill in matching:
        print(f"  - {skill['skill_name']} (relevance: {skill.get('relevance_score', 0)})")
