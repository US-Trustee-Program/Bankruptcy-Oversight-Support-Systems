#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple YAML parser for basic workflow parsing
function parseYaml(content) {
  const lines = content.split('\n');
  const result = {};
  const stack = [{ obj: result, indent: -1 }];

  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Handle array items
    if (trimmed.startsWith('- ')) {
      const value = trimmed.substring(2).trim();
      const current = stack[stack.length - 1].obj;

      // Get the last key that was added
      const keys = Object.keys(current);
      const lastKey = keys[keys.length - 1];

      if (lastKey) {
        // If the current value isn't an array, make it one
        if (!Array.isArray(current[lastKey])) {
          current[lastKey] = [];
        }

        // Parse the value if it contains a colon (key-value in array)
        if (value.includes(':')) {
          const colonIndex = value.indexOf(':');
          const key = value.substring(0, colonIndex).trim();
          const val = value.substring(colonIndex + 1).trim();
          const obj = {};
          obj[key] = val || true;
          current[lastKey].push(obj);
        } else {
          // Handle bracketed arrays like [job1, job2, job3]
          if (value.startsWith('[') && value.endsWith(']')) {
            const arrayContent = value.substring(1, value.length - 1);
            const items = arrayContent.split(',').map(item => item.trim());
            current[lastKey] = items;
          } else {
            current[lastKey].push(value);
          }
        }
      }
      continue;
    }

    // Handle key-value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();

    // Handle comments: if value starts with #, treat as empty value
    if (value.startsWith('#')) {
      value = '';
    }

    // Adjust stack based on indentation
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].obj;

    if (value === '' || value === '[]' || value === '{}') {
      // This is a parent key or empty collection
      const newObj = value === '[]' ? [] : {};
      current[key] = newObj;
      stack.push({ obj: newObj, indent });
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Handle inline arrays like [job1, job2, job3]
      const arrayContent = value.substring(1, value.length - 1);
      if (arrayContent.trim()) {
        const items = arrayContent.split(',').map(item => item.trim());
        current[key] = items;
      } else {
        current[key] = [];
      }
    } else {
      // Parse the value, but strip comments first
      if (value.includes(' #')) {
        // Remove inline comments (but be careful not to remove # that's part of the value)
        const commentIndex = value.indexOf(' #');
        value = value.substring(0, commentIndex).trim();
      }
      current[key] = parseValue(value);
    }
  }

  return result;
}

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value.match(/^\d+$/)) return parseInt(value);
  if (value.match(/^\d+\.\d+$/)) return parseFloat(value);

  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.substring(1, value.length - 1);
  }

  return value;
}

class WorkflowParser {
  constructor(workflowsDir) {
    this.workflowsDir = workflowsDir;
    this.workflows = new Map();
    // Track reusable workflow nodes to avoid duplication
    this.reusableWorkflowNodes = new Map();
  }

  /**
   * Parse all workflow files in the directory
   */
  parseAllWorkflows() {
    const files = fs.readdirSync(this.workflowsDir)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

    for (const file of files) {
      try {
        const workflow = this.parseWorkflowFile(file);
        this.workflows.set(file, workflow);
      } catch (error) {
        console.error(`Error parsing ${file}:`, error.message);
      }
    }
  }

