#!/usr/bin/env python3

import os
import re
import sys
import yaml
from typing import Dict, List, Set, Tuple, Optional, Iterable, Any

# -----------------------------
# Configuration and Constants
# -----------------------------
# Directory paths (relative to this script)
WORKFLOWS_DIR_RELATIVE = '../../../.github/workflows'
OUTPUT_FILE_RELATIVE = '../../../docs/operations/workflow-diagram.md'

# File extensions and patterns
WORKFLOW_FILE_EXTENSIONS = ('.yml', '.yaml')
YML_EXTENSION = '.yml'
GITHUB_WORKFLOWS_PATTERN = r'\.github/workflows/([^@]+)'
NODE_ID_PATTERN = r'^\s+(\w+)[\[(]'
WORKFLOW_NODE_PATTERN = '_yml'

# GitHub Actions trigger types
TRIGGER_KEYS = {
    'push', 'pull_request', 'workflow_dispatch', 'schedule', 'workflow_call',
    'workflow_run', 'delete', 'create', 'release'
}

# GitHub Actions expression patterns for dependency analysis
JOB_OUTPUT_PATTERN = re.compile(r'\$\{\{\s*needs\.(\w+)\.outputs\.(\w+)\s*\}\}')
SECRET_PATTERN = re.compile(r'\$\{\{\s*secrets\.(\w+)\s*\}\}')
VARS_PATTERN = re.compile(r'\$\{\{\s*vars\.(\w+)\s*\}\}')
GITHUB_CONTEXT_PATTERN = re.compile(r'\$\{\{\s*github\.(\w+)\s*\}\}')
INPUTS_PATTERN = re.compile(r'\$\{\{\s*inputs\.(\w+)\s*\}\}')

# Workflow files that should have dependency diagrams generated
DEPENDENCY_DIAGRAM_WORKFLOWS = [
    'continuous-deployment.yml',
    'sub-deploy-code-slot.yml'
]

# Mermaid diagram constants
MERMAID_FLOWCHART = "flowchart LR\n"
MERMAID_INDENT = "    "
MERMAID_DOUBLE_INDENT = "        "

# CSS styling definitions for mermaid diagrams
CSS_STYLES = {
    'reusable': 'fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000',
    'mainWorkflow': 'fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000',
    'trigger': 'fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000',
    'job': 'fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000',
    'external': 'fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000',
    'jobSubgraph': 'fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000000',
    'mainWorkflowSubgraph': 'fill:#f3e5f5,fill-opacity:0.15,stroke:#f3e5f5,stroke-width:1px,color:#ffffff'
}

def get_css_definitions() -> str:
    """Generate CSS class definitions for mermaid diagrams"""
    return ("\n" +
            f"{MERMAID_INDENT}classDef reusable {CSS_STYLES['reusable']}\n" +
            f"{MERMAID_INDENT}classDef mainWorkflow {CSS_STYLES['mainWorkflow']}\n" +
            f"{MERMAID_INDENT}classDef trigger {CSS_STYLES['trigger']}\n" +
            f"{MERMAID_INDENT}classDef job {CSS_STYLES['job']}\n\n")

def get_dependency_css_definitions() -> str:
    """Generate CSS class definitions specifically for dependency diagrams"""
    return (f"{MERMAID_INDENT}classDef external {CSS_STYLES['external']}\n" +
            f"{MERMAID_INDENT}classDef job {CSS_STYLES['job']}\n" +
            f"{MERMAID_INDENT}classDef mainWorkflow {CSS_STYLES['mainWorkflowSubgraph']}\n" +
            f"{MERMAID_INDENT}classDef jobSubgraph {CSS_STYLES['jobSubgraph']}\n")

def get_overview_css_definitions() -> str:
    """Generate CSS class definitions for overview diagrams"""
    return ("\n" +
            f"{MERMAID_INDENT}classDef mainWorkflow {CSS_STYLES['mainWorkflow']}\n" +
            f"{MERMAID_INDENT}classDef trigger {CSS_STYLES['trigger']}\n\n")

# -----------------------------
# Functional Parsing Utilities
# -----------------------------

