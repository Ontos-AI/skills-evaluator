---
name: skills-sh-searcher
description: Search and download skills from skills.sh ecosystem. Use when user needs to find and install skills from the skills.sh marketplace for specific tasks like PDF processing, document editing, web scraping, etc.
---

# Skills.sh Searcher

This skill searches and downloads skills from the [skills.sh](https://skills.sh) marketplace, which is the largest directory of AI agent skills.

## Core Functionality

1. **Search Skills**: Search skills by keywords from skills.sh leaderboard
2. **Download Skills**: Download skill packages to `.opencode/skill/` directory
3. **Convert to Standard Format**: Convert skills.sh data to standard skill_card format
4. **Auto-Install**: Make skills immediately available for opencode

## Usage

**Trigger**: `/skills-sh-searcher <keywords>` or "Search skills.sh for PDF skills"

### Search Examples

```bash
# Search for PDF-related skills
keywords: ['pdf', 'document', 'file']

# Search for web scraping skills
keywords: ['scraping', 'web', 'html', 'bs4']

# Search for data processing skills
keywords: ['data', 'csv', 'json', 'excel']
```

### Download Examples

```bash
# Download specific skill
skills-sh-searcher --download anthropics/skills/pdf

# Download multiple skills
skills-sh-searcher --download anthropics/skills/docx
skills-sh-searcher --download anthropics/skills/xlsx
```

## Skills Available on skills.sh

Based on the skills.sh leaderboard, available skills include:

### Document Processing Skills
- `anthropics/skills/pdf` (923 installs) - PDF processing
- `anthropics/skills/docx` (735 installs) - Word document processing
- `anthropics/skills/xlsx` (773 installs) - Excel spreadsheet processing
- `anthropics/skills/pptx` (772 installs) - PowerPoint presentation processing

### Web Development Skills
- `anthropics/skills/frontend-design` (3.9K installs) - Frontend design
- `anthropics/skills/webapp-testing` (662 installs) - Web app testing
- `anthropics/skills/mcp-builder` (618 installs) - MCP server builder

### Data Processing Skills
- `anthropics/skills/webapp-testing` - Web scraping
- Various data transformation skills

### Testing Skills
- `anthropics/skills/webapp-testing` - Testing frameworks
- `anthropics/skills/test-driven-development` - TDD patterns

### Development Tools
- `anthropics/skills/skill-creator` (2.5K installs) - Skill creation guide
- Various IDE and coding patterns

## Implementation Workflow

1. **Fetch Skills from skills.sh**
   - Access skills.sh homepage
   - Parse skill information (name, installs, URL, tags)
   - Filter by keywords if provided

2. **Download Skills to .opencode/skill/**
   - Get skill details from GitHub
   - Create standardized SKILL.md
   - Copy to `.opencode/skill/` directory

3. **Quality Filtering**
   - Filter by install count (minimum threshold)
   - Filter by relevance to keywords
   - Return top matches

## Resources

- `scripts/fetch_skills_sh.py` - Fetch and parse skills.sh leaderboard
- `scripts/download_skill.py` - Download skill from GitHub to .opencode/skill/
- `references/skills_catalog.json` - Cache of available skills

## Best Practices

- Always check install count to find popular, reliable skills
- Use specific keywords for better matches
- Download skills with high install counts first
- Verify downloaded skills before using

## Notes

- skills.sh uses the format `owner/repo/skill_name` for skill identification
- Skills are installed using `npx skills add <owner/repo>` command
- This skill automates that process by:
  1. Finding the right skill
  2. Downloading it from GitHub
  3. Converting to standard SKILL.md format
  4. Placing in `.opencode/skill/` directory