  /**
   * Parse a single workflow file
   */
  parseWorkflowFile(filename) {
    const filePath = path.join(this.workflowsDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const workflowData = parseYaml(content);

    const isReusable = workflowData.on && workflowData.on['workflow_call'] !== undefined;
    const triggers = this.extractTriggers(workflowData.on);

    const jobs = {};

    if (workflowData.jobs) {
      for (const [jobId, job] of Object.entries(workflowData.jobs)) {
        jobs[jobId] = {
          name: job.name,
          uses: job.uses,
          needs: this.normalizeNeeds(job.needs),
          condition: job.if
        };
      }
    }

    return {
      filename,
      name: workflowData.name || filename.replace(/\.(yml|yaml)$/, ''),
      isReusable,
      jobs,
      triggers
    };
  }

  /**
   * Extract trigger events from workflow 'on' section
   */
  extractTriggers(on) {
    if (!on) return [];

    if (typeof on === 'string') return [on];

    const triggers = [];

    if (Array.isArray(on)) {
      return on;
    }

    if (typeof on === 'object') {
      // Filter out non-trigger keys that might be parsed incorrectly
      const triggerKeys = [
        'push', 'pull_request', 'workflow_dispatch', 'schedule',
        'workflow_call', 'workflow_run', 'delete', 'create', 'release'
      ];

      for (const key of Object.keys(on)) {
        if (triggerKeys.includes(key)) {
          triggers.push(key);
        }
      }
    }

    return triggers;
  }

  /**
   * Normalize 'needs' field to always be an array
   */
  normalizeNeeds(needs) {
    if (!needs) return [];
    if (typeof needs === 'string') return [needs];
    if (Array.isArray(needs)) return needs;
    return [];
  }

  /**
   * Get all unique triggers across workflows
   */
  getAllTriggers() {
    const triggers = new Set();
    for (const workflow of this.workflows.values()) {
      if (!workflow.isReusable) {
        workflow.triggers.forEach(trigger => triggers.add(trigger));
      }
    }
    return Array.from(triggers).sort();
  }

  /**
   * Get workflows triggered by a specific trigger
   */
  getWorkflowsForTrigger(triggerType) {
    return Array.from(this.workflows.entries())
      .filter(([_, workflow]) => !workflow.isReusable && workflow.triggers.includes(triggerType));
  }

  /**
   * Generate diagram for a specific workflow triggered by workflow_dispatch
   */
  generateWorkflowDispatchDiagram(filename, workflow) {
    let diagram = `flowchart LR\n`;
    const nodes = [];
    const edges = new Set();
    const processedWorkflows = new Set();

    // Reset reusable workflow nodes for this diagram
    this.reusableWorkflowNodes.clear();

    // Add trigger and main workflow
    const triggerId = `trigger_workflow_dispatch`;
    const workflowId = this.sanitizeId(filename);

    nodes.push(`    ${triggerId}(["workflow_dispatch"])`);
    nodes.push(`    ${workflowId}["${workflow.name}"]`);
    edges.add(`    ${triggerId} --> ${workflowId}`);

    // Add all dependencies for this workflow
    this.addWorkflowDependencies(filename, workflow, nodes, edges, processedWorkflows);

    // Add nodes and edges
    diagram += nodes.join('\n') + '\n\n';
    diagram += Array.from(edges).join('\n') + '\n';

    // Add styling with workflow context
    diagram += this.generateStyling(nodes, processedWorkflows);

    return diagram;
  }

  /**
   * Generate all workflow_dispatch individual diagrams
   */
  generateWorkflowDispatchDiagrams() {
    const workflowDispatchWorkflows = this.getWorkflowsForTrigger('workflow_dispatch');
    const diagrams = {};

    for (const [filename, workflow] of workflowDispatchWorkflows) {
      const diagram = this.generateWorkflowDispatchDiagram(filename, workflow);
      diagrams[filename] = {
        workflow: workflow,
        diagram: diagram
      };
    }

    return diagrams;
  }

  /**
   * Generate Mermaid flowchart diagram for a specific trigger
   */
  generateTriggerDiagram(triggerType) {
    const triggeredWorkflows = this.getWorkflowsForTrigger(triggerType);
    if (triggeredWorkflows.length === 0) {
      return '';
    }

    let diagram = `flowchart LR\n`;
    const nodes = [];
    const edges = new Set();
    const processedWorkflows = new Set();

    // Reset reusable workflow nodes for this diagram
    this.reusableWorkflowNodes.clear();

    // Add trigger node
    const triggerId = `trigger_${this.sanitizeId(triggerType)}`;
    nodes.push(`    ${triggerId}(["${triggerType}"])`);

    // Process each workflow triggered by this trigger
    for (const [filename, workflow] of triggeredWorkflows) {
      const workflowId = this.sanitizeId(filename);

      // Add main workflow node
      nodes.push(`    ${workflowId}["${workflow.name}"]`);
      edges.add(`    ${triggerId} --> ${workflowId}`);

      // Recursively add called workflows
      this.addWorkflowDependencies(filename, workflow, nodes, edges, processedWorkflows);
    }

    // Add all nodes and edges
    diagram += nodes.join('\n') + '\n\n';
    diagram += Array.from(edges).join('\n') + '\n';

    // Add styling with workflow context
    diagram += this.generateStyling(nodes, processedWorkflows);

    return diagram;
  }

  /**
   * Recursively add workflow dependencies to the diagram
   */
  addWorkflowDependencies(filename, workflow, nodes, edges, processedWorkflows) {
    const workflowId = this.sanitizeId(filename);

    if (processedWorkflows.has(workflowId)) {
      return;
    }
    processedWorkflows.add(workflowId);

    // Add all jobs for this workflow and their dependencies
    this.addJobsAndDependencies(workflowId, workflow, nodes, edges);
  }

  /**
   * Add jobs and their dependencies for a workflow
   */
  addJobsAndDependencies(workflowId, workflow, nodes, edges) {
    const jobNodeIds = new Map(); // Track job node IDs for dependency connections

    // First pass: Add all job nodes
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      const jobNodeId = `${workflowId}_${this.sanitizeId(jobId)}`;
      const jobLabel = job.name || jobId;
      jobNodeIds.set(jobId, jobNodeId);

      // Add job node
      nodes.push(`    ${jobNodeId}["${jobLabel}"]`);

      // Add edge from workflow to job (workflow "has" job)
      edges.add(`    ${workflowId} --> ${jobNodeId}`);
    }

    // Second pass: Add job dependencies and reusable workflow connections
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      const jobNodeId = jobNodeIds.get(jobId);

      // Add dependencies between jobs based on 'needs'
      if (job.needs && job.needs.length > 0) {
        for (const neededJobId of job.needs) {
          const neededJobNodeId = jobNodeIds.get(neededJobId);
          if (neededJobNodeId) {
            // Add dependency edge: needed job --> current job
            edges.add(`    ${neededJobNodeId} --> ${jobNodeId}`);
          }
        }
      }

      // If job uses a reusable workflow, add deduplicated reusable workflow
      if (job.uses) {
        const calledWorkflowFile = this.findWorkflowByPath(job.uses);
        if (calledWorkflowFile && this.workflows.has(calledWorkflowFile)) {
          const calledWorkflow = this.workflows.get(calledWorkflowFile);

          if (calledWorkflow.isReusable) {
            // Use deduplicated reusable workflow node
            const reusableWorkflowId = this.getOrCreateReusableWorkflowNode(
              calledWorkflowFile,
              calledWorkflow,
              nodes
            );

            // Add edge from job to reusable workflow (job "uses" workflow)
            edges.add(`    ${jobNodeId} --> ${reusableWorkflowId}`);

            // Add jobs from the reusable workflow with the reusable workflow as parent
            this.addJobsAndDependencies(reusableWorkflowId, calledWorkflow, nodes, edges);
          }
        }
      }
    }
  }

  /**
   * Get or create a deduplicated reusable workflow node
   */
  getOrCreateReusableWorkflowNode(filename, workflow, nodes) {
    const baseId = this.sanitizeId(filename);

    // Check if we already have this reusable workflow node
    if (this.reusableWorkflowNodes.has(filename)) {
      return this.reusableWorkflowNodes.get(filename);
    }

    // Create new reusable workflow node
    const reusableWorkflowId = `reusable_${baseId}`;
    const workflowLabel = `${workflow.name}<br/>(Reusable)`;

    nodes.push(`    ${reusableWorkflowId}["${workflowLabel}"]`);

    // Store the node ID for reuse
    this.reusableWorkflowNodes.set(filename, reusableWorkflowId);

    return reusableWorkflowId;
  }

  /**
   * Generate styling for the diagram
   */
  generateStyling(nodes, processedWorkflows = new Set()) {
    let styling = '\n';
    styling += '    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000\n';
    styling += '    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n';
    styling += '    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n';
    styling += '    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000\n\n';

    // Track which nodes are actual reusable workflow nodes (not jobs within them)
    const actualReusableWorkflowNodes = new Set();
    for (const [filename] of this.reusableWorkflowNodes) {
      const nodeId = this.reusableWorkflowNodes.get(filename);
      actualReusableWorkflowNodes.add(nodeId);
    }

    // Apply styles based on node content and structure
    for (const node of nodes) {
      const regularMatch = node.match(/^\s+(\w+)[\[\(]/);
      if (regularMatch) {
        const nodeId = regularMatch[1];

        if (nodeId.startsWith('trigger_')) {
          styling += `    class ${nodeId} trigger\n`;
        } else if (actualReusableWorkflowNodes.has(nodeId)) {
          // Only style actual reusable workflow nodes (tracked in reusableWorkflowNodes map)
          styling += `    class ${nodeId} reusable\n`;
        } else if (this.isWorkflowNode(nodeId)) {
          // This is a main workflow node
          const workflowType = this.getWorkflowTypeFromNodeId(nodeId);
          if (workflowType === 'reusable') {
            styling += `    class ${nodeId} reusable\n`;
          } else if (workflowType === 'main') {
            styling += `    class ${nodeId} mainWorkflow\n`;
          }
        } else {
          // This is a job node - everything else that doesn't match the patterns above
          styling += `    class ${nodeId} job\n`;
        }
      }
    }

    return styling;
  }

  /**
   * Check if a node ID represents a workflow node
   */
  isWorkflowNode(nodeId) {
    // Original workflow files (ends with _yml and no additional underscores after that)
    // Pattern: workflowname_yml (like continuous_deployment_yml)
    if (/^[a-zA-Z0-9]+(_[a-zA-Z0-9]+)*_yml$/.test(nodeId)) {
      // Check if this actually corresponds to a workflow file
      const filename = nodeId.replace(/_yml$/, '.yml').replace(/_/g, '-');
      return this.workflows.has(filename);
    }

    return false;
  }

  /**
   * Determine workflow type from node ID
   */
  getWorkflowTypeFromNodeId(nodeId) {
    // Extract the original workflow filename from the node ID
    let filename = '';

    if (/^\w+_yml$/.test(nodeId)) {
      // Simple case: continuous_deployment_yml -> continuous-deployment.yml
      filename = nodeId.replace(/_yml$/, '.yml').replace(/_/g, '-');
    } else if (nodeId.includes('_yml') && nodeId.endsWith('_yml')) {
      // Complex case: extract the workflow file part
      const parts = nodeId.split('_');
      const ymlIndex = parts.lastIndexOf('yml');
      if (ymlIndex > 0) {
        const workflowParts = parts.slice(ymlIndex - 1, ymlIndex + 1);
        filename = workflowParts.join('_').replace(/_yml$/, '.yml').replace(/_/g, '-');
      }
    }

    const workflow = this.workflows.get(filename);
    if (workflow) {
      return workflow.isReusable ? 'reusable' : 'main';
    }

    return 'unknown';
  }

  /**
   * Generate overview diagram showing all triggers and main workflows
   */
  generateOverviewDiagram() {
    let diagram = 'flowchart LR\n';
    const nodes = [];
    const edges = new Set();

    // Group workflows by trigger
    const triggerGroups = {};

    for (const [filename, workflow] of this.workflows) {
      if (!workflow.isReusable) {
        for (const trigger of workflow.triggers) {
          if (!triggerGroups[trigger]) {
            triggerGroups[trigger] = [];
          }
          triggerGroups[trigger].push([filename, workflow]);
        }
      }
    }

    // Add trigger nodes and connect to workflows
    for (const [trigger, workflows] of Object.entries(triggerGroups)) {
      const triggerId = `trigger_${this.sanitizeId(trigger)}`;
      nodes.push(`    ${triggerId}(["${trigger}"])`);

      for (const [filename, workflow] of workflows) {
        const workflowId = this.sanitizeId(filename);
        nodes.push(`    ${workflowId}["${workflow.name}"]`);
        edges.add(`    ${triggerId} --> ${workflowId}`);
      }
    }

    // Add nodes and edges
    diagram += nodes.join('\n') + '\n\n';
    diagram += Array.from(edges).join('\n') + '\n';

    // Add styling
    diagram += '\n';
    diagram += '    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n';
    diagram += '    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n\n';

    // Apply styles
    for (const trigger of Object.keys(triggerGroups)) {
      const triggerId = `trigger_${this.sanitizeId(trigger)}`;
      diagram += `    class ${triggerId} trigger\n`;
    }

    for (const [filename, workflow] of this.workflows) {
      if (!workflow.isReusable) {
        const workflowId = this.sanitizeId(filename);
        diagram += `    class ${workflowId} mainWorkflow\n`;
      }
    }

    return diagram;
  }

  /**
   * Generate all trigger-specific diagrams
   */
  generateAllTriggerDiagrams() {
    const triggers = this.getAllTriggers();
    const diagrams = {};

    for (const trigger of triggers) {
      const diagram = this.generateTriggerDiagram(trigger);
      if (diagram) {
        diagrams[trigger] = diagram;
      }
    }

    return diagrams;
  }

  /**
   * Find workflow filename by its uses path
   */
  findWorkflowByPath(usesPath) {
    // Extract workflow path from uses (e.g., "./.github/workflows/reusable-build.yml")
    const match = usesPath.match(/\.github\/workflows\/([^@]+)/);
    if (match) {
      return match[1];
    }
    return null;
  }

  /**
   * Sanitize string for use as Mermaid node ID
   */
  sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_{2,}/g, '_');
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const total = this.workflows.size;
    const reusable = Array.from(this.workflows.values())
      .filter(w => w.isReusable).length;
    const mainWorkflows = total - reusable;

    let summary = `# GitHub Actions Workflow Analysis\n\n`;
    summary += `## Summary\n`;
    summary += `- **Total Workflows**: ${total}\n`;
    summary += `- **Main Workflows**: ${mainWorkflows}\n`;
    summary += `- **Reusable Workflows**: ${reusable}\n\n`;

    // Add legend
    summary += `## Legend\n\n`;
    summary += `The diagrams use color coding to distinguish different types of workflow components:\n\n`;

    summary += `**Triggers** - Event triggers that start workflows:\n`;
    summary += `\`\`\`mermaid\n`;
    summary += `flowchart LR\n`;
    summary += `    trigger_example(["trigger (push, schedule, etc.)"])\n`;
    summary += `    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n`;
    summary += `    class trigger_example trigger\n`;
    summary += `\`\`\`\n\n`;

    summary += `**Main Workflows** - Primary workflow files that can be triggered directly:\n`;
    summary += `\`\`\`mermaid\n`;
    summary += `flowchart LR\n`;
    summary += `    main_workflow_example["Main Workflow"]\n`;
    summary += `    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n`;
    summary += `    class main_workflow_example mainWorkflow\n`;
    summary += `\`\`\`\n\n`;

    summary += `**Reusable Workflows** - Workflow files that are called by other workflows:\n`;
    summary += `\`\`\`mermaid\n`;
    summary += `flowchart LR\n`;
    summary += `    reusable_workflow_example["Reusable Workflow"]\n`;
    summary += `    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000\n`;
    summary += `    class reusable_workflow_example reusable\n`;
    summary += `\`\`\`\n\n`;

    summary += `**Jobs** - Individual jobs within workflows showing internal dependencies:\n`;
    summary += `\`\`\`mermaid\n`;
    summary += `flowchart LR\n`;
    summary += `    job_example["job-name"]\n`;
    summary += `    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000\n`;
    summary += `    class job_example job\n`;
    summary += `\`\`\`\n\n`;

    return summary;
  }

  generateWorkflowDetails() {
    let details = `## Workflow Details\n\n`;

    // Group by type
    const mainWorkflowsList = Array.from(this.workflows.entries())
      .filter(([_, w]) => !w.isReusable);
    const reusableWorkflows = Array.from(this.workflows.entries())
      .filter(([_, w]) => w.isReusable);

    if (mainWorkflowsList.length > 0) {
      details += `### Main Workflows\n`;
      for (const [filename, workflow] of mainWorkflowsList) {
        details += `- **${workflow.name}** (\`${filename}\`)\n`;
        if (workflow.triggers.length > 0) {
          details += `  - Triggers: ${workflow.triggers.join(', ')}\n`;
        }
        details += `  - Jobs: ${Object.keys(workflow.jobs).length}\n`;
      }
      details += '\n';
    }

    if (reusableWorkflows.length > 0) {
      details += `### Reusable Workflows\n`;
      for (const [filename, workflow] of reusableWorkflows) {
        details += `- **${workflow.name}** (\`${filename}\`)\n`;
        details += `  - Jobs: ${Object.keys(workflow.jobs).length}\n`;
      }
      details += '\n';
    }

    return details;
  }
}

