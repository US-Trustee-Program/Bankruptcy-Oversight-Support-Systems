#!/usr/bin/env python3

import os
import re
import sys
import yaml
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any, Optional, Union


class WorkflowParser:
    def __init__(self, workflows_dir: str):
        self.workflows_dir = workflows_dir
        self.workflows: Dict[str, Dict] = {}

    def parse_all_workflows(self) -> None:
        """Parse all workflow files in the directory"""
        try:
            files = [f for f in os.listdir(self.workflows_dir)
                    if f.endswith('.yml') or f.endswith('.yaml')]
        except OSError:
            files = []

        for file in files:
            try:
                workflow = self.parse_workflow_file(file)
                self.workflows[file] = workflow
            except Exception as error:
                print(f"Error parsing {file}: {str(error)}", file=sys.stderr)

    def parse_workflow_file(self, filename: str) -> Dict:
        """Parse a single workflow file"""
        file_path = os.path.join(self.workflows_dir, filename)

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        workflow_data = yaml.safe_load(content)

        # Handle YAML parsing quirk where 'on:' can be parsed as True
        on_section = workflow_data.get('on') or workflow_data.get(True)

        is_reusable = (on_section is not None and
                      isinstance(on_section, dict) and
                      on_section.get('workflow_call') is not None)
        triggers = self.extract_triggers(on_section)

        jobs = {}

        if workflow_data.get('jobs'):
            for job_id, job in workflow_data['jobs'].items():
                jobs[job_id] = {
                    'name': job.get('name'),
                    'uses': job.get('uses'),
                    'needs': self.normalize_needs(job.get('needs')),
                    'condition': job.get('if'),
                    'with': job.get('with'),
                    'secrets': job.get('secrets'),
                }

        return {
            'filename': filename,
            'name': workflow_data.get('name') or re.sub(r'\.(yml|yaml)$', '', filename),
            'isReusable': is_reusable,
            'jobs': jobs,
            'triggers': triggers,
        }

    def extract_triggers(self, on: Union[str, List, Dict, None]) -> List[str]:
        """Extract trigger events from workflow 'on' section"""
        if not on:
            return []

        if isinstance(on, str):
            return [on]

        triggers = []

        if isinstance(on, list):
            return on

        if isinstance(on, dict):
            # Filter out non-trigger keys that might be parsed incorrectly
            trigger_keys = [
                'push',
                'pull_request',
                'workflow_dispatch',
                'schedule',
                'workflow_call',
                'workflow_run',
                'delete',
                'create',
                'release',
            ]

            for key in on.keys():
                if key in trigger_keys:
                    triggers.append(key)

        return triggers

    def normalize_needs(self, needs: Union[str, List, None]) -> List[str]:
        """Normalize 'needs' field to always be an array"""
        if not needs:
            return []
        if isinstance(needs, str):
            return [needs]
        if isinstance(needs, list):
            return needs
        return []

    def get_all_triggers(self) -> List[str]:
        """Get all unique triggers across workflows"""
        triggers = set()
        for workflow in self.workflows.values():
            if not workflow['isReusable']:
                for trigger in workflow['triggers']:
                    triggers.add(trigger)
        return sorted(list(triggers))

    def get_workflows_for_trigger(self, trigger_type: str) -> List[Tuple[str, Dict]]:
        """Get workflows triggered by a specific trigger"""
        return [(filename, workflow) for filename, workflow in self.workflows.items()
                if not workflow['isReusable'] and trigger_type in workflow['triggers']]

    def generate_workflow_dispatch_diagram(self, filename: str, workflow: Dict) -> str:
        """Generate diagram for a specific workflow triggered by workflow_dispatch"""
        diagram = "flowchart LR\n"
        nodes = []
        edges = []
        processed_workflows = set()
        reusable_workflows = {}

        # Add trigger and main workflow
        trigger_id = "trigger_workflow_dispatch"
        workflow_id = self.sanitize_id(filename)

        nodes.append(f"    {trigger_id}([\"workflow_dispatch\"])")
        nodes.append(f"    {workflow_id}[\"{workflow['name']}\"]")
        edges.append(f"    {trigger_id} --> {workflow_id}")

        # Add all dependencies for this workflow
        self.add_workflow_dependencies(
            filename,
            workflow,
            nodes,
            edges,
            processed_workflows,
            reusable_workflows,
        )

        # Add nodes and edges
        diagram += "\n".join(nodes) + "\n\n"
        diagram += "\n".join(edges) + "\n"

        # Add styling with workflow context
        diagram += self.generate_styling(nodes, processed_workflows)

        return diagram

    def generate_workflow_dispatch_diagrams(self) -> Dict[str, Dict]:
        """Generate all workflow_dispatch individual diagrams"""
        workflow_dispatch_workflows = self.get_workflows_for_trigger('workflow_dispatch')
        diagrams = {}

        for filename, workflow in workflow_dispatch_workflows:
            diagram = self.generate_workflow_dispatch_diagram(filename, workflow)
            diagrams[filename] = {
                'workflow': workflow,
                'diagram': diagram,
            }

        return diagrams

    def generate_trigger_diagram(self, trigger_type: str) -> str:
        """Generate Mermaid flowchart diagram for a specific trigger"""
        triggered_workflows = self.get_workflows_for_trigger(trigger_type)
        if not triggered_workflows:
            return ''

        diagram = "flowchart LR\n"
        nodes = []
        edges = []
        processed_workflows = set()
        reusable_workflows = {}

        # Add trigger node
        trigger_id = f"trigger_{self.sanitize_id(trigger_type)}"
        nodes.append(f"    {trigger_id}([\"{trigger_type}\"])")

        # Process each workflow triggered by this trigger
        for filename, workflow in triggered_workflows:
            workflow_id = self.sanitize_id(filename)

            # Add main workflow node
            nodes.append(f"    {workflow_id}[\"{workflow['name']}\"]")
            edges.append(f"    {trigger_id} --> {workflow_id}")

            # Recursively add called workflows
            self.add_workflow_dependencies(
                filename,
                workflow,
                nodes,
                edges,
                processed_workflows,
                reusable_workflows,
            )

        # Add all nodes and edges
        diagram += "\n".join(nodes) + "\n\n"
        diagram += "\n".join(edges) + "\n"

        # Add styling with workflow context
        diagram += self.generate_styling(nodes, processed_workflows)

        return diagram

    def add_workflow_dependencies(
        self,
        filename: str,
        workflow: Dict,
        nodes: List[str],
        edges: List[str],
        processed_workflows: Set[str],
        reusable_workflows: Optional[Dict] = None,
    ) -> None:
        """
        Recursively add workflow dependencies to the diagram
        NOTE: This method now deduplicates reusable workflow nodes to prevent
        the same reusable workflow from appearing multiple times in diagrams.
        Instead of creating unique IDs for each usage, reusable workflows now
        appear once and multiple jobs connect to the same node.
        """
        if reusable_workflows is None:
            reusable_workflows = {}

        workflow_id = self.sanitize_id(filename)

        if workflow_id in processed_workflows:
            return
        processed_workflows.add(workflow_id)

        # Add all jobs for this workflow
        for job_id, job in workflow['jobs'].items():
            job_node_id = f"{workflow_id}_{self.sanitize_id(job_id)}"
            job_label = job.get('name') or job_id

            # Add job node
            nodes.append(f"    {job_node_id}[\"{job_label}\"]")

            # Add edge from workflow to job (workflow "has" job)
            edges.append(f"    {workflow_id} --> {job_node_id}")

            # If job uses a reusable workflow, add that workflow and connect
            if job.get('uses'):
                called_workflow_file = self.find_workflow_by_path(job['uses'])
                if called_workflow_file and called_workflow_file in self.workflows:
                    called_workflow = self.workflows[called_workflow_file]

                    # Use a single node ID for each reusable workflow (deduplicated)
                    called_workflow_id = self.sanitize_id(called_workflow_file)

                    # Only add the reusable workflow node once
                    if called_workflow_id not in reusable_workflows:
                        workflow_label = (called_workflow_file if called_workflow['isReusable']
                                        else called_workflow['name'])
                        nodes.append(f"    {called_workflow_id}[\"{workflow_label}\"]")
                        reusable_workflows[called_workflow_id] = called_workflow

                        # Recursively process the called workflow jobs
                        self.add_reusable_workflow_jobs(
                            called_workflow_file,
                            called_workflow,
                            called_workflow_id,
                            nodes,
                            edges,
                            processed_workflows,
                            reusable_workflows,
                        )

                    # Add edge from job to workflow (job "uses" workflow)
                    edges.append(f"    {job_node_id} --> {called_workflow_id}")

    def add_reusable_workflow_jobs(
        self,
        filename: str,
        workflow: Dict,
        workflow_id: str,
        nodes: List[str],
        edges: List[str],
        processed_workflows: Set[str],
        reusable_workflows: Dict,
    ) -> None:
        """Add jobs for a reusable workflow (used for deduplication)"""
        # Add all jobs for this reusable workflow
        for job_id, job in workflow['jobs'].items():
            job_node_id = f"{workflow_id}_{self.sanitize_id(job_id)}"
            job_label = job.get('name') or job_id

            # Add job node
            nodes.append(f"    {job_node_id}[\"{job_label}\"]")

            # Add edge from workflow to job (workflow "has" job)
            edges.append(f"    {workflow_id} --> {job_node_id}")

            # If job uses another reusable workflow, add that workflow and connect
            if job.get('uses'):
                called_workflow_file = self.find_workflow_by_path(job['uses'])
                if called_workflow_file and called_workflow_file in self.workflows:
                    called_workflow = self.workflows[called_workflow_file]

                    # Use a single node ID for each reusable workflow (deduplicated)
                    called_workflow_id = self.sanitize_id(called_workflow_file)

                    # Only add the reusable workflow node once
                    if called_workflow_id not in reusable_workflows:
                        workflow_label = (called_workflow_file if called_workflow['isReusable']
                                        else called_workflow['name'])
                        nodes.append(f"    {called_workflow_id}[\"{workflow_label}\"]")
                        reusable_workflows[called_workflow_id] = called_workflow

                        # Recursively process the called workflow jobs
                        self.add_reusable_workflow_jobs(
                            called_workflow_file,
                            called_workflow,
                            called_workflow_id,
                            nodes,
                            edges,
                            processed_workflows,
                            reusable_workflows,
                        )

                    # Add edge from job to workflow (job "uses" workflow)
                    edges.append(f"    {job_node_id} --> {called_workflow_id}")

    def generate_styling(self, nodes: List[str], processed_workflows: Optional[Set[str]] = None) -> str:
        """Generate styling for the diagram"""
        if processed_workflows is None:
            processed_workflows = set()

        styling = "\n"
        styling += "    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000\n"
        styling += "    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n"
        styling += "    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n"
        styling += "    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000\n\n"

        # Apply styles based on node content and structure
        for node in nodes:
            regular_match = re.search(r'^\s+(\w+)[\[\(]', node)
            if regular_match:
                node_id = regular_match.group(1)

                if node_id.startswith('trigger_'):
                    styling += f"    class {node_id} trigger\n"
                elif self.is_workflow_node(node_id):
                    # This is a workflow node - determine if it's reusable or main
                    workflow_type = self.get_workflow_type_from_node_id(node_id)
                    if workflow_type == 'reusable':
                        styling += f"    class {node_id} reusable\n"
                    elif workflow_type == 'main':
                        styling += f"    class {node_id} mainWorkflow\n"
                else:
                    # This is a job node
                    styling += f"    class {node_id} job\n"

        return styling

    def is_workflow_node(self, node_id: str) -> bool:
        """Check if a node ID represents a workflow node"""
        # Original workflow files (ends with _yml and no additional underscores after that)
        if re.match(r'^\w+_yml$', node_id):
            return True

        # Instantiated workflow files (has pattern like workflowId_jobId_workflowfile_yml)
        if '_yml' in node_id and node_id.endswith('_yml'):
            return True

        return False

    def get_workflow_type_from_node_id(self, node_id: str) -> str:
        """Determine workflow type from node ID"""
        # Extract the original workflow filename from the node ID
        filename = ''

        if re.match(r'^\w+_yml$', node_id):
            # Simple case: continuous_deployment_yml -> continuous-deployment.yml
            filename = re.sub(r'_yml$', '.yml', node_id).replace('_', '-')
        elif '_yml' in node_id and node_id.endswith('_yml'):
            # For reusable workflows, the nodeId should now be just the workflow filename
            # e.g., reusable_build_frontend_yml -> reusable-build-frontend.yml
            filename = re.sub(r'_yml$', '.yml', node_id).replace('_', '-')

        workflow = self.workflows.get(filename)
        if workflow:
            return 'reusable' if workflow['isReusable'] else 'main'

        return 'unknown'

    def generate_overview_diagram(self) -> str:
        """Generate overview diagram showing all triggers and main workflows"""
        diagram = "flowchart LR\n"
        nodes = []
        edges = []

        # Group workflows by trigger
        trigger_groups = {}

        for filename, workflow in self.workflows.items():
            if not workflow['isReusable']:
                for trigger in workflow['triggers']:
                    if trigger not in trigger_groups:
                        trigger_groups[trigger] = []
                    trigger_groups[trigger].append((filename, workflow))

        # Add trigger nodes and connect to workflows
        for trigger, workflows in trigger_groups.items():
            trigger_id = f"trigger_{self.sanitize_id(trigger)}"
            nodes.append(f"    {trigger_id}([\"{trigger}\"])")

            for filename, workflow in workflows:
                workflow_id = self.sanitize_id(filename)
                nodes.append(f"    {workflow_id}[\"{workflow['name']}\"]")
                edges.append(f"    {trigger_id} --> {workflow_id}")

        # Add nodes and edges
        diagram += "\n".join(nodes) + "\n\n"
        diagram += "\n".join(edges) + "\n"

        # Add styling
        diagram += "\n"
        diagram += "    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n"
        diagram += "    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n\n"

        # Apply styles
        for trigger in trigger_groups.keys():
            trigger_id = f"trigger_{self.sanitize_id(trigger)}"
            diagram += f"    class {trigger_id} trigger\n"

        for filename, workflow in self.workflows.items():
            if not workflow['isReusable']:
                workflow_id = self.sanitize_id(filename)
                diagram += f"    class {workflow_id} mainWorkflow\n"

        return diagram

    def generate_all_trigger_diagrams(self) -> Dict[str, str]:
        """Generate all trigger-specific diagrams"""
        triggers = self.get_all_triggers()
        diagrams = {}

        for trigger in triggers:
            diagram = self.generate_trigger_diagram(trigger)
            if diagram:
                diagrams[trigger] = diagram

        return diagrams

    def find_workflow_by_path(self, uses_path: str) -> Optional[str]:
        """Find workflow filename by its uses path"""
        # Extract workflow path from uses (e.g., "./.github/workflows/reusable-build.yml")
        match = re.search(r'\.github/workflows/([^@]+)', uses_path)
        if match:
            return match.group(1)
        return None

    def sanitize_id(self, string: str) -> str:
        """Sanitize string for use as Mermaid node ID"""
        return re.sub(r'_{2,}', '_', re.sub(r'[^a-zA-Z0-9_]', '_', string))

    def generate_summary(self) -> str:
        """Generate summary statistics"""
        total = len(self.workflows)
        reusable = len([w for w in self.workflows.values() if w['isReusable']])
        main_workflows = total - reusable

        summary = "# GitHub Actions Workflow Analysis\n\n"
        summary += "## Summary\n"
        summary += f"- **Total Workflows**: {total}\n"
        summary += f"- **Main Workflows**: {main_workflows}\n"
        summary += f"- **Reusable Workflows**: {reusable}\n\n"

        # Add legend
        summary += "## Legend\n\n"
        summary += "The diagrams use color coding to distinguish different types of workflow components:\n\n"

        summary += "**Triggers** - Event triggers that start workflows:\n"
        summary += "```mermaid\n"
        summary += "flowchart LR\n"
        summary += '    trigger_example(["trigger (push, schedule, etc.)"])\n'
        summary += "    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n"
        summary += "    class trigger_example trigger\n"
        summary += "```\n\n"

        summary += "**Main Workflows** - Primary workflow files that can be triggered directly:\n"
        summary += "```mermaid\n"
        summary += "flowchart LR\n"
        summary += '    main_workflow_example["Main Workflow"]\n'
        summary += "    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n"
        summary += "    class main_workflow_example mainWorkflow\n"
        summary += "```\n\n"

        summary += "**Reusable Workflows** - Workflow files that are called by other workflows:\n"
        summary += "```mermaid\n"
        summary += "flowchart LR\n"
        summary += '    reusable_workflow_example["Reusable Workflow"]\n'
        summary += "    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000\n"
        summary += "    class reusable_workflow_example reusable\n"
        summary += "```\n\n"

        summary += "**Jobs** - Individual jobs within workflows showing internal dependencies:\n"
        summary += "```mermaid\n"
        summary += "flowchart LR\n"
        summary += '    job_example["job-name"]\n'
        summary += "    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000\n"
        summary += "    class job_example job\n"
        summary += "```\n\n"

        return summary

    def generate_continuous_deployment_dependency_diagram(self) -> str:
        """Generate dependency diagram for continuous deployment workflow"""
        cd_workflow = self.workflows.get('continuous-deployment.yml')
        if not cd_workflow:
            return ''

        # Use dynamic analysis instead of hardcoded dependencies
        dependencies = self.analyze_continuous_deployment_dependencies(cd_workflow)

        diagram = "flowchart LR\n"
        nodes = []
        edges = []

        # Add main workflow node
        workflow_id = 'continuous_deployment_workflow'

        # Add external inputs section with proper hierarchy
        if dependencies['externalInputs']:
            diagram += '    subgraph "External Inputs"\n'

            for category, variables in dependencies['externalInputs'].items():
                category_id = self.sanitize_id(category)
                diagram += f'        {category_id}["{category}"]\n'

                for var_name in variables:
                    var_id = self.sanitize_id(f"{category_id}_{var_name}")
                    diagram += f'        {var_id}["{var_name}"]\n'
                    edges.append(f'        {category_id} --> {var_id}')

            diagram += "    end\n\n"

        # Add job nodes with their used variables as subgraphs
        job_variables = {}  # jobId -> Set of variables used

        # Collect all variables used by each job
        for job_id, explicit_deps in dependencies['explicitDeps'].items():
            if job_id not in job_variables:
                job_variables[job_id] = set()
            for dep in explicit_deps:
                for input_var in dep['inputs']:
                    job_variables[job_id].add(input_var)

        for job_id, external_deps in dependencies['externalDeps'].items():
            if job_id not in job_variables:
                job_variables[job_id] = set()
            for dep in external_deps:
                job_variables[job_id].add(dep['variable'])

        # Add main workflow as subgraph containing all jobs
        diagram += f'    subgraph {workflow_id}["Continuous Deployment"]\n'

        # Create subgraphs for jobs with their variables inside the main workflow
        for job_id, job_info in cd_workflow['jobs'].items():
            job_node_id = self.sanitize_id(job_id)
            job_label = job_info.get('name') or job_id
            used_vars = job_variables.get(job_id, set())

            if used_vars:
                # Create subgraph for job with variables inside main workflow
                diagram += f'        subgraph {job_node_id}_subgraph["{job_label}"]\n'

                vars_array = sorted(list(used_vars))
                vars_node_id = self.sanitize_id(f"{job_id}_vars")
                # Use <br/> for HTML line breaks in Mermaid
                vars_label = '<br/>'.join(vars_array)
                diagram += f'            {vars_node_id}["{vars_label}"]\n'

                diagram += "        end\n"
            else:
                # Simple job node without variables inside main workflow
                diagram += f'        {job_node_id}["{job_label}"]\n'

        diagram += "    end\n\n"

        # Add explicit dependencies (needs relationships) - simplified edge labels
        for job_id, explicit_deps in dependencies['explicitDeps'].items():
            job_node_id = self.sanitize_id(job_id)
            used_vars = job_variables.get(job_id, set())
            target_id = f"{job_node_id}_subgraph" if used_vars else job_node_id

            for dep in explicit_deps:
                needed_job_id = self.sanitize_id(dep['job'])
                needed_used_vars = job_variables.get(dep['job'], set())
                source_id = f"{needed_job_id}_subgraph" if needed_used_vars else needed_job_id

                # Simple needs relationship without variable details on edge
                edges.append(f'    {source_id} ==>|"needs"| {target_id}')

        # Add implicit dependencies (data flows via outputs) - simplified
        for job_id, implicit_deps in dependencies['implicitDeps'].items():
            job_node_id = self.sanitize_id(job_id)
            used_vars = job_variables.get(job_id, set())
            target_id = f"{job_node_id}_subgraph" if used_vars else job_node_id

            for dep in implicit_deps:
                source_job_id = self.sanitize_id(dep['sourceJob'])
                source_used_vars = job_variables.get(dep['sourceJob'], set())
                source_id = f"{source_job_id}_subgraph" if source_used_vars else source_job_id

                edges.append(f'    {source_id} -.->|"{dep["variable"]}"| {target_id}')

        # Add external dependencies - connect external vars to job subgraphs
        for job_id, external_deps in dependencies['externalDeps'].items():
            job_node_id = self.sanitize_id(job_id)
            used_vars = job_variables.get(job_id, set())
            target_id = f"{job_node_id}_subgraph" if used_vars else job_node_id

            for dep in external_deps:
                category_id = self.sanitize_id(dep['category'])
                var_id = self.sanitize_id(f"{category_id}_{dep['variable']}")
                edges.append(f'    {var_id} -.-> {target_id}')

        # Combine all parts
        if nodes:
            diagram += "\n".join(nodes) + "\n\n"
        if edges:
            diagram += "\n".join(sorted(edges)) + "\n\n"

        # Add styling - use same color scheme as other diagrams
        diagram += "    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n"
        diagram += "    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000\n"
        diagram += "    classDef mainWorkflow fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff\n"
        diagram += "    classDef jobSubgraph fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000\n"
        diagram += "    classDef explicit stroke:#2196F3,stroke-width:3px\n"
        diagram += "    classDef dataflow stroke:#FF9800,stroke-dasharray: 5 5\n\n"

        # Apply classes to nodes
        diagram += f"    class {workflow_id} mainWorkflow\n"

        for category, variables in dependencies['externalInputs'].items():
            category_id = self.sanitize_id(category)
            diagram += f"    class {category_id} external\n"

            # Don't style individual variable nodes - let them use default styling
            # This prevents confusion with trigger colors

        # Apply styling to maintain consistency
        for job_id, job_info in cd_workflow['jobs'].items():
            job_node_id = self.sanitize_id(job_id)
            used_vars = job_variables.get(job_id, set())

            if used_vars:
                # Job with variables - style the subgraph to look like job nodes
                subgraph_id = f"{job_node_id}_subgraph"
                diagram += f"    class {subgraph_id} jobSubgraph\n"
                # Variable nodes use default styling (no class applied)
            else:
                # Simple job node without variables - apply job styling
                diagram += f"    class {job_node_id} job\n"

        return diagram

    def analyze_continuous_deployment_dependencies(self, workflow: Dict) -> Dict:
        """Analyze dependencies in the continuous deployment workflow"""
        explicit_deps = {}  # jobId -> [{job, inputs}]
        implicit_deps = {}  # jobId -> [{sourceJob, variable, type}]
        external_deps = {}  # jobId -> [{category, variable}]
        external_inputs = {}  # category -> Set of variables

        for job_id, job in workflow['jobs'].items():
            # Analyze explicit dependencies (needs)
            if job.get('needs'):
                job_explicit_deps = []
                for needed_job in job['needs']:
                    inputs = self.extract_inputs_from_needed_job(job, needed_job)
                    job_explicit_deps.append({'job': needed_job, 'inputs': inputs})
                explicit_deps[job_id] = job_explicit_deps

            # Analyze implicit dependencies and external inputs
            import json
            job_content = json.dumps(job)

            # Look for job outputs references
            job_output_matches = re.findall(r'\$\{\{\s*needs\.(\w+)\.outputs\.(\w+)\s*\}\}', job_content)
            if job_output_matches:
                job_implicit_deps = []
                for source_job, output_var in job_output_matches:
                    # Only add as implicit if not already in explicit needs
                    needs_jobs = job.get('needs', [])
                    if source_job not in needs_jobs:
                        job_implicit_deps.append({
                            'sourceJob': source_job,
                            'variable': output_var,
                            'type': 'job_output',
                        })
                if job_implicit_deps:
                    implicit_deps[job_id] = job_implicit_deps

            # Look for external inputs
            job_external_deps = []

            # Secrets
            secret_matches = re.findall(r'\$\{\{\s*secrets\.(\w+)\s*\}\}', job_content)
            if secret_matches:
                for secret_name in secret_matches:
                    job_external_deps.append({'category': 'Secrets', 'variable': secret_name})
                    if 'Secrets' not in external_inputs:
                        external_inputs['Secrets'] = set()
                    external_inputs['Secrets'].add(secret_name)

            # Variables
            var_matches = re.findall(r'\$\{\{\s*vars\.(\w+)\s*\}\}', job_content)
            if var_matches:
                for var_name in var_matches:
                    job_external_deps.append({'category': 'Variables', 'variable': var_name})
                    if 'Variables' not in external_inputs:
                        external_inputs['Variables'] = set()
                    external_inputs['Variables'].add(var_name)

            # GitHub context
            github_matches = re.findall(r'\$\{\{\s*github\.(\w+)\s*\}\}', job_content)
            if github_matches:
                for context_var in github_matches:
                    job_external_deps.append({'category': 'GitHub Context', 'variable': context_var})
                    if 'GitHub Context' not in external_inputs:
                        external_inputs['GitHub Context'] = set()
                    external_inputs['GitHub Context'].add(context_var)

            # Inputs (for workflow_dispatch)
            input_matches = re.findall(r'\$\{\{\s*inputs\.(\w+)\s*\}\}', job_content)
            if input_matches:
                for input_name in input_matches:
                    job_external_deps.append({'category': 'Workflow Inputs', 'variable': input_name})
                    if 'Workflow Inputs' not in external_inputs:
                        external_inputs['Workflow Inputs'] = set()
                    external_inputs['Workflow Inputs'].add(input_name)

            if job_external_deps:
                external_deps[job_id] = job_external_deps

        return {
            'explicitDeps': explicit_deps,
            'implicitDeps': implicit_deps,
            'externalDeps': external_deps,
            'externalInputs': external_inputs,
        }

    def generate_sub_deploy_code_slot_dependency_diagram(self) -> str:
        """Generate dependency diagram for sub-deploy-code-slot workflow"""
        workflow = self.workflows.get('sub-deploy-code-slot.yml')
        if not workflow:
            return ''

        # Use dynamic analysis instead of hardcoded dependencies
        dependencies = self.analyze_sub_deploy_code_slot_dependencies(workflow)

        diagram = "flowchart LR\n"  # Revert back to LR for side-by-side layout
        nodes = []
        edges = []

        # Add main workflow node
        workflow_id = 'sub_deploy_code_slot_workflow'

        # Add job nodes with their used variables as subgraphs
        job_variables = {}  # jobId -> Set of variables used

        # Collect all variables used by each job
        for job_id, explicit_deps in dependencies['explicitDeps'].items():
            if job_id not in job_variables:
                job_variables[job_id] = set()
            for dep in explicit_deps:
                for input_var in dep['inputs']:
                    job_variables[job_id].add(input_var)

        for job_id, external_deps in dependencies['externalDeps'].items():
            if job_id not in job_variables:
                job_variables[job_id] = set()
            for dep in external_deps:
                job_variables[job_id].add(dep['variable'])

        # Add main workflow as subgraph containing all jobs FIRST
        diagram += f'    subgraph {workflow_id}["Sub Deploy Code Slot"]\n'

        # Create subgraphs for jobs with their variables inside the main workflow
        for job_id, job_info in workflow['jobs'].items():
            job_node_id = self.sanitize_id(job_id)
            job_label = job_info.get('name') or job_id
            used_vars = job_variables.get(job_id, set())

            if used_vars:
                # Create subgraph for job with variables inside main workflow
                diagram += f'        subgraph {job_node_id}_subgraph["{job_label}"]\n'

                vars_array = sorted(list(used_vars))
                vars_node_id = self.sanitize_id(f"{job_id}_vars")
                # Use <br/> for HTML line breaks in Mermaid
                vars_label = '<br/>'.join(vars_array)
                diagram += f'            {vars_node_id}["{vars_label}"]\n'

                diagram += "        end\n"
            else:
                # Simple job node without variables inside main workflow
                diagram += f'        {job_node_id}["{job_label}"]\n'

        diagram += "    end\n\n"

        # Add external inputs section AFTER main workflow
        if dependencies['externalInputs']:
            diagram += '    subgraph "External Inputs"\n'

            for category, variables in dependencies['externalInputs'].items():
                category_id = self.sanitize_id(category)
                diagram += f'        {category_id}["{category}"]\n'

                for var_name in variables:
                    var_id = self.sanitize_id(f"{category_id}_{var_name}")
                    diagram += f'        {var_id}["{var_name}"]\n'
                    edges.append(f'        {category_id} --> {var_id}')

            diagram += "    end\n\n"

        # Add explicit dependencies (needs relationships) - simplified edge labels
        for job_id, explicit_deps in dependencies['explicitDeps'].items():
            job_node_id = self.sanitize_id(job_id)
            used_vars = job_variables.get(job_id, set())
            target_id = f"{job_node_id}_subgraph" if used_vars else job_node_id

            for dep in explicit_deps:
                needed_job_id = self.sanitize_id(dep['job'])
                needed_used_vars = job_variables.get(dep['job'], set())
                source_id = f"{needed_job_id}_subgraph" if needed_used_vars else needed_job_id

                # Simple needs relationship without variable details on edge
                edges.append(f'    {source_id} ==>|"needs"| {target_id}')

        # Add implicit dependencies (data flows via outputs) - simplified
        for job_id, implicit_deps in dependencies['implicitDeps'].items():
            job_node_id = self.sanitize_id(job_id)
            used_vars = job_variables.get(job_id, set())
            target_id = f"{job_node_id}_subgraph" if used_vars else job_node_id

            for dep in implicit_deps:
                source_job_id = self.sanitize_id(dep['sourceJob'])
                source_used_vars = job_variables.get(dep['sourceJob'], set())
                source_id = f"{source_job_id}_subgraph" if source_used_vars else source_job_id

                edges.append(f'    {source_id} -.->|"{dep["variable"]}"| {target_id}')

        # Add external dependencies - connect external vars to job subgraphs
        for job_id, external_deps in dependencies['externalDeps'].items():
            job_node_id = self.sanitize_id(job_id)
            used_vars = job_variables.get(job_id, set())
            target_id = f"{job_node_id}_subgraph" if used_vars else job_node_id

            for dep in external_deps:
                category_id = self.sanitize_id(dep['category'])
                var_id = self.sanitize_id(f"{category_id}_{dep['variable']}")
                edges.append(f'    {var_id} -.-> {target_id}')

        # Combine all parts
        if nodes:
            diagram += "\n".join(nodes) + "\n\n"
        if edges:
            diagram += "\n".join(sorted(edges)) + "\n\n"

        # Add styling - use same color scheme as other diagrams
        diagram += "    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n"
        diagram += "    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000\n"
        diagram += "    classDef mainWorkflow fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff\n"
        diagram += "    classDef jobSubgraph fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000\n"
        diagram += "    classDef explicit stroke:#2196F3,stroke-width:3px\n"
        diagram += "    classDef dataflow stroke:#FF9800,stroke-dasharray: 5 5\n\n"

        # Apply classes to nodes
        diagram += f"    class {workflow_id} mainWorkflow\n"

        for category, variables in dependencies['externalInputs'].items():
            category_id = self.sanitize_id(category)
            diagram += f"    class {category_id} external\n"

            # Don't style individual variable nodes - let them use default styling
            # This prevents confusion with trigger colors

        # Apply styling to maintain consistency
        for job_id, job_info in workflow['jobs'].items():
            job_node_id = self.sanitize_id(job_id)
            used_vars = job_variables.get(job_id, set())

            if used_vars:
                # Job with variables - style the subgraph to look like job nodes
                subgraph_id = f"{job_node_id}_subgraph"
                diagram += f"    class {subgraph_id} jobSubgraph\n"
                # Variable nodes use default styling (no class applied)
            else:
                # Simple job node without variables - apply job styling
                diagram += f"    class {job_node_id} job\n"

        return diagram

    def analyze_sub_deploy_code_slot_dependencies(self, workflow: Dict) -> Dict:
        """Analyze dependencies in the sub-deploy-code-slot workflow"""
        explicit_deps = {}  # jobId -> [{job, inputs}]
        implicit_deps = {}  # jobId -> [{sourceJob, variable, type}]
        external_deps = {}  # jobId -> [{category, variable}]
        external_inputs = {}  # category -> Set of variables

        for job_id, job in workflow['jobs'].items():
            # Analyze explicit dependencies (needs)
            if job.get('needs'):
                job_explicit_deps = []
                for needed_job in job['needs']:
                    inputs = self.extract_inputs_from_needed_job(job, needed_job)
                    job_explicit_deps.append({'job': needed_job, 'inputs': inputs})
                explicit_deps[job_id] = job_explicit_deps

            # Analyze implicit dependencies and external inputs
            import json
            job_content = json.dumps(job)

            # Look for job outputs references
            job_output_matches = re.findall(r'\$\{\{\s*needs\.(\w+)\.outputs\.(\w+)\s*\}\}', job_content)
            if job_output_matches:
                job_implicit_deps = []
                for source_job, output_var in job_output_matches:
                    # Only add as implicit if not already in explicit needs
                    needs_jobs = job.get('needs', [])
                    if source_job not in needs_jobs:
                        job_implicit_deps.append({
                            'sourceJob': source_job,
                            'variable': output_var,
                            'type': 'job_output',
                        })
                if job_implicit_deps:
                    implicit_deps[job_id] = job_implicit_deps

            # Look for external inputs
            job_external_deps = []

            # Secrets
            secret_matches = re.findall(r'\$\{\{\s*secrets\.(\w+)\s*\}\}', job_content)
            if secret_matches:
                for secret_name in secret_matches:
                    job_external_deps.append({'category': 'Secrets', 'variable': secret_name})
                    if 'Secrets' not in external_inputs:
                        external_inputs['Secrets'] = set()
                    external_inputs['Secrets'].add(secret_name)

            # Variables
            var_matches = re.findall(r'\$\{\{\s*vars\.(\w+)\s*\}\}', job_content)
            if var_matches:
                for var_name in var_matches:
                    job_external_deps.append({'category': 'Variables', 'variable': var_name})
                    if 'Variables' not in external_inputs:
                        external_inputs['Variables'] = set()
                    external_inputs['Variables'].add(var_name)

            # GitHub context
            github_matches = re.findall(r'\$\{\{\s*github\.(\w+)\s*\}\}', job_content)
            if github_matches:
                for context_var in github_matches:
                    job_external_deps.append({'category': 'GitHub Context', 'variable': context_var})
                    if 'GitHub Context' not in external_inputs:
                        external_inputs['GitHub Context'] = set()
                    external_inputs['GitHub Context'].add(context_var)

            # Inputs (for workflow_call)
            input_matches = re.findall(r'\$\{\{\s*inputs\.(\w+)\s*\}\}', job_content)
            if input_matches:
                for input_name in input_matches:
                    job_external_deps.append({'category': 'Workflow Inputs', 'variable': input_name})
                    if 'Workflow Inputs' not in external_inputs:
                        external_inputs['Workflow Inputs'] = set()
                    external_inputs['Workflow Inputs'].add(input_name)

            if job_external_deps:
                external_deps[job_id] = job_external_deps

        return {
            'explicitDeps': explicit_deps,
            'implicitDeps': implicit_deps,
            'externalDeps': external_deps,
            'externalInputs': external_inputs,
        }

    def extract_inputs_from_needed_job(self, job: Dict, needed_job: str) -> List[str]:
        """Extract specific inputs a job receives from a needed job"""
        inputs = []
        import json
        job_content = json.dumps(job)

        # Look for outputs from the specific needed job
        pattern = rf'\$\{{\{{s*needs\.{needed_job}\.outputs\.(\w+)\s*\}}\}}'
        matches = re.findall(pattern, job_content)
        inputs.extend(matches)

        return inputs

    def generate_workflow_details(self) -> str:
        """Generate workflow details section"""
        details = "## Workflow Details\n\n"

        # Group by type
        main_workflows_list = [(filename, workflow) for filename, workflow in self.workflows.items()
                              if not workflow['isReusable']]
        reusable_workflows = [(filename, workflow) for filename, workflow in self.workflows.items()
                             if workflow['isReusable']]

        if main_workflows_list:
            details += "### Main Workflows\n"
            for filename, workflow in main_workflows_list:
                details += f"- **{workflow['name']}** (`{filename}`)\n"
                if workflow['triggers']:
                    details += f"  - Triggers: {', '.join(workflow['triggers'])}\n"
                details += f"  - Jobs: {len(workflow['jobs'])}\n"
            details += "\n"

        if reusable_workflows:
            details += "### Reusable Workflows\n"
            for filename, workflow in reusable_workflows:
                details += f"- **{workflow['name']}** (`{filename}`)\n"
                details += f"  - Jobs: {len(workflow['jobs'])}\n"
            details += "\n"

        return details


