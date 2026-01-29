#!/bin/bash
# =============================================================================
# Ontos Skill Evaluator - Test Script
# =============================================================================
# Tests the evaluator against all skills in the test-skills directory.
# Generates both individual reports and a summary table.
#
# Usage:
#   ./test_evaluator.sh                    # Run tests with Node.js
#   ./test_evaluator.sh --python           # Run tests with Python
#   ./test_evaluator.sh --html             # Generate HTML reports
#   ./test_evaluator.sh --summary          # Only show summary table
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_SKILLS_DIR="${SCRIPT_DIR}/test-skills"
EVALUATOR_JS="${SCRIPT_DIR}/skills/ontos-skill-evaluator/scripts/quick_eval.js"
EVALUATOR_PY="${SCRIPT_DIR}/skills/ontos-skill-evaluator/scripts/quick_eval.py"
REPORT_DIR="${SCRIPT_DIR}/test-reports"

# Parse arguments
USE_PYTHON=false
GENERATE_HTML=false
SUMMARY_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --python|-p)
            USE_PYTHON=true
            shift
            ;;
        --html|-h)
            GENERATE_HTML=true
            shift
            ;;
        --summary|-s)
            SUMMARY_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create report directory
mkdir -p "$REPORT_DIR"

# Header
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        🔍 Ontos Skill Evaluator - Test Suite                   ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if $USE_PYTHON; then
    echo -e "${CYAN}Engine: Python${NC}"
    EVALUATOR="python3 $EVALUATOR_PY"
else
    echo -e "${CYAN}Engine: Node.js${NC}"
    EVALUATOR="node $EVALUATOR_JS"
fi

echo -e "${CYAN}Test Skills Dir: $TEST_SKILLS_DIR${NC}"
echo -e "${CYAN}Report Dir: $REPORT_DIR${NC}"
echo ""

# Count skills
SKILL_COUNT=$(find "$TEST_SKILLS_DIR" -maxdepth 1 -type d ! -name ".*" ! -name "test-skills" | wc -l | tr -d ' ')
echo -e "${BOLD}Found $SKILL_COUNT skills to evaluate${NC}"
echo ""

# Initialize counters
GOLD_COUNT=0
SILVER_COUNT=0
BRONZE_COUNT=0
FAIL_COUNT=0
PASS_COUNT=0
TOTAL_COUNT=0

# Results array for summary
declare -a RESULTS

# Process each skill
for skill_dir in "$TEST_SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    
    # Skip hidden directories
    [[ "$skill_name" == .* ]] && continue
    
    # Skip if no SKILL.md
    if [[ ! -f "$skill_dir/SKILL.md" ]]; then
        echo -e "${YELLOW}⚠️  Skipping $skill_name (no SKILL.md)${NC}"
        continue
    fi
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    if ! $SUMMARY_ONLY; then
        echo -e "${BLUE}▶ Evaluating: $skill_name${NC}"
    fi
    
    # Run evaluation
    OUTPUT=$($EVALUATOR "$skill_dir" 2>&1) || true
    
    # Extract key values using grep and sed
    BADGE=$(echo "$OUTPUT" | grep -o '"badge": "[^"]*"' | head -1 | sed 's/"badge": "\([^"]*\)"/\1/')
    IS_PASSED=$(echo "$OUTPUT" | grep -o '"is_passed": [^,]*' | head -1 | sed 's/"is_passed": //')
    OVERALL=$(echo "$OUTPUT" | grep -o '"overall": [^,]*' | head -1 | sed 's/"overall": //')
    
    # Default values if parsing fails
    BADGE=${BADGE:-fail}
    IS_PASSED=${IS_PASSED:-false}
    OVERALL=${OVERALL:-0.0}
    
    # Update counters
    case $BADGE in
        gold)
            GOLD_COUNT=$((GOLD_COUNT + 1))
            BADGE_DISPLAY="${GREEN}🥇 GOLD${NC}"
            ;;
        silver)
            SILVER_COUNT=$((SILVER_COUNT + 1))
            BADGE_DISPLAY="${CYAN}🥈 SILVER${NC}"
            ;;
        bronze)
            BRONZE_COUNT=$((BRONZE_COUNT + 1))
            BADGE_DISPLAY="${YELLOW}🥉 BRONZE${NC}"
            ;;
        *)
            FAIL_COUNT=$((FAIL_COUNT + 1))
            BADGE_DISPLAY="${RED}❌ FAIL${NC}"
            ;;
    esac
    
    if [[ "$IS_PASSED" == "true" ]]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        PASS_DISPLAY="${GREEN}✓${NC}"
    else
        PASS_DISPLAY="${RED}✗${NC}"
    fi
    
    # Store result
    RESULTS+=("$skill_name|$OVERALL|$BADGE|$IS_PASSED")
    
    if ! $SUMMARY_ONLY; then
        echo -e "   Score: ${BOLD}$OVERALL${NC} | Badge: $BADGE_DISPLAY | Pass: $PASS_DISPLAY"
    fi
    
    # Save individual report
    echo "$OUTPUT" > "$REPORT_DIR/${skill_name}.json"
    
    # Generate HTML if requested
    if $GENERATE_HTML; then
        if $USE_PYTHON; then
            python3 "$EVALUATOR_PY" "$skill_dir" --format html -o "$REPORT_DIR/${skill_name}.html" 2>/dev/null || true
        else
            node "$EVALUATOR_JS" "$skill_dir" --format html -o "$REPORT_DIR/${skill_name}.html" 2>/dev/null || true
        fi
    fi