// Main execution
function main() {
  const workflowsDir = path.join(__dirname, '.github', 'workflows');

  if (!fs.existsSync(workflowsDir)) {
    console.error(`Workflows directory not found: ${workflowsDir}`);
    process.exit(1);
  }

  const parser = new WorkflowParser(workflowsDir);
  parser.parseAllWorkflows();

  // Generate summary
  const summary = parser.generateSummary();

  // Generate trigger-specific diagrams
  const triggerDiagrams = parser.generateAllTriggerDiagrams();

  // Generate individual workflow_dispatch diagrams
  const workflowDispatchDiagrams = parser.generateWorkflowDispatchDiagrams();

  // Build output with separate diagrams per trigger
  let output = summary + '\n';

  const triggers = Object.keys(triggerDiagrams).sort();

  if (triggers.length > 0) {
    output += '## Workflow Flow Diagrams by Trigger\n\n';

    for (const trigger of triggers) {
      if (trigger === 'workflow_dispatch') {
        // Special handling for workflow_dispatch - individual diagrams per workflow
        output += `### ${trigger.charAt(0).toUpperCase() + trigger.slice(1)} Triggered Workflows\n\n`;
        output += `The \`${trigger}\` trigger allows manual execution of workflows. Each workflow is shown individually below:\n\n`;

        const sortedWorkflows = Object.entries(workflowDispatchDiagrams)
          .sort(([a], [b]) => a.localeCompare(b));

        for (const [filename, { workflow, diagram }] of sortedWorkflows) {
          output += `#### ${workflow.name}\n\n`;
          output += `Manual execution of \`${filename}\`\n\n`;
          output += '```mermaid\n';
          output += diagram;
          output += '```\n\n';
        }
      } else {
        // Regular trigger handling for other triggers
        const diagram = triggerDiagrams[trigger];
        const triggerWorkflows = parser.getWorkflowsForTrigger(trigger);

        output += `### ${trigger.charAt(0).toUpperCase() + trigger.slice(1)} Triggered Workflows\n\n`;
        output += `Workflows triggered by \`${trigger}\`:\n`;
        for (const [filename, workflow] of triggerWorkflows) {
          output += `- **${workflow.name}** (\`${filename}\`)\n`;
        }
        output += '\n';
        output += '```mermaid\n';
        output += diagram;
        output += '```\n\n';
      }
    }
  }

  // Also generate overview diagram showing all triggers and main workflows
  output += '## Overview: All Triggers and Main Workflows\n\n';
  output += '```mermaid\n';
  output += parser.generateOverviewDiagram();
  output += '```\n\n';

  // Add workflow details at the bottom
  output += parser.generateWorkflowDetails();

  // Write to file
  const outputFile = path.join(__dirname, 'workflow-diagram-enhanced.md');
  fs.writeFileSync(outputFile, output);

  console.log(`Enhanced workflow diagrams generated: ${outputFile}`);
  console.log(`\nGenerated diagrams:`);

  let totalDiagrams = 0;
  triggers.forEach(trigger => {
    const count = parser.getWorkflowsForTrigger(trigger).length;
    if (trigger === 'workflow_dispatch') {
      console.log(`  - ${trigger}: ${count} individual workflow diagrams`);
      totalDiagrams += count;
    } else {
      console.log(`  - ${trigger}: 1 combined diagram (${count} workflow${count !== 1 ? 's' : ''})`);
      totalDiagrams += 1;
    }
  });

  console.log(`  - overview: 1 diagram`);
  totalDiagrams += 1;

  console.log(`\nTotal: ${totalDiagrams} diagrams generated\n`);
  console.log(summary);
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { WorkflowParser };