def parse_workflow_file(workflows_dir: str, filename: str) -> Dict:
    """Parse a single GitHub Actions workflow file and extract metadata"""
    file_path = os.path.join(workflows_dir, filename)
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    workflow_data = yaml.safe_load(content) or {}
    # The YAML parser interprets the "on" key as a boolean True
    on_section = workflow_data.get(True)
    is_reusable = (
        on_section is not None and isinstance(on_section, dict) and on_section.get('workflow_call') is not None
    )
    # Extract triggers from on_section
    if not on_section:
        triggers = []
    elif isinstance(on_section, str):
        triggers = [on_section]
    elif isinstance(on_section, list):
        triggers = list(on_section)
    elif isinstance(on_section, dict):
        triggers = [k for k in on_section.keys() if k in TRIGGER_KEYS]
    else:
        triggers = []
    jobs: Dict[str, Dict] = {}
    for job_id, job in (workflow_data.get('jobs') or {}).items():
        # Normalize 'needs' field to always be a list
        needs = job.get('needs')
        if not needs:
            normalized_needs = []
        elif isinstance(needs, str):
            normalized_needs = [needs]
        else:
            normalized_needs = needs if isinstance(needs, list) else []

        jobs[job_id] = {
            'name': job.get('name'),
            'uses': job.get('uses'),
            'needs': normalized_needs,
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


def load_workflows(workflows_dir: str) -> Dict[str, Dict]:
    """Load and parse all workflow files from the specified directory"""
    workflows: Dict[str, Dict] = {}
    try:
        workflow_files = [f for f in os.listdir(workflows_dir) if f.endswith(WORKFLOW_FILE_EXTENSIONS)]
    except OSError:
        workflow_files = []

    for filename in workflow_files:
        try:
            workflows[filename] = parse_workflow_file(workflows_dir, filename)
        except Exception as error:  # parity with original behavior
            print(f"Error parsing {filename}: {error}", file=sys.stderr)
    return workflows


# ----------------------------------
# Diagram Helpers
# ----------------------------------

def process_job_for_diagram(job_id: str, job: Dict, workflow_id: str, nodes: List[str], edges: List[str], reusable_workflows: Dict[str, Dict], workflows: Dict[str, Dict], processed_workflows: Set[str]):
    """Process a single job for diagram generation, handling both regular jobs and reusable workflow calls"""
    job_node_id = f"{workflow_id}_{sanitize_id(job_id)}"
    job_label = job.get('name') or job_id
    nodes.append(f"{MERMAID_INDENT}{job_node_id}[\"{job_label}\"]")
    edges.append(f"{MERMAID_INDENT}{workflow_id} --> {job_node_id}")

    # Handle reusable workflow calls
    if job.get('uses'):
        called_workflow_file = find_workflow_by_uses(job['uses'])
        if called_workflow_file and called_workflow_file in workflows:
            called_workflow = workflows[called_workflow_file]
            called_workflow_id = sanitize_id(called_workflow_file)
            if called_workflow_id not in reusable_workflows:
                workflow_label = (called_workflow_file if called_workflow['isReusable'] else called_workflow['name'])
                nodes.append(f"{MERMAID_INDENT}{called_workflow_id}[\"{workflow_label}\"]")
                reusable_workflows[called_workflow_id] = called_workflow
                add_reusable_workflow_jobs(called_workflow_file, called_workflow, called_workflow_id, nodes, edges, processed_workflows, reusable_workflows, workflows)
            edges.append(f"{MERMAID_INDENT}{job_node_id} --> {called_workflow_id}")

def sanitize_id(string: str) -> str:
    """Convert a string to a valid mermaid diagram identifier"""
    return re.sub(r'_{2,}', '_', re.sub(r'[^a-zA-Z0-9_]', '_', string))


def find_workflow_by_uses(uses_path: str) -> Optional[str]:
    if match := re.search(GITHUB_WORKFLOWS_PATTERN, uses_path):
        return match[1]
    return None


def is_workflow_node(node_id: str) -> bool:
    if re.match(r'^\w+_yml$', node_id):
        return True
    return WORKFLOW_NODE_PATTERN in node_id and node_id.endswith(WORKFLOW_NODE_PATTERN)


def get_workflow_type_from_node_id(node_id: str, workflows: Dict[str, Dict]) -> str:
    filename = ''
    if re.match(r'^\w+_yml$', node_id):
        filename = re.sub(r'_yml$', YML_EXTENSION, node_id).replace('_', '-')
    elif WORKFLOW_NODE_PATTERN in node_id and node_id.endswith(WORKFLOW_NODE_PATTERN):
        filename = re.sub(r'_yml$', YML_EXTENSION, node_id).replace('_', '-')
    if workflow := workflows.get(filename):
        return 'reusable' if workflow['isReusable'] else 'main'
    return 'unknown'


def generate_styling(nodes: List[str], workflows: Dict[str, Dict]) -> str:
    styling = get_css_definitions()
    for node in nodes:
        if regular_match := re.search(NODE_ID_PATTERN, node):
            node_id = regular_match[1]
            if node_id.startswith('trigger_'):
                styling += f"{MERMAID_INDENT}class {node_id} trigger\n"
            elif is_workflow_node(node_id):
                wtype = get_workflow_type_from_node_id(node_id, workflows)
                if wtype == 'reusable':
                    styling += f"{MERMAID_INDENT}class {node_id} reusable\n"
                elif wtype == 'main':
                    styling += f"{MERMAID_INDENT}class {node_id} mainWorkflow\n"
            else:
                styling += f"{MERMAID_INDENT}class {node_id} job\n"
    return styling


def add_reusable_workflow_jobs(filename: str, workflow: Dict, workflow_id: str, nodes: List[str], edges: List[str], processed_workflows: Set[str], reusable_workflows: Dict[str, Dict], workflows: Dict[str, Dict]):
    """Add jobs from a reusable workflow to the diagram"""
    for job_id, job in workflow['jobs'].items():
        process_job_for_diagram(job_id, job, workflow_id, nodes, edges, reusable_workflows, workflows, processed_workflows)


def add_workflow_dependencies(filename: str, workflow: Dict, nodes: List[str], edges: List[str], processed_workflows: Set[str], reusable_workflows: Dict[str, Dict], workflows: Dict[str, Dict]):
    """Add a workflow and its dependencies to the diagram"""
    workflow_id = sanitize_id(filename)
    if workflow_id in processed_workflows:
        return
    processed_workflows.add(workflow_id)
    for job_id, job in workflow['jobs'].items():
        process_job_for_diagram(job_id, job, workflow_id, nodes, edges, reusable_workflows, workflows, processed_workflows)


def get_all_triggers(workflows: Dict[str, Dict]) -> List[str]:
    triggers: Set[str] = set()
    for workflow in workflows.values():
        if not workflow['isReusable']:
            triggers.update(workflow['triggers'])
    return sorted(triggers)


def get_workflows_for_trigger(trigger_type: str, workflows: Dict[str, Dict]) -> List[Tuple[str, Dict]]:
    return [item for item in workflows.items() if not item[1]['isReusable'] and trigger_type in item[1]['triggers']]


def generate_workflow_dispatch_diagram(filename: str, workflow: Dict, workflows: Dict[str, Dict]) -> str:
    diagram = MERMAID_FLOWCHART
    nodes: List[str] = []
    edges: List[str] = []
    processed_workflows: Set[str] = set()
    reusable_workflows: Dict[str, Dict] = {}
    trigger_id = "trigger_workflow_dispatch"
    workflow_id = sanitize_id(filename)
    nodes.extend((f"{MERMAID_INDENT}{trigger_id}([\"workflow_dispatch\"])\n".rstrip(),
                  f"{MERMAID_INDENT}{workflow_id}[\"{workflow['name']}\"]"))
    edges.append(f"{MERMAID_INDENT}{trigger_id} --> {workflow_id}")
    add_workflow_dependencies(filename, workflow, nodes, edges, processed_workflows, reusable_workflows, workflows)
    diagram += "\n".join(nodes) + "\n\n" + "\n".join(edges) + "\n"
    diagram += generate_styling(nodes, workflows)
    return diagram


def generate_workflow_dispatch_diagrams(workflows: Dict[str, Dict]) -> Dict[str, Dict]:
    diagrams: Dict[str, Dict] = {
        filename: {
            'workflow': workflow,
            'diagram': generate_workflow_dispatch_diagram(filename, workflow, workflows),
        }
        for filename, workflow in workflows.items()
        if 'workflow_dispatch' in workflow['triggers'] and not workflow['isReusable']
    }
    return diagrams


def generate_trigger_diagram(trigger_type: str, workflows: Dict[str, Dict]) -> str:
    triggered_workflows = get_workflows_for_trigger(trigger_type, workflows)
    if not triggered_workflows:
        return ''
    diagram = MERMAID_FLOWCHART
    nodes: List[str] = []
    edges: List[str] = []
    processed_workflows: Set[str] = set()
    reusable_workflows: Dict[str, Dict] = {}
    trigger_id = f"trigger_{sanitize_id(trigger_type)}"
    nodes.append(f"{MERMAID_INDENT}{trigger_id}([\"{trigger_type}\"])\n".rstrip())
    for filename, workflow in triggered_workflows:
        workflow_id = sanitize_id(filename)
        nodes.append(f"{MERMAID_INDENT}{workflow_id}[\"{workflow['name']}\"]")
        edges.append(f"{MERMAID_INDENT}{trigger_id} --> {workflow_id}")
        add_workflow_dependencies(filename, workflow, nodes, edges, processed_workflows, reusable_workflows, workflows)
    diagram += "\n".join(nodes) + "\n\n" + "\n".join(edges) + "\n"
    diagram += generate_styling(nodes, workflows)
    return diagram


def generate_all_trigger_diagrams(workflows: Dict[str, Dict]) -> Dict[str, str]:
    diagrams: Dict[str, str] = {}
    for trigger in get_all_triggers(workflows):
        if diagram := generate_trigger_diagram(trigger, workflows):
            diagrams[trigger] = diagram
    return diagrams


def generate_overview_diagram(workflows: Dict[str, Dict]) -> str:
    diagram = MERMAID_FLOWCHART
    nodes: List[str] = []
    edges: List[str] = []
    trigger_groups: Dict[str, List[Tuple[str, Dict]]] = {}
    for filename, workflow in workflows.items():
        if not workflow['isReusable']:
            for trigger in workflow['triggers']:
                trigger_groups.setdefault(trigger, []).append((filename, workflow))
    for trigger, group in trigger_groups.items():
        trigger_id = f"trigger_{sanitize_id(trigger)}"
        nodes.append(f"{MERMAID_INDENT}{trigger_id}([\"{trigger}\"])\n".rstrip())
        for filename, workflow in group:
            workflow_id = sanitize_id(filename)
            nodes.append(f"{MERMAID_INDENT}{workflow_id}[\"{workflow['name']}\"]")
            edges.append(f"{MERMAID_INDENT}{trigger_id} --> {workflow_id}")
    diagram += "\n".join(nodes) + "\n\n" + "\n".join(edges) + "\n"
    diagram += get_overview_css_definitions()
    for trigger in trigger_groups:
        diagram += f"{MERMAID_INDENT}class trigger_{sanitize_id(trigger)} trigger\n"
    for filename, workflow in workflows.items():
        if not workflow['isReusable']:
            diagram += f"{MERMAID_INDENT}class {sanitize_id(filename)} mainWorkflow\n"
    return diagram


# ----------------------------------
# Workflow Analysis and Processing
# ----------------------------------


def traverse_string_values(node: Any) -> Iterable[str]:
    """Traverse nested dict/list structures yielding each string (scalar) value once."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for val in node.values():
            yield from traverse_string_values(val)
    elif isinstance(node, list):
        for item in node:
            yield from traverse_string_values(item)


def extract_inputs_from_needed_job(job: Dict, needed_job: str) -> List[str]:
    """Return list of output variable names referenced from a needed job.

    Traverses the YAML-derived job structure (dict/list/scalars) and applies
    a regex only to string leaves, rather than serializing the entire job.
    This reduces false positives and avoids depending on JSON formatting.
    """
    pattern = re.compile(rf'\$\{{\{{\s*needs\.{needed_job}\.outputs\.(\w+)\s*\}}\}}')
    found: Set[str] = set()
    for value in traverse_string_values(job):
        for match in pattern.findall(value):
            found.add(match)
    return sorted(found)


def analyze_dependencies(workflow: Dict) -> Dict:
    """Analyze job dependencies within a workflow (YAML-structure aware).

    Strategy:
      * Explicit deps: from 'needs' list
      * Inputs from explicit deps: regex search only across string leaves
      * Implicit deps: references to needs.<job>.outputs.X for jobs not in explicit needs
      * External refs: secrets.*, vars.*, github.*, inputs.* gathered per job
    """
    explicit_deps: Dict[str, List[Dict]] = {}
    implicit_deps: Dict[str, List[Dict]] = {}
    external_deps: Dict[str, List[Dict]] = {}
    external_inputs: Dict[str, Set[str]] = {}
    for job_id, job in workflow['jobs'].items():
        needs_list = job.get('needs') or []
        if needs_list:
            explicit_deps[job_id] = [
                {'job': needed_job, 'inputs': extract_inputs_from_needed_job(job, needed_job)}
                for needed_job in needs_list
            ]
        # Collect matches from each string leaf
        seen_implicit: Set[Tuple[str, str]] = set()
        job_external: List[Dict] = []
        for value in traverse_string_values(job):
            for source_job, output_var in JOB_OUTPUT_PATTERN.findall(value):
                if source_job not in needs_list:
                    seen_implicit.add((source_job, output_var))
            for pattern, category in [
                (SECRET_PATTERN, 'Secrets'),
                (VARS_PATTERN, 'Variables'),
                (GITHUB_CONTEXT_PATTERN, 'GitHub Context'),
                (INPUTS_PATTERN, 'Workflow Inputs'),
            ]:
                for name in pattern.findall(value):
                    job_external.append({'category': category, 'variable': name})
                    external_inputs.setdefault(category, set()).add(name)
        if seen_implicit:
            implicit_deps[job_id] = [
                {'sourceJob': sj, 'variable': var, 'type': 'job_output'}
                for sj, var in sorted(seen_implicit)
            ]
        if job_external:
            # De-duplicate while preserving first-seen order
            dedup: List[Dict] = []
            seen_pairs: Set[Tuple[str, str]] = set()
            for entry in job_external:
                key = (entry['category'], entry['variable'])
                if key not in seen_pairs:
                    seen_pairs.add(key)
                    dedup.append(entry)
            external_deps[job_id] = dedup
    return {
        'explicitDeps': explicit_deps,
        'implicitDeps': implicit_deps,
        'externalDeps': external_deps,
        'externalInputs': external_inputs,
    }


def _render_external_inputs_block(external_inputs: Dict[str, Set[str]]) -> Tuple[str, List[str]]:
    """Render the External Inputs subgraph and return its text plus the edges created.

    Preserves existing ordering (iteration order of dict & sets as previously used).
    """
    if not external_inputs:
        return '', []
    block = f'{MERMAID_INDENT}subgraph "External Inputs"\n'
    edges: List[str] = []
    for category, variables in external_inputs.items():
        category_id = sanitize_id(category)
        block += f'{MERMAID_DOUBLE_INDENT}{category_id}["{category}"]\n'
        for var_name in variables:
            var_id = sanitize_id(f"{category_id}_{var_name}")
            block += f'{MERMAID_DOUBLE_INDENT}{var_id}["{var_name}"]\n'
            edges.append(f'{MERMAID_DOUBLE_INDENT}{category_id} --> {var_id}')
    block += f'{MERMAID_INDENT}end\n\n'
    return block, edges


def _compute_job_variables(dependencies: Dict) -> Dict[str, Set[str]]:
    """Compute variables used by each job from explicit and external dependencies (same logic as inline)."""
    job_variables: Dict[str, Set[str]] = {}
    for job_id, explicit in dependencies['explicitDeps'].items():
        bucket = job_variables.setdefault(job_id, set())
        for dep in explicit:
            for inp in dep['inputs']:
                bucket.add(inp)
    for job_id, external in dependencies['externalDeps'].items():
        bucket = job_variables.setdefault(job_id, set())
        for dep in external:
            bucket.add(dep['variable'])
    return job_variables


def _render_workflow_jobs_subgraph(workflow_id: str, title: str, workflow: Dict, job_variables: Dict[str, Set[str]]) -> str:
    """Render the main workflow subgraph including nested job subgraphs for jobs with variables."""
    block = f'{MERMAID_INDENT}subgraph {workflow_id}["{title}"]\n'
    for job_id, job_info in workflow['jobs'].items():
        job_node_id = sanitize_id(job_id)
        job_label = job_info.get('name') or job_id
        if used_vars := job_variables.get(job_id, set()):
            block += f'{MERMAID_DOUBLE_INDENT}subgraph {job_node_id}_subgraph["{job_label}"]\n'
            vars_node_id = sanitize_id(f"{job_id}_vars")
            vars_label = '<br/>'.join(sorted(used_vars))
            block += f'{MERMAID_INDENT}{MERMAID_DOUBLE_INDENT}{vars_node_id}["{vars_label}"]\n'
            block += f'{MERMAID_DOUBLE_INDENT}end\n'
        else:
            block += f'{MERMAID_DOUBLE_INDENT}{job_node_id}["{job_label}"]\n'
    block += f'{MERMAID_INDENT}end\n\n'
    return block


def _build_explicit_edges(explicit_deps: Dict[str, List[Dict]], job_variables: Dict[str, Set[str]]) -> List[str]:
    edges: List[str] = []
    for job_id, explicit in explicit_deps.items():
        job_node_id = sanitize_id(job_id)
        target_id = f"{job_node_id}_subgraph" if job_variables.get(job_id) else job_node_id
        for dep in explicit:
            needed_job_id = sanitize_id(dep['job'])
            source_id = f"{needed_job_id}_subgraph" if job_variables.get(dep['job']) else needed_job_id
            edges.append(f'{MERMAID_INDENT}{source_id} ==>|"needs"| {target_id}')
    return edges


def _build_implicit_edges(implicit_deps: Dict[str, List[Dict]], job_variables: Dict[str, Set[str]]) -> List[str]:
    edges: List[str] = []
    for job_id, implicit in implicit_deps.items():
        job_node_id = sanitize_id(job_id)
        target_id = f"{job_node_id}_subgraph" if job_variables.get(job_id) else job_node_id
        for dep in implicit:
            source_job_id = sanitize_id(dep['sourceJob'])
            source_id = f"{source_job_id}_subgraph" if job_variables.get(dep['sourceJob']) else source_job_id
            edges.append(f'{MERMAID_INDENT}{source_id} -.->|"{dep["variable"]}"| {target_id}')
    return edges


def _build_external_edges(external_deps: Dict[str, List[Dict]], job_variables: Dict[str, Set[str]]) -> List[str]:
    edges: List[str] = []
    for job_id, external in external_deps.items():
        job_node_id = sanitize_id(job_id)
        target_id = f"{job_node_id}_subgraph" if job_variables.get(job_id) else job_node_id
        for dep in external:
            category_id = sanitize_id(dep['category'])
            var_id = sanitize_id(f"{category_id}_{dep['variable']}")
            edges.append(f'{MERMAID_INDENT}{var_id} -.-> {target_id}')
    return edges


def _build_css_classes(workflow_id: str, workflow: Dict, job_variables: Dict[str, Set[str]], external_inputs: Dict[str, Set[str]]) -> str:
    css = get_dependency_css_definitions()
    css += f"{MERMAID_INDENT}class {workflow_id} mainWorkflow\n"
    for category in external_inputs:
        css += f"{MERMAID_INDENT}class {sanitize_id(category)} external\n"
    for job_id in workflow['jobs'].keys():
        job_node_id = sanitize_id(job_id)
        if job_variables.get(job_id):
            css += f"{MERMAID_INDENT}class {job_node_id}_subgraph jobSubgraph\n"
        else:
            css += f"{MERMAID_INDENT}class {job_node_id} job\n"
    return css

def build_dependency_diagram(workflow_filename: str, title: str, workflow: Dict, dependencies: Dict) -> str:
    """Build a mermaid diagram showing job dependencies within a workflow"""
    if not workflow:
        return ''
    diagram = MERMAID_FLOWCHART
    workflow_id = sanitize_id(workflow_filename.replace(YML_EXTENSION, '_workflow'))
    # External inputs block
    external_block, external_edges = _render_external_inputs_block(dependencies['externalInputs'])
    diagram += external_block
    # Job variables
    job_variables = _compute_job_variables(dependencies)
    # Workflow jobs subgraph
    diagram += _render_workflow_jobs_subgraph(workflow_id, title, workflow, job_variables)
    # Edge construction
    edges: List[str] = []
    edges.extend(external_edges)
    edges.extend(_build_explicit_edges(dependencies['explicitDeps'], job_variables))
    edges.extend(_build_implicit_edges(dependencies['implicitDeps'], job_variables))
    edges.extend(_build_external_edges(dependencies['externalDeps'], job_variables))
    if edges:
        # Preserve prior behavior: edges sorted, then blank line
        diagram += "\n".join(sorted(edges)) + "\n\n"
    # CSS / class assignments
    diagram += _build_css_classes(workflow_id, workflow, job_variables, dependencies['externalInputs'])
    return diagram


def generate_dependency_diagram(workflow_filename: str, workflows: Dict[str, Dict], title_override: Optional[str] = None) -> str:
    workflow = workflows.get(workflow_filename)
    if not workflow:
        return ''
    deps = analyze_dependencies(workflow)
    title = title_override or workflow.get('name') or workflow_filename
    return build_dependency_diagram(workflow_filename, title, workflow, deps)


# ----------------------------------
# Summary / Details
# ----------------------------------

def generate_summary(workflows: Dict[str, Dict]) -> str:
    total = len(workflows)
    reusable = len([w for w in workflows.values() if w['isReusable']])
    main_workflows = total - reusable
    summary = ("# GitHub Actions Workflow Analysis\n\n"
               "## Summary\n"
               f"- **Total Workflows**: {total}\n"
               f"- **Main Workflows**: {main_workflows}\n"
               f"- **Reusable Workflows**: {reusable}\n\n")
    summary += "## Legend\n\n"
    summary += "The diagrams use color coding to distinguish different types of workflow components:\n\n"
    summary += "**Triggers** - Event triggers that start workflows:\n"
    summary += "```mermaid\nflowchart LR\n    trigger_example([\"trigger (push, schedule, etc.)\"])\n    classDef trigger fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000\n    class trigger_example trigger\n```\n\n"
    summary += "**Main Workflows** - Primary workflow files that can be triggered directly:\n"
    summary += "```mermaid\nflowchart LR\n    main_workflow_example[\"Main Workflow\"]\n    classDef mainWorkflow fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000\n    class main_workflow_example mainWorkflow\n```\n\n"
    summary += "**Reusable Workflows** - Workflow files that are called by other workflows:\n"
    summary += "```mermaid\nflowchart LR\n    reusable_workflow_example[\"Reusable Workflow\"]\n    classDef reusable fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000\n    class reusable_workflow_example reusable\n```\n\n"
    summary += "**Jobs** - Individual jobs within workflows showing internal dependencies:\n"
    summary += "```mermaid\nflowchart LR\n    job_example[\"job-name\"]\n    classDef job fill:#f1f8e9,stroke:#33691e,stroke-width:1px,color:#000000\n    class job_example job\n```\n\n"
    return summary


def generate_workflow_details(workflows: Dict[str, Dict]) -> str:
    details = "## Workflow Details\n\n"
    main_workflows_list = [(fn, wf) for fn, wf in workflows.items() if not wf['isReusable']]
    reusable_workflows_list = [(fn, wf) for fn, wf in workflows.items() if wf['isReusable']]
    if main_workflows_list:
        details += "### Main Workflows\n"
        for filename, workflow in main_workflows_list:
            details += f"- **{workflow['name']}** (`{filename}`)\n"
            if workflow['triggers']:
                details += f"  - Triggers: {', '.join(workflow['triggers'])}\n"
            details += f"  - Jobs: {len(workflow['jobs'])}\n"
        details += "\n"
    if reusable_workflows_list:
        details += "### Reusable Workflows\n"
        for filename, workflow in reusable_workflows_list:
            details += f"- **{workflow['name']}** (`{filename}`)\n"
            details += f"  - Jobs: {len(workflow['jobs'])}\n"
        details += "\n"
    return details

# ----------------------------------
# Main Execution
# ----------------------------------

def generate_dependency_diagrams_for_workflows(workflows: Dict[str, Dict], workflow_files: List[str]) -> str:
    """Generate dependency diagrams for specified workflow files"""
    output = ""
    for workflow_file in workflow_files:
        if not (workflow := workflows.get(workflow_file)):
            continue
        title = workflow.get('name', workflow_file.replace(YML_EXTENSION, '').replace('-', ' ').title())
        if dep_diagram := generate_dependency_diagram(workflow_file, workflows, title):
            output += f"##### {title} - Job Dependencies\n\n"
            output += f"This diagram shows the explicit and implicit dependencies between jobs in the {title.lower()} workflow:\n\n"
            output += "```mermaid\n" + dep_diagram + "```\n\n"

    return output


def generate_related_dependency_diagrams(workflows: Dict[str, Dict], main_workflow_file: str) -> str:
    """Generate dependency diagrams for workflows related to the main workflow"""
    output = ""
    main_workflow = workflows.get(main_workflow_file)
    if not main_workflow:
        return output

    # Find reusable workflows called by this main workflow that are in our dependency list
    related_workflows = []
    for job_id, job in main_workflow['jobs'].items():
        if (job.get('uses') and
            (called_workflow_file := find_workflow_by_uses(job['uses'])) and
            called_workflow_file in workflows and
            called_workflow_file in DEPENDENCY_DIAGRAM_WORKFLOWS and
            called_workflow_file != main_workflow_file and
            called_workflow_file not in related_workflows):
            related_workflows.append(called_workflow_file)

    # Generate dependency diagrams for related workflows
    if related_workflows:
        output += generate_dependency_diagrams_for_workflows(workflows, related_workflows)

    return output


def add_dependency_diagrams_if_configured(workflows: Dict[str, Dict], filename: str) -> str:
    """Generate dependency diagrams for a workflow file if it's configured for dependency diagram generation"""
    if filename in DEPENDENCY_DIAGRAM_WORKFLOWS:
        output = generate_dependency_diagrams_for_workflows(workflows, [filename])
        output += generate_related_dependency_diagrams(workflows, filename)
        return output
    return ""


def compute_default_paths() -> Tuple[str, str]:
    try:
        import subprocess
        result = subprocess.run(
            ['git', 'rev-parse', '--show-toplevel'],
            capture_output=True,
            text=True,
            check=True
        )
    except Exception as exc:
        print(f"Failed to determine repository root via git: {exc}", file=sys.stderr)
        sys.exit(1)
    repo_root = result.stdout.strip()
    if not repo_root:
        print("git rev-parse returned empty repository root", file=sys.stderr)
        sys.exit(1)
    workflows_dir = os.path.join(repo_root, '.github', 'workflows')
    output_file = os.path.join(repo_root, 'docs', 'operations', 'workflow-diagram.md')
    return workflows_dir, output_file


def build_trigger_sections(workflows: Dict[str, Dict], trigger_diagrams: Dict[str, str], workflow_dispatch_diagrams: Dict[str, Dict]) -> Tuple[str, List[str]]:
    section_output = ""
    sorted_triggers = sorted(trigger_diagrams.keys())
    if not sorted_triggers:
        return section_output, []
    section_output += "## Workflow Flow Diagrams by Trigger\n\n"
    for trig in sorted_triggers:
        if trig == 'workflow_dispatch':
            section_output += f"### {trig.capitalize()} Triggered Workflows\n\n"
            section_output += f"The `{trig}` trigger allows manual execution of workflows. Each workflow is shown individually below:\n\n"
            for filename, data in sorted(workflow_dispatch_diagrams.items(), key=lambda x: x[0]):
                wf = data['workflow']
                section_output += f"#### {wf['name']}\n\n"
                section_output += f"Manual execution of `{filename}`\n\n"
                section_output += "```mermaid\n" + data['diagram'] + "```\n\n"
                section_output += add_dependency_diagrams_if_configured(workflows, filename)
        else:
            trig_diagram = trigger_diagrams[trig]
            trig_wfs = get_workflows_for_trigger(trig, workflows)
            section_output += f"### {trig.capitalize()} Triggered Workflows\n\n"
            section_output += f"Workflows triggered by `{trig}`:\n"
            section_output += ''.join(f"- **{wf['name']}** (`{fname}`)\n" for fname, wf in trig_wfs)
            section_output += "\n```mermaid\n" + trig_diagram + "```\n\n"
            for fname, _ in trig_wfs:
                section_output += add_dependency_diagrams_if_configured(workflows, fname)
    return section_output, sorted_triggers


def compile_output(summary: str, workflows: Dict[str, Dict], trigger_diagrams: Dict[str, str], workflow_dispatch_diagrams: Dict[str, Dict]) -> Tuple[str, List[str]]:
    trigger_section, trig_list = build_trigger_sections(workflows, trigger_diagrams, workflow_dispatch_diagrams)
    out = summary + "\n" + trigger_section
    out += "## Overview: All Triggers and Main Workflows\n\n"
    out += "```mermaid\n" + generate_overview_diagram(workflows) + "```\n\n"
    out += generate_workflow_details(workflows)
    return out, trig_list


def main():
    workflows_dir, output_file = compute_default_paths()
    if not os.path.exists(workflows_dir):
        print(f"Workflows directory not found: {workflows_dir}", file=sys.stderr)
        sys.exit(1)
    workflows = load_workflows(workflows_dir)
    summary = generate_summary(workflows)
    trigger_diagrams = generate_all_trigger_diagrams(workflows)
    workflow_dispatch_diagrams = generate_workflow_dispatch_diagrams(workflows)
    output_text, triggers = compile_output(summary, workflows, trigger_diagrams, workflow_dispatch_diagrams)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(output_text)
    print(f"Workflow diagrams generated: {output_file}")
    print("\nGenerated diagrams:")
    total_diagrams = 0
    for trig in triggers:
        count = len(get_workflows_for_trigger(trig, workflows))
        if trig == 'workflow_dispatch':
            print(f"  - {trig}: {count} individual workflow diagrams")
            total_diagrams += count
        else:
            wf_word = 'workflow' if count == 1 else 'workflows'
            print(f"  - {trig}: 1 combined diagram ({count} {wf_word})")
            total_diagrams += 1
    print("  - overview: 1 diagram")
    total_diagrams += 1
    print(f"\nTotal: {total_diagrams} diagrams generated\n")
    print(summary)


if __name__ == "__main__":
    main()