done

echo ""

# Print summary table
echo -e "${BOLD}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                              📊 SUMMARY TABLE                              ║${NC}"
echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════════════╣${NC}"
printf "${BOLD}║ %-40s │ %6s │ %-8s │ %4s ║${NC}\n" "Skill Name" "Score" "Badge" "Pass"
echo -e "${BOLD}╠════════════════════════════════════════════════════════════════════════════╣${NC}"

for result in "${RESULTS[@]}"; do
    IFS='|' read -r name score badge passed <<< "$result"
    
    # Truncate name if too long
    if [[ ${#name} -gt 40 ]]; then
        name="${name:0:37}..."
    fi
    
    # Color badge
    case $badge in
        gold)   badge_colored="${GREEN}🥇 GOLD  ${NC}" ;;
        silver) badge_colored="${CYAN}🥈 SILVER${NC}" ;;
        bronze) badge_colored="${YELLOW}🥉 BRONZE${NC}" ;;
        *)      badge_colored="${RED}❌ FAIL  ${NC}" ;;
    esac
    
    # Color pass
    if [[ "$passed" == "true" ]]; then
        pass_colored="${GREEN}✓${NC}"
    else
        pass_colored="${RED}✗${NC}"
    fi
    
    printf "║ %-40s │ %6s │ %b │  %b  ║\n" "$name" "$score" "$badge_colored" "$pass_colored"
done

echo -e "${BOLD}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Statistics
echo -e "${BOLD}📈 Statistics${NC}"
echo "─────────────────────────────────────"
echo -e "  Total Skills:  ${BOLD}$TOTAL_COUNT${NC}"
echo -e "  ${GREEN}🥇 Gold:${NC}        $GOLD_COUNT"
echo -e "  ${CYAN}🥈 Silver:${NC}      $SILVER_COUNT"
echo -e "  ${YELLOW}🥉 Bronze:${NC}      $BRONZE_COUNT"
echo -e "  ${RED}❌ Fail:${NC}        $FAIL_COUNT"
echo ""
echo -e "  ${GREEN}✓ Passed:${NC}       $PASS_COUNT / $TOTAL_COUNT ($(( PASS_COUNT * 100 / TOTAL_COUNT ))%)"
echo ""

# Generate combined summary JSON
SUMMARY_JSON="$REPORT_DIR/summary.json"
cat > "$SUMMARY_JSON" << EOF
{
  "evaluated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "engine": "$(if $USE_PYTHON; then echo "python"; else echo "nodejs"; fi)",
  "total_skills": $TOTAL_COUNT,
  "passed": $PASS_COUNT,
  "failed": $((TOTAL_COUNT - PASS_COUNT)),
  "pass_rate": $(echo "scale=2; $PASS_COUNT * 100 / $TOTAL_COUNT" | bc),
  "by_badge": {
    "gold": $GOLD_COUNT,
    "silver": $SILVER_COUNT,
    "bronze": $BRONZE_COUNT,
    "fail": $FAIL_COUNT
  },
  "skills": [
$(for i in "${!RESULTS[@]}"; do
    IFS='|' read -r name score badge passed <<< "${RESULTS[$i]}"
    comma=""
    if [[ $i -lt $((${#RESULTS[@]} - 1)) ]]; then comma=","; fi
    echo "    {\"name\": \"$name\", \"score\": $score, \"badge\": \"$badge\", \"is_passed\": $passed}$comma"
done)
  ]
}
EOF

echo -e "${GREEN}✓ Summary saved to: $SUMMARY_JSON${NC}"

if $GENERATE_HTML; then
    echo -e "${GREEN}✓ HTML reports saved to: $REPORT_DIR/*.html${NC}"
fi

echo ""
echo -e "${BOLD}Done!${NC}"
