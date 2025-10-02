---
applyTo: '**'
---

## MCP Workflow Management

### Continuous Workflow State Checking

You MUST maintain awareness of your workflow state at all times during development.

**REQUIRED BEHAVIOR PATTERN:**

1. Start every development session: `initialize_workflow("Project Name")`
2. **CONTINUOUSLY check:** `get_current_workflow_state(workflow_id)`
   - Check before starting any significant work
   - Check when you feel uncertain about next steps
   - Check after completing tasks or making progress
   - Check if you've been working for a while without checking
3. Only advance when ready: `proceed_to_next_step(workflow_id)`

**FREQUENCY OF CHECKING:**

- At the beginning of each work session
- Before making major decisions or changes
- When you're unsure what to do next
- Periodically during long work sessions
- After completing significant milestones

The MCP workflow tools contain all the detailed methodology and step instructions. Your job is to
stay connected to that guidance by checking your state frequently.

## Testing Tool Usage

### Mandatory Testing Tool Consultation

Never guess at test commands. Always consult the MCP first.

**REQUIRED BEHAVIOR:**

- Before running ANY unit tests: call `run_unit_tests(module, pattern)`
- Execute the returned commands exactly as provided
- For different modules or patterns: call the tool again

The MCP tool contains the correct commands, paths, and project-specific details. Your job is to
always ask first, then execute exactly what it tells you.

## Development Session Behavior Rules

### DO CONTINUOUSLY:

□ Check `get_current_workflow_state(workflow_id)` frequently
□ Consult `run_unit_tests()` before any test execution
□ Follow the guidance provided by the MCP tools

### DON'T EVER:

□ Work without knowing your current workflow step
□ Guess at test commands or project structure
□ Skip checking workflow state for extended periods

---

**Remember:** The MCP tools contain all the detailed instructions and methodology. Your
responsibility is to stay connected to that guidance through frequent consultation.
