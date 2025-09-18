#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class WorkflowParser {
  constructor(workflowsDir) {
    this.workflowsDir = workflowsDir;
    this.workflows = new Map();
  }

  /**
   * Parse all workflow files in the directory
   */
  parseAllWorkflows() {
    const files = fs
      .readdirSync(this.workflowsDir)
      .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));

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
    const workflowData = yaml.load(content);

    const isReusable = workflowData.on && workflowData.on['workflow_call'] !== undefined;
    const triggers = this.extractTriggers(workflowData.on);

    const jobs = {};

    if (workflowData.jobs) {
      for (const [jobId, job] of Object.entries(workflowData.jobs)) {
        jobs[jobId] = {
          name: job.name,
          uses: job.uses,
          needs: this.normalizeNeeds(job.needs),
          condition: job.if,
          with: job.with,
          secrets: job.secrets,
        };
      }
    }

    return {
      filename,
      name: workflowData.name || filename.replace(/\.(yml|yaml)$/, ''),
      isReusable,
      jobs,
      triggers,
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
        'push',
        'pull_request',
        'workflow_dispatch',
        'schedule',
        'workflow_call',
        'workflow_run',
        'delete',
        'create',
        'release',
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
        workflow.triggers.forEach((trigger) => triggers.add(trigger));
      }
    }
    return Array.from(triggers).sort();
  }

  /**
   * Get workflows triggered by a specific trigger
   */
  getWorkflowsForTrigger(triggerType) {
    return Array.from(this.workflows.entries()).filter(
      ([_, workflow]) => !workflow.isReusable && workflow.triggers.includes(triggerType),
    );
  }

  /**
   * Generate diagram for a specific workflow triggered by workflow_dispatch
   */
  generateWorkflowDispatchDiagram(filename, workflow) {
    let diagram = `flowchart LR\n`;
    const nodes = [];
    const edges = new Set();
    const processedWorkflows = new Set();
    const reusableWorkflows = new Map();

    // Add trigger and main workflow
    const triggerId = `trigger_workflow_dispatch`;
    const workflowId = this.sanitizeId(filename);

    nodes.push(`    ${triggerId}(["workflow_dispatch"])`);
    nodes.push(`    ${workflowId}["${workflow.name}"]`);
    edges.add(`    ${triggerId} --> ${workflowId}`);

    // Add all dependencies for this workflow
    this.addWorkflowDependencies(
      filename,
      workflow,
      nodes,
      edges,
      processedWorkflows,
      reusableWorkflows,
    );

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
        diagram: diagram,
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
    const reusableWorkflows = new Map();

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
      this.addWorkflowDependencies(
        filename,
        workflow,
        nodes,
        edges,
        processedWorkflows,
        reusableWorkflows,
      );
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
   * NOTE: This method now deduplicates reusable workflow nodes to prevent
   * the same reusable workflow from appearing multiple times in diagrams.
   * Instead of creating unique IDs for each usage, reusable workflows now
   * appear once and multiple jobs connect to the same node.
   */
  addWorkflowDependencies(
    filename,
    workflow,
    nodes,
    edges,
    processedWorkflows,
    reusableWorkflows = new Map(),
  ) {
    const workflowId = this.sanitizeId(filename);

    if (processedWorkflows.has(workflowId)) {
      return;
    }
    processedWorkflows.add(workflowId);

    // Add all jobs for this workflow
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      const jobNodeId = `${workflowId}_${this.sanitizeId(jobId)}`;
      const jobLabel = job.name || jobId;

      // Add job node
      nodes.push(`    ${jobNodeId}["${jobLabel}"]`);

      // Add edge from workflow to job (workflow "has" job)
      edges.add(`    ${workflowId} --> ${jobNodeId}`);

      // If job uses a reusable workflow, add that workflow and connect
      if (job.uses) {
        const calledWorkflowFile = this.findWorkflowByPath(job.uses);
        if (calledWorkflowFile && this.workflows.has(calledWorkflowFile)) {
          const calledWorkflow = this.workflows.get(calledWorkflowFile);

          // Use a single node ID for each reusable workflow (deduplicated)
          const calledWorkflowId = this.sanitizeId(calledWorkflowFile);

          // Only add the reusable workflow node once
          if (!reusableWorkflows.has(calledWorkflowId)) {
            const workflowLabel = calledWorkflow.isReusable
              ? `${calledWorkflowFile}`
              : calledWorkflow.name;
            nodes.push(`    ${calledWorkflowId}["${workflowLabel}"]`);
            reusableWorkflows.set(calledWorkflowId, calledWorkflow);

            // Recursively process the called workflow jobs
            this.addReusableWorkflowJobs(
              calledWorkflowFile,
              calledWorkflow,
              calledWorkflowId,
              nodes,
              edges,
              processedWorkflows,
              reusableWorkflows,
            );
          }

          // Add edge from job to workflow (job "uses" workflow)
          edges.add(`    ${jobNodeId} --> ${calledWorkflowId}`);
        }
      }
    }
  }

  /**
   * Add jobs for a reusable workflow (used for deduplication)
   */
  addReusableWorkflowJobs(
    filename,
    workflow,
    workflowId,
    nodes,
    edges,
    processedWorkflows,
    reusableWorkflows,
  ) {
    // Add all jobs for this reusable workflow
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      const jobNodeId = `${workflowId}_${this.sanitizeId(jobId)}`;
      const jobLabel = job.name || jobId;

      // Add job node
      nodes.push(`    ${jobNodeId}["${jobLabel}"]`);

      // Add edge from workflow to job (workflow "has" job)
      edges.add(`    ${workflowId} --> ${jobNodeId}`);

      // If job uses another reusable workflow, add that workflow and connect
      if (job.uses) {
        const calledWorkflowFile = this.findWorkflowByPath(job.uses);
        if (calledWorkflowFile && this.workflows.has(calledWorkflowFile)) {
          const calledWorkflow = this.workflows.get(calledWorkflowFile);

          // Use a single node ID for each reusable workflow (deduplicated)
          const calledWorkflowId = this.sanitizeId(calledWorkflowFile);

          // Only add the reusable workflow node once
          if (!reusableWorkflows.has(calledWorkflowId)) {
            const workflowLabel = calledWorkflow.isReusable
              ? `${calledWorkflowFile}`
              : calledWorkflow.name;
            nodes.push(`    ${calledWorkflowId}["${workflowLabel}"]`);
            reusableWorkflows.set(calledWorkflowId, calledWorkflow);

            // Recursively process the called workflow jobs
            this.addReusableWorkflowJobs(
              calledWorkflowFile,
              calledWorkflow,
              calledWorkflowId,
              nodes,
              edges,
              processedWorkflows,
              reusableWorkflows,
            );
          }

          // Add edge from job to workflow (job "uses" workflow)
          edges.add(`    ${jobNodeId} --> ${calledWorkflowId}`);
        }
      }
    }
  }

  /**
   * Generate styling for the diagram
   */
  generateStyling(nodes, processedWorkflows = new Set()) {
    let styling = '\n';
    styling += '    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000\n';
    styling +=
      '    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n';
    styling += '    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n';
    styling += '    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000\n\n';

    // Apply styles based on node content and structure
    for (const node of nodes) {
      const regularMatch = node.match(/^\s+(\w+)[\[\(]/);
      if (regularMatch) {
        const nodeId = regularMatch[1];

        if (nodeId.startsWith('trigger_')) {
          styling += `    class ${nodeId} trigger\n`;
        } else if (this.isWorkflowNode(nodeId)) {
          // This is a workflow node - determine if it's reusable or main
          const workflowType = this.getWorkflowTypeFromNodeId(nodeId);
          if (workflowType === 'reusable') {
            styling += `    class ${nodeId} reusable\n`;
          } else if (workflowType === 'main') {
            styling += `    class ${nodeId} mainWorkflow\n`;
          }
        } else {
          // This is a job node
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
    if (/^\w+_yml$/.test(nodeId)) {
      return true;
    }

    // Instantiated workflow files (has pattern like workflowId_jobId_workflowfile_yml)
    if (nodeId.includes('_yml') && nodeId.endsWith('_yml')) {
      return true;
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
      // For reusable workflows, the nodeId should now be just the workflow filename
      // e.g., reusable_build_frontend_yml -> reusable-build-frontend.yml
      filename = nodeId.replace(/_yml$/, '.yml').replace(/_/g, '-');
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
    diagram +=
      '    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n';
    diagram +=
      '    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n\n';

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
    const reusable = Array.from(this.workflows.values()).filter((w) => w.isReusable).length;
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

  /**
   * Generate dependency diagram for continuous deployment workflow
   */
  generateContinuousDeploymentDependencyDiagram() {
    const cdWorkflow = this.workflows.get('continuous-deployment.yml');
    if (!cdWorkflow) {
      return '';
    }

    // Use dynamic analysis instead of hardcoded dependencies
    const dependencies = this.analyzeContinuousDeploymentDependencies(cdWorkflow);

    let diagram = `flowchart LR\n`;
    const nodes = [];
    const edges = new Set();

    // Add main workflow node
    const workflowId = 'continuous_deployment_workflow';

    // Add external inputs section with proper hierarchy
    if (dependencies.externalInputs.size > 0) {
      diagram += `    subgraph "External Inputs"\n`;

      for (const [category, variables] of dependencies.externalInputs) {
        const categoryId = this.sanitizeId(category);
        diagram += `        ${categoryId}["${category}"]\n`;

        for (const varName of variables) {
          const varId = this.sanitizeId(`${categoryId}_${varName}`);
          diagram += `        ${varId}["${varName}"]\n`;
          edges.add(`        ${categoryId} --> ${varId}`);
        }
      }

      diagram += `    end\n\n`;
    }

    // Add job nodes with their used variables as subgraphs
    const jobVariables = new Map(); // jobId -> Set of variables used

    // Collect all variables used by each job
    for (const [jobId, explicitDeps] of dependencies.explicitDeps) {
      if (!jobVariables.has(jobId)) jobVariables.set(jobId, new Set());
      for (const dep of explicitDeps) {
        for (const input of dep.inputs) {
          jobVariables.get(jobId).add(input);
        }
      }
    }

    for (const [jobId, externalDeps] of dependencies.externalDeps) {
      if (!jobVariables.has(jobId)) jobVariables.set(jobId, new Set());
      for (const dep of externalDeps) {
        jobVariables.get(jobId).add(dep.variable);
      }
    }

    // Add main workflow as subgraph containing all jobs
    diagram += `    subgraph ${workflowId}["Continuous Deployment"]\n`;

    // Create subgraphs for jobs with their variables inside the main workflow
    for (const [jobId, jobInfo] of Object.entries(cdWorkflow.jobs)) {
      const jobNodeId = this.sanitizeId(jobId);
      const jobLabel = jobInfo.name || jobId;
      const usedVars = jobVariables.get(jobId) || new Set();

      if (usedVars.size > 0) {
        // Create subgraph for job with variables inside main workflow
        diagram += `        subgraph ${jobNodeId}_subgraph["${jobLabel}"]\n`;

        const varsArray = Array.from(usedVars).sort();
        const varsNodeId = this.sanitizeId(`${jobId}_vars`);
        // Use <br/> for HTML line breaks in Mermaid
        const varsLabel = varsArray.join('<br/>');
        diagram += `            ${varsNodeId}["${varsLabel}"]\n`;

        diagram += `        end\n`;
      } else {
        // Simple job node without variables inside main workflow
        diagram += `        ${jobNodeId}["${jobLabel}"]\n`;
      }
    }

    diagram += `    end\n\n`;

    // Add explicit dependencies (needs relationships) - simplified edge labels
    for (const [jobId, explicitDeps] of dependencies.explicitDeps) {
      const jobNodeId = this.sanitizeId(jobId);
      const usedVars = jobVariables.get(jobId) || new Set();
      const targetId = usedVars.size > 0 ? `${jobNodeId}_subgraph` : jobNodeId;

      for (const dep of explicitDeps) {
        const neededJobId = this.sanitizeId(dep.job);
        const neededUsedVars = jobVariables.get(dep.job) || new Set();
        const sourceId = neededUsedVars.size > 0 ? `${neededJobId}_subgraph` : neededJobId;

        // Simple needs relationship without variable details on edge
        edges.add(`    ${sourceId} ==>|"needs"| ${targetId}`);
      }
    }

    // Add implicit dependencies (data flows via outputs) - simplified
    for (const [jobId, implicitDeps] of dependencies.implicitDeps) {
      const jobNodeId = this.sanitizeId(jobId);
      const usedVars = jobVariables.get(jobId) || new Set();
      const targetId = usedVars.size > 0 ? `${jobNodeId}_subgraph` : jobNodeId;

      for (const dep of implicitDeps) {
        const sourceJobId = this.sanitizeId(dep.sourceJob);
        const sourceUsedVars = jobVariables.get(dep.sourceJob) || new Set();
        const sourceId = sourceUsedVars.size > 0 ? `${sourceJobId}_subgraph` : sourceJobId;

        edges.add(`    ${sourceId} -.->|"${dep.variable}"| ${targetId}`);
      }
    }

    // Add external dependencies - connect external vars to job subgraphs
    for (const [jobId, externalDeps] of dependencies.externalDeps) {
      const jobNodeId = this.sanitizeId(jobId);
      const usedVars = jobVariables.get(jobId) || new Set();
      const targetId = usedVars.size > 0 ? `${jobNodeId}_subgraph` : jobNodeId;

      for (const dep of externalDeps) {
        const categoryId = this.sanitizeId(dep.category);
        const varId = this.sanitizeId(`${categoryId}_${dep.variable}`);
        edges.add(`    ${varId} -.-> ${targetId}`);
      }
    }

    // Combine all parts
    if (nodes.length > 0) {
      diagram += nodes.join('\n') + '\n\n';
    }
    if (edges.size > 0) {
      diagram += Array.from(edges).join('\n') + '\n\n';
    }

    // Add styling - use same color scheme as other diagrams
    diagram += `    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n`;
    diagram += `    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000\n`;
    diagram += `    classDef mainWorkflow fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff\n`;
    diagram += `    classDef jobSubgraph fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000\n`;
    diagram += `    classDef explicit stroke:#2196F3,stroke-width:3px\n`;
    diagram += `    classDef dataflow stroke:#FF9800,stroke-dasharray: 5 5\n\n`;

    // Apply classes to nodes
    diagram += `    class ${workflowId} mainWorkflow\n`;

    for (const [category, variables] of dependencies.externalInputs) {
      const categoryId = this.sanitizeId(category);
      diagram += `    class ${categoryId} external\n`;

      // Don't style individual variable nodes - let them use default styling
      // This prevents confusion with trigger colors
    }

    // Apply styling to maintain consistency
    for (const [jobId, jobInfo] of Object.entries(cdWorkflow.jobs)) {
      const jobNodeId = this.sanitizeId(jobId);
      const usedVars = jobVariables.get(jobId) || new Set();

      if (usedVars.size > 0) {
        // Job with variables - style the subgraph to look like job nodes
        const subgraphId = `${jobNodeId}_subgraph`;
        diagram += `    class ${subgraphId} jobSubgraph\n`;
        // Variable nodes use default styling (no class applied)
      } else {
        // Simple job node without variables - apply job styling
        diagram += `    class ${jobNodeId} job\n`;
      }
    }

    return diagram;
  }

  /**
   * Analyze dependencies in the continuous deployment workflow
   */
  analyzeContinuousDeploymentDependencies(workflow) {
    const explicitDeps = new Map(); // jobId -> [{job, inputs}]
    const implicitDeps = new Map(); // jobId -> [{sourceJob, variable, type}]
    const externalDeps = new Map(); // jobId -> [{category, variable}]
    const externalInputs = new Map(); // category -> Set of variables

    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      // Analyze explicit dependencies (needs)
      if (job.needs && job.needs.length > 0) {
        const jobExplicitDeps = [];
        for (const neededJob of job.needs) {
          const inputs = this.extractInputsFromNeededJob(job, neededJob);
          jobExplicitDeps.push({ job: neededJob, inputs });
        }
        explicitDeps.set(jobId, jobExplicitDeps);
      }

      // Analyze implicit dependencies and external inputs
      const jobContent = JSON.stringify(job);

      // Look for job outputs references
      const jobOutputMatches = jobContent.match(/\$\{\{\s*needs\.(\w+)\.outputs\.(\w+)\s*\}\}/g);
      if (jobOutputMatches) {
        const jobImplicitDeps = [];
        for (const match of jobOutputMatches) {
          const [, sourceJob, outputVar] = match.match(
            /\$\{\{\s*needs\.(\w+)\.outputs\.(\w+)\s*\}\}/,
          );
          // Only add as implicit if not already in explicit needs
          const needsJobs = job.needs || [];
          if (!needsJobs.includes(sourceJob)) {
            jobImplicitDeps.push({
              sourceJob,
              variable: outputVar,
              type: 'job_output',
            });
          }
        }
        if (jobImplicitDeps.length > 0) {
          implicitDeps.set(jobId, jobImplicitDeps);
        }
      }

      // Look for external inputs
      const jobExternalDeps = [];

      // Secrets
      const secretMatches = jobContent.match(/\$\{\{\s*secrets\.(\w+)\s*\}\}/g);
      if (secretMatches) {
        for (const match of secretMatches) {
          const [, secretName] = match.match(/\$\{\{\s*secrets\.(\w+)\s*\}\}/);
          jobExternalDeps.push({ category: 'Secrets', variable: secretName });
          if (!externalInputs.has('Secrets')) externalInputs.set('Secrets', new Set());
          externalInputs.get('Secrets').add(secretName);
        }
      }

      // Variables
      const varMatches = jobContent.match(/\$\{\{\s*vars\.(\w+)\s*\}\}/g);
      if (varMatches) {
        for (const match of varMatches) {
          const [, varName] = match.match(/\$\{\{\s*vars\.(\w+)\s*\}\}/);
          jobExternalDeps.push({ category: 'Variables', variable: varName });
          if (!externalInputs.has('Variables')) externalInputs.set('Variables', new Set());
          externalInputs.get('Variables').add(varName);
        }
      }

      // GitHub context
      const githubMatches = jobContent.match(/\$\{\{\s*github\.(\w+)\s*\}\}/g);
      if (githubMatches) {
        for (const match of githubMatches) {
          const [, contextVar] = match.match(/\$\{\{\s*github\.(\w+)\s*\}\}/);
          jobExternalDeps.push({ category: 'GitHub Context', variable: contextVar });
          if (!externalInputs.has('GitHub Context'))
            externalInputs.set('GitHub Context', new Set());
          externalInputs.get('GitHub Context').add(contextVar);
        }
      }

      // Inputs (for workflow_dispatch)
      const inputMatches = jobContent.match(/\$\{\{\s*inputs\.(\w+)\s*\}\}/g);
      if (inputMatches) {
        for (const match of inputMatches) {
          const [, inputName] = match.match(/\$\{\{\s*inputs\.(\w+)\s*\}\}/);
          jobExternalDeps.push({ category: 'Workflow Inputs', variable: inputName });
          if (!externalInputs.has('Workflow Inputs'))
            externalInputs.set('Workflow Inputs', new Set());
          externalInputs.get('Workflow Inputs').add(inputName);
        }
      }

      if (jobExternalDeps.length > 0) {
        externalDeps.set(jobId, jobExternalDeps);
      }
    }

    return {
      explicitDeps,
      implicitDeps,
      externalDeps,
      externalInputs,
    };
  }

  /**
   * Generate dependency diagram for sub-deploy-code-slot workflow
   */
  generateSubDeployCodeSlotDependencyDiagram() {
    const workflow = this.workflows.get('sub-deploy-code-slot.yml');
    if (!workflow) {
      return '';
    }

    // Use dynamic analysis instead of hardcoded dependencies
    const dependencies = this.analyzeSubDeployCodeSlotDependencies(workflow);

    let diagram = `flowchart LR\n`; // Revert back to LR for side-by-side layout
    const nodes = [];
    const edges = new Set();

    // Add main workflow node
    const workflowId = 'sub_deploy_code_slot_workflow';

    // Add job nodes with their used variables as subgraphs
    const jobVariables = new Map(); // jobId -> Set of variables used

    // Collect all variables used by each job
    for (const [jobId, explicitDeps] of dependencies.explicitDeps) {
      if (!jobVariables.has(jobId)) jobVariables.set(jobId, new Set());
      for (const dep of explicitDeps) {
        for (const input of dep.inputs) {
          jobVariables.get(jobId).add(input);
        }
      }
    }

    for (const [jobId, externalDeps] of dependencies.externalDeps) {
      if (!jobVariables.has(jobId)) jobVariables.set(jobId, new Set());
      for (const dep of externalDeps) {
        jobVariables.get(jobId).add(dep.variable);
      }
    }

    // Add main workflow as subgraph containing all jobs FIRST
    diagram += `    subgraph ${workflowId}["Sub Deploy Code Slot"]\n`;

    // Create subgraphs for jobs with their variables inside the main workflow
    for (const [jobId, jobInfo] of Object.entries(workflow.jobs)) {
      const jobNodeId = this.sanitizeId(jobId);
      const jobLabel = jobInfo.name || jobId;
      const usedVars = jobVariables.get(jobId) || new Set();

      if (usedVars.size > 0) {
        // Create subgraph for job with variables inside main workflow
        diagram += `        subgraph ${jobNodeId}_subgraph["${jobLabel}"]\n`;

        const varsArray = Array.from(usedVars).sort();
        const varsNodeId = this.sanitizeId(`${jobId}_vars`);
        // Use <br/> for HTML line breaks in Mermaid
        const varsLabel = varsArray.join('<br/>');
        diagram += `            ${varsNodeId}["${varsLabel}"]\n`;

        diagram += `        end\n`;
      } else {
        // Simple job node without variables inside main workflow
        diagram += `        ${jobNodeId}["${jobLabel}"]\n`;
      }
    }

    diagram += `    end\n\n`;

    // Add external inputs section AFTER main workflow
    if (dependencies.externalInputs.size > 0) {
      diagram += `    subgraph "External Inputs"\n`;

      for (const [category, variables] of dependencies.externalInputs) {
        const categoryId = this.sanitizeId(category);
        diagram += `        ${categoryId}["${category}"]\n`;

        for (const varName of variables) {
          const varId = this.sanitizeId(`${categoryId}_${varName}`);
          diagram += `        ${varId}["${varName}"]\n`;
          edges.add(`        ${categoryId} --> ${varId}`);
        }
      }

      diagram += `    end\n\n`;
    }

    // Add explicit dependencies (needs relationships) - simplified edge labels
    for (const [jobId, explicitDeps] of dependencies.explicitDeps) {
      const jobNodeId = this.sanitizeId(jobId);
      const usedVars = jobVariables.get(jobId) || new Set();
      const targetId = usedVars.size > 0 ? `${jobNodeId}_subgraph` : jobNodeId;

      for (const dep of explicitDeps) {
        const neededJobId = this.sanitizeId(dep.job);
        const neededUsedVars = jobVariables.get(dep.job) || new Set();
        const sourceId = neededUsedVars.size > 0 ? `${neededJobId}_subgraph` : neededJobId;

        // Simple needs relationship without variable details on edge
        edges.add(`    ${sourceId} ==>|"needs"| ${targetId}`);
      }
    }

    // Add implicit dependencies (data flows via outputs) - simplified
    for (const [jobId, implicitDeps] of dependencies.implicitDeps) {
      const jobNodeId = this.sanitizeId(jobId);
      const usedVars = jobVariables.get(jobId) || new Set();
      const targetId = usedVars.size > 0 ? `${jobNodeId}_subgraph` : jobNodeId;

      for (const dep of implicitDeps) {
        const sourceJobId = this.sanitizeId(dep.sourceJob);
        const sourceUsedVars = jobVariables.get(dep.sourceJob) || new Set();
        const sourceId = sourceUsedVars.size > 0 ? `${sourceJobId}_subgraph` : sourceJobId;

        edges.add(`    ${sourceId} -.->|"${dep.variable}"| ${targetId}`);
      }
    }

    // Add external dependencies - connect external vars to job subgraphs
    for (const [jobId, externalDeps] of dependencies.externalDeps) {
      const jobNodeId = this.sanitizeId(jobId);
      const usedVars = jobVariables.get(jobId) || new Set();
      const targetId = usedVars.size > 0 ? `${jobNodeId}_subgraph` : jobNodeId;

      for (const dep of externalDeps) {
        const categoryId = this.sanitizeId(dep.category);
        const varId = this.sanitizeId(`${categoryId}_${dep.variable}`);
        edges.add(`    ${varId} -.-> ${targetId}`);
      }
    }

    // Combine all parts
    if (nodes.length > 0) {
      diagram += nodes.join('\n') + '\n\n';
    }
    if (edges.size > 0) {
      diagram += Array.from(edges).join('\n') + '\n\n';
    }

    // Add styling - use same color scheme as other diagrams
    diagram += `    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n`;
    diagram += `    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000\n`;
    diagram += `    classDef mainWorkflow fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff\n`;
    diagram += `    classDef jobSubgraph fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000\n`;
    diagram += `    classDef explicit stroke:#2196F3,stroke-width:3px\n`;
    diagram += `    classDef dataflow stroke:#FF9800,stroke-dasharray: 5 5\n\n`;

    // Apply classes to nodes
    diagram += `    class ${workflowId} mainWorkflow\n`;

    for (const [category, variables] of dependencies.externalInputs) {
      const categoryId = this.sanitizeId(category);
      diagram += `    class ${categoryId} external\n`;

      // Don't style individual variable nodes - let them use default styling
      // This prevents confusion with trigger colors
    }

    // Apply styling to maintain consistency
    for (const [jobId, jobInfo] of Object.entries(workflow.jobs)) {
      const jobNodeId = this.sanitizeId(jobId);
      const usedVars = jobVariables.get(jobId) || new Set();

      if (usedVars.size > 0) {
        // Job with variables - style the subgraph to look like job nodes
        const subgraphId = `${jobNodeId}_subgraph`;
        diagram += `    class ${subgraphId} jobSubgraph\n`;
        // Variable nodes use default styling (no class applied)
      } else {
        // Simple job node without variables - apply job styling
        diagram += `    class ${jobNodeId} job\n`;
      }
    }

    return diagram;
  }

  /**
   * Analyze dependencies in the sub-deploy-code-slot workflow
   */
  analyzeSubDeployCodeSlotDependencies(workflow) {
    const explicitDeps = new Map(); // jobId -> [{job, inputs}]
    const implicitDeps = new Map(); // jobId -> [{sourceJob, variable, type}]
    const externalDeps = new Map(); // jobId -> [{category, variable}]
    const externalInputs = new Map(); // category -> Set of variables

    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      // Analyze explicit dependencies (needs)
      if (job.needs && job.needs.length > 0) {
        const jobExplicitDeps = [];
        for (const neededJob of job.needs) {
          const inputs = this.extractInputsFromNeededJob(job, neededJob);
          jobExplicitDeps.push({ job: neededJob, inputs });
        }
        explicitDeps.set(jobId, jobExplicitDeps);
      }

      // Analyze implicit dependencies and external inputs
      const jobContent = JSON.stringify(job);

      // Look for job outputs references
      const jobOutputMatches = jobContent.match(/\$\{\{\s*needs\.(\w+)\.outputs\.(\w+)\s*\}\}/g);
      if (jobOutputMatches) {
        const jobImplicitDeps = [];
        for (const match of jobOutputMatches) {
          const [, sourceJob, outputVar] = match.match(
            /\$\{\{\s*needs\.(\w+)\.outputs\.(\w+)\s*\}\}/,
          );
          // Only add as implicit if not already in explicit needs
          const needsJobs = job.needs || [];
          if (!needsJobs.includes(sourceJob)) {
            jobImplicitDeps.push({
              sourceJob,
              variable: outputVar,
              type: 'job_output',
            });
          }
        }
        if (jobImplicitDeps.length > 0) {
          implicitDeps.set(jobId, jobImplicitDeps);
        }
      }

      // Look for external inputs
      const jobExternalDeps = [];

      // Secrets
      const secretMatches = jobContent.match(/\$\{\{\s*secrets\.(\w+)\s*\}\}/g);
      if (secretMatches) {
        for (const match of secretMatches) {
          const [, secretName] = match.match(/\$\{\{\s*secrets\.(\w+)\s*\}\}/);
          jobExternalDeps.push({ category: 'Secrets', variable: secretName });
          if (!externalInputs.has('Secrets')) externalInputs.set('Secrets', new Set());
          externalInputs.get('Secrets').add(secretName);
        }
      }

      // Variables
      const varMatches = jobContent.match(/\$\{\{\s*vars\.(\w+)\s*\}\}/g);
      if (varMatches) {
        for (const match of varMatches) {
          const [, varName] = match.match(/\$\{\{\s*vars\.(\w+)\s*\}\}/);
          jobExternalDeps.push({ category: 'Variables', variable: varName });
          if (!externalInputs.has('Variables')) externalInputs.set('Variables', new Set());
          externalInputs.get('Variables').add(varName);
        }
      }

      // GitHub context
      const githubMatches = jobContent.match(/\$\{\{\s*github\.(\w+)\s*\}\}/g);
      if (githubMatches) {
        for (const match of githubMatches) {
          const [, contextVar] = match.match(/\$\{\{\s*github\.(\w+)\s*\}\}/);
          jobExternalDeps.push({ category: 'GitHub Context', variable: contextVar });
          if (!externalInputs.has('GitHub Context'))
            externalInputs.set('GitHub Context', new Set());
          externalInputs.get('GitHub Context').add(contextVar);
        }
      }

      // Inputs (for workflow_call)
      const inputMatches = jobContent.match(/\$\{\{\s*inputs\.(\w+)\s*\}\}/g);
      if (inputMatches) {
        for (const match of inputMatches) {
          const [, inputName] = match.match(/\$\{\{\s*inputs\.(\w+)\s*\}\}/);
          jobExternalDeps.push({ category: 'Workflow Inputs', variable: inputName });
          if (!externalInputs.has('Workflow Inputs'))
            externalInputs.set('Workflow Inputs', new Set());
          externalInputs.get('Workflow Inputs').add(inputName);
        }
      }

      if (jobExternalDeps.length > 0) {
        externalDeps.set(jobId, jobExternalDeps);
      }
    }

    return {
      explicitDeps,
      implicitDeps,
      externalDeps,
      externalInputs,
    };
  }

  /**
   * Extract specific inputs a job receives from a needed job
   */
  extractInputsFromNeededJob(job, neededJob) {
    const inputs = [];
    const jobContent = JSON.stringify(job);

    // Look for outputs from the specific needed job
    const pattern = new RegExp(
      `\\$\\{\\{\\s*needs\\.${neededJob}\\.outputs\\.(\\w+)\\s*\\}\\}`,
      'g',
    );
    let match;
    while ((match = pattern.exec(jobContent)) !== null) {
      inputs.push(match[1]);
    }

    return inputs;
  }

  generateWorkflowDetails() {
    let details = `## Workflow Details\n\n`;

    // Group by type
    const mainWorkflowsList = Array.from(this.workflows.entries()).filter(
      ([_, w]) => !w.isReusable,
    );
    const reusableWorkflows = Array.from(this.workflows.entries()).filter(([_, w]) => w.isReusable);

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

        const sortedWorkflows = Object.entries(workflowDispatchDiagrams).sort(([a], [b]) =>
          a.localeCompare(b),
        );

        for (const [filename, { workflow, diagram }] of sortedWorkflows) {
          output += `#### ${workflow.name}\n\n`;
          output += `Manual execution of \`${filename}\`\n\n`;
          output += '```mermaid\n';
          output += diagram;
          output += '```\n\n';

          // Add dependency diagram for continuous deployment workflow
          if (filename === 'continuous-deployment.yml') {
            const depDiagram = parser.generateContinuousDeploymentDependencyDiagram();
            if (depDiagram) {
              output += `##### ${workflow.name} - Job Dependencies\n\n`;
              output += `This diagram shows the explicit and implicit dependencies between jobs in the continuous deployment workflow:\n\n`;
              output += '```mermaid\n';
              output += depDiagram;
              output += '```\n\n';
            }

            // Add sub-deploy-code-slot dependency diagram right after continuous deployment
            const subDeployDepDiagram = parser.generateSubDeployCodeSlotDependencyDiagram();
            if (subDeployDepDiagram) {
              const subDeployWorkflow = parser.workflows.get('sub-deploy-code-slot.yml');
              if (subDeployWorkflow) {
                output += `##### ${subDeployWorkflow.name} - Job Dependencies\n\n`;
                output += `This diagram shows the explicit and implicit dependencies between jobs in the sub deploy code slot workflow:\n\n`;
                output += '```mermaid\n';
                output += subDeployDepDiagram;
                output += '```\n\n';
              }
            }
          }

          // Remove the standalone sub-deploy-code-slot check since it's now grouped with continuous deployment
          // if (filename === 'sub-deploy-code-slot.yml') { ... }
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

        // Add dependency diagram for continuous deployment workflow if present
        const cdWorkflow = triggerWorkflows.find(
          ([filename, workflow]) => filename === 'continuous-deployment.yml',
        );
        if (cdWorkflow) {
          const depDiagram = parser.generateContinuousDeploymentDependencyDiagram();
          if (depDiagram) {
            output += `#### ${cdWorkflow[1].name} - Job Dependencies\n\n`;
            output += `This diagram shows the explicit and implicit dependencies between jobs in the continuous deployment workflow:\n\n`;
            output += '```mermaid\n';
            output += depDiagram;
            output += '```\n\n';
          }

          // Add sub-deploy-code-slot dependency diagram right after continuous deployment
          const subDeployDepDiagram = parser.generateSubDeployCodeSlotDependencyDiagram();
          if (subDeployDepDiagram) {
            const subDeployWorkflow = parser.workflows.get('sub-deploy-code-slot.yml');
            if (subDeployWorkflow) {
              output += `#### ${subDeployWorkflow.name} - Job Dependencies\n\n`;
              output += `This diagram shows the explicit and implicit dependencies between jobs in the sub deploy code slot workflow:\n\n`;
              output += '```mermaid\n';
              output += subDeployDepDiagram;
              output += '```\n\n';
            }
          }
        }

        // Remove the standalone sub-deploy-code-slot check since it's now grouped with continuous deployment
        // const subDeployWorkflow = triggerWorkflows.find(...)
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
  const outputFile = path.join(__dirname, 'workflow-diagram.md');
  fs.writeFileSync(outputFile, output);

  console.log(`Workflow diagrams generated: ${outputFile}`);
  console.log(`\nGenerated diagrams:`);

  let totalDiagrams = 0;
  triggers.forEach((trigger) => {
    const count = parser.getWorkflowsForTrigger(trigger).length;
    if (trigger === 'workflow_dispatch') {
      console.log(`  - ${trigger}: ${count} individual workflow diagrams`);
      totalDiagrams += count;
    } else {
      console.log(
        `  - ${trigger}: 1 combined diagram (${count} workflow${count !== 1 ? 's' : ''})`,
      );
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