# Main execution
def main():
    workflows_dir = os.path.join(os.path.dirname(__file__), '../../../.github', 'workflows')

    if not os.path.exists(workflows_dir):
        print(f"Workflows directory not found: {workflows_dir}", file=sys.stderr)
        sys.exit(1)

    parser = WorkflowParser(workflows_dir)
    parser.parse_all_workflows()

    # Generate summary
    summary = parser.generate_summary()

    # Generate trigger-specific diagrams
    trigger_diagrams = parser.generate_all_trigger_diagrams()

    # Generate individual workflow_dispatch diagrams
    workflow_dispatch_diagrams = parser.generate_workflow_dispatch_diagrams()

    # Build output with separate diagrams per trigger
    output = summary + "\n"

    triggers = sorted(trigger_diagrams.keys())

    if triggers:
        output += "## Workflow Flow Diagrams by Trigger\n\n"

        for trigger in triggers:
            if trigger == 'workflow_dispatch':
                # Special handling for workflow_dispatch - individual diagrams per workflow
                output += f"### {trigger.capitalize()} Triggered Workflows\n\n"
                output += f"The `{trigger}` trigger allows manual execution of workflows. Each workflow is shown individually below:\n\n"

                sorted_workflows = sorted(workflow_dispatch_diagrams.items(), key=lambda x: x[0])

                for filename, data in sorted_workflows:
                    workflow = data['workflow']
                    diagram = data['diagram']

                    output += f"#### {workflow['name']}\n\n"
                    output += f"Manual execution of `{filename}`\n\n"
                    output += "```mermaid\n"
                    output += diagram
                    output += "```\n\n"

                    # Add dependency diagram for continuous deployment workflow
                    if filename == 'continuous-deployment.yml':
                        dep_diagram = parser.generate_continuous_deployment_dependency_diagram()
                        if dep_diagram:
                            output += f"##### {workflow['name']} - Job Dependencies\n\n"
                            output += "This diagram shows the explicit and implicit dependencies between jobs in the continuous deployment workflow:\n\n"
                            output += "```mermaid\n"
                            output += dep_diagram
                            output += "```\n\n"

                        # Add sub-deploy-code-slot dependency diagram right after continuous deployment
                        sub_deploy_dep_diagram = parser.generate_sub_deploy_code_slot_dependency_diagram()
                        if sub_deploy_dep_diagram:
                            sub_deploy_workflow = parser.workflows.get('sub-deploy-code-slot.yml')
                            if sub_deploy_workflow:
                                output += f"##### {sub_deploy_workflow['name']} - Job Dependencies\n\n"
                                output += "This diagram shows the explicit and implicit dependencies between jobs in the sub deploy code slot workflow:\n\n"
                                output += "```mermaid\n"
                                output += sub_deploy_dep_diagram
                                output += "```\n\n"
            else:
                # Regular trigger handling for other triggers
                diagram = trigger_diagrams[trigger]
                trigger_workflows = parser.get_workflows_for_trigger(trigger)

                output += f"### {trigger.capitalize()} Triggered Workflows\n\n"
                output += f"Workflows triggered by `{trigger}`:\n"
                for filename, workflow in trigger_workflows:
                    output += f"- **{workflow['name']}** (`{filename}`)\n"
                output += "\n"
                output += "```mermaid\n"
                output += diagram
                output += "```\n\n"

                # Add dependency diagram for continuous deployment workflow if present
                cd_workflow = next(((filename, workflow) for filename, workflow in trigger_workflows
                                  if filename == 'continuous-deployment.yml'), None)
                if cd_workflow:
                    dep_diagram = parser.generate_continuous_deployment_dependency_diagram()
                    if dep_diagram:
                        output += f"#### {cd_workflow[1]['name']} - Job Dependencies\n\n"
                        output += "This diagram shows the explicit and implicit dependencies between jobs in the continuous deployment workflow:\n\n"
                        output += "```mermaid\n"
                        output += dep_diagram
                        output += "```\n\n"

                    # Add sub-deploy-code-slot dependency diagram right after continuous deployment
                    sub_deploy_dep_diagram = parser.generate_sub_deploy_code_slot_dependency_diagram()
                    if sub_deploy_dep_diagram:
                        sub_deploy_workflow = parser.workflows.get('sub-deploy-code-slot.yml')
                        if sub_deploy_workflow:
                            output += f"#### {sub_deploy_workflow['name']} - Job Dependencies\n\n"
                            output += "This diagram shows the explicit and implicit dependencies between jobs in the sub deploy code slot workflow:\n\n"
                            output += "```mermaid\n"
                            output += sub_deploy_dep_diagram
                            output += "```\n\n"

    # Also generate overview diagram showing all triggers and main workflows
    output += "## Overview: All Triggers and Main Workflows\n\n"
    output += "```mermaid\n"
    output += parser.generate_overview_diagram()
    output += "```\n\n"

    # Add workflow details at the bottom
    output += parser.generate_workflow_details()

    # Write to file
    output_file = os.path.join(os.path.dirname(__file__), '../../../docs/operations/workflow-diagram.md')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(output)

    print(f"Workflow diagrams generated: {output_file}")
    print(f"\nGenerated diagrams:")

    total_diagrams = 0
    for trigger in triggers:
        count = len(parser.get_workflows_for_trigger(trigger))
        if trigger == 'workflow_dispatch':
            print(f"  - {trigger}: {count} individual workflow diagrams")
            total_diagrams += count
        else:
            workflow_s = "workflow" if count == 1 else "workflows"
            print(f"  - {trigger}: 1 combined diagram ({count} {workflow_s})")
            total_diagrams += 1

    print("  - overview: 1 diagram")
    total_diagrams += 1

    print(f"\nTotal: {total_diagrams} diagrams generated\n")
    print(summary)


# Run if this is the main module
if __name__ == "__main__":
    main()
