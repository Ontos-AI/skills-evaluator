---
name: driver-license-eligibility
description: Provides driver license eligibility requirements based on user's country/state and age. It can specify minimum age, required documents, and any specific conditions.
---
---
name: driver-license-eligibility
description: Provides driver license eligibility requirements based on user's country/state and age. It can specify minimum age, required documents, and any specific conditions.
tags:
  - driver license
  - eligibility
  - requirements
  - legal
  - driving
---

# Driver License Eligibility Requirements Skill

This skill helps users understand the eligibility criteria for obtaining a driver's license in various regions. It can provide information on minimum age, necessary documentation, and any special conditions or restrictions.

## Core Functionality

1.  **Region-Specific Information**: Retrieves eligibility requirements for a specified country and, if applicable, state/province.
2.  **Age Requirements**: Clearly states the minimum age for different types of licenses (e.g., learner's permit, full license).
3.  **Document Checklist**: Lists required documents such as proof of identity, residency, social security number, etc.
4.  **Special Conditions**: Informs about any specific conditions like vision tests, written exams, driving tests, parental consent for minors, or graduated licensing programs.
5.  **Source Citation**: Aims to cite the official government source (e.g., DMV, Ministry of Transport website) for the information.

## Usage

**Trigger**: "What are the driver license requirements in [Country/State]?" or "Am I eligible for a driver's license in [Country/State] at [Age]?"

### Parameters

*   `country`: (Required) The country for which to find eligibility requirements (e.g., "USA", "Canada", "Germany").
*   `state_province`: (Optional) The specific state or province within a country (e.g., "California", "Ontario").
*   `age`: (Optional) The user's age, to check against age-specific requirements.

###
