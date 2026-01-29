---
name: faq-finder
description: Searches for and retrieves information from FAQ (Frequently Asked Questions) pages based on keywords.
---
---
name: faq-finder
description: Searches for and retrieves information from FAQ (Frequently Asked Questions) pages based on keywords.
tags:
  - faq
  - search
  - information retrieval
  - customer support
---

# FAQ Finder Skill

This skill is designed to help users quickly locate answers to common questions by searching through FAQ pages. It can be used to find specific information related to a topic, such as "ticket delivery" or "refund policy."

## Core Functionality

1.  **Keyword-based Search**: Takes keywords or phrases as input to search for relevant FAQ entries.
2.  **Contextual Understanding**: Attempts to understand the user's intent to refine the search and provide the most accurate FAQ section or answer.
3.  **Direct Answer Extraction**: If possible, extracts and presents the direct answer to the question from the FAQ content.
4.  **Link Provision**: Provides a direct link to the relevant FAQ page or section for the user to review the full context.

## Usage

**Trigger**: "Find the FAQ about [topic]" or "Where is the FAQ page for [topic]?"

### Parameters

*   `topic`: (Required) The subject or keywords for which the user wants to find FAQ information (e.g., "ticket delivery", "account setup", "payment methods").
*   `source_url`: (Optional) A specific URL to an FAQ page or website to search within. If not provided, the skill might use a general search or a pre-configured list of common FAQ sources.

### Example Interaction

**User**: "Find the FAQ page about ticket delivery."

**Agent (using faq-finder)**:
1.  Identifies `topic` as "ticket delivery."
2.  Searches known FAQ sources or performs a web search for "ticket delivery FAQ."
3.  Locates a relevant FAQ page.
4.  **Output**: "I found an FAQ section on ticket delivery. You can find information regarding e-tickets, mail delivery, and collection options here: [Link to FAQ page/section]."
