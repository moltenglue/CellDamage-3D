#!/bin/bash

# Code Audit Script using GLM-5
# Usage: ./scripts/audit.sh

set -e

echo "=========================================="
echo "CellDamage 3D - Code Audit with GLM-5"
echo "=========================================="
echo ""

# Check if opencode is installed
if ! command -v opencode &> /dev/null; then
    echo "Installing OpenCode..."
    curl -fsSL https://opencode.ai/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"
fi

# Run the audit
echo "Running GLM-5 audit..."
echo "This may take a few minutes..."
echo ""

opencode run -m opencode-go/glm-5 "
Please perform a comprehensive code audit of this TypeScript vehicular combat game.

Audit Scope:
1. SECURITY
   - Check for XSS vulnerabilities in user input handling
   - Verify no unsafe eval() or new Function() usage
   - Check for prototype pollution risks
   - Verify secure random ID generation
   - Check for timing attack vulnerabilities

2. PERFORMANCE
   - Memory leaks in game loop (check setInterval/setTimeout cleanup)
   - Unnecessary object allocations in hot paths
   - Efficient physics updates
   - Proper disposal of Three.js resources
   - Cannon.js body cleanup

3. CODE QUALITY
   - Unused imports and dead code
   - Type safety issues
   - Error handling coverage
   - Function complexity
   - Code duplication

4. BEST PRACTICES
   - Three.js memory management
   - Cannon.js physics best practices
   - WebSocket security (if applicable)
   - TypeScript strict mode compliance

Focus Files:
- src/client/game/Game.ts (main game loop)
- src/client/vehicle/Vehicle.ts (vehicle physics & crumple zones)
- src/client/physics/Physics.ts (physics world)
- src/client/renderer/Renderer.ts (Three.js rendering)
- src/server/index.ts (server)
- src/ai/AIController.ts (AI behavior)

Output Format:
For each issue found, provide:
- Severity (Critical/High/Medium/Low)
- File and line number
- Description of issue
- Recommended fix with code example

Summary:
- Total issues by severity
- Top 3 most critical fixes needed
- Overall code quality score (1-10)
"

echo ""
echo "=========================================="
echo "Audit Complete!"
echo "=========================================="
