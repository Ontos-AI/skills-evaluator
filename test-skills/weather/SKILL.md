---
name: weather
description: Top source: clawdbot/clawdbot
---
---
name: weather
description: A skill that can retrieve current weather conditions and forecasts for a specified location.
tags:
  - weather
  - forecast
  - climate
  - meteorology
---

# Weather Skill

This skill provides current weather conditions and forecasts for any given location worldwide. It leverages external weather APIs to fetch up-to-date meteorological data.

## Core Functionality

1.  **Current Weather**: Get real-time weather information including temperature, humidity, wind speed, atmospheric pressure, and general conditions (e.g., sunny, cloudy, rain).
2.  **Hourly Forecast**: Retrieve weather predictions for the next few hours.
3.  **Daily Forecast**: Obtain a multi-day weather forecast, typically for 3, 5, or 7 days.
4.  **Location Support**: Supports various location inputs, including city names, postal codes, and geographical coordinates.
5.  **Unit Conversion**: Allows users to specify preferred units for temperature (Celsius/Fahrenheit) and wind speed (m/s, km/h, mph).

## Usage

**Trigger Phrases**:

*   "What's the weather like in [Location]?"
*   "Weather forecast for [Location] for tomorrow."
*   "Will it rain in [Location] this weekend?"
*   "Current temperature in [Location]."

### Parameters

*   `location` (Required): The city, postal code, or coordinates for which to fetch weather information (e.g., "London, UK", "90210", "40.7128,-74.0060").
*   `type` (Optional): Specifies the type of weather information requested. Can be `current`, `hourly`, or `daily`. Defaults to `current`.
*   `days` (Optional): For `daily` forecasts, the number of days to forecast (e.g., `3`, `5`, `7`). Defaults to `3`.
*   `units` (Optional): Preferred units for temperature. Can be `celsius` or `fahrenheit`. Defaults to `celsius`.

### Example API Call (Internal)

```python
# Assuming an internal function `get_weather_data`
weather_data = get_weather_data(
    location="Manchester, GB",
    type="daily",
    days=30, # For monthly forecast, assuming API supports up to 30 days
    units="celsius"
)
```

### Output

The skill will return a structured response containing the requested weather information. For forecasts, it will typically include date, high/low temperatures, conditions, and precipitation probability for each period.

```json
{
  "location": "Manchester, GB",
  "type": "daily",
  "forecast": [
    {
      "date": "2023-10-26",
      "min_temp": "8°C",
      "max_temp": "14°C",
      "conditions": "Partly cloudy",
      "precipitation_probability": "20%"
    },
    // ... more days
  ]
}
```
