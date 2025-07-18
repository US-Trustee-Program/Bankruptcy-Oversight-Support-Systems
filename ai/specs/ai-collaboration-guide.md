# AI-Assisted Development Workflow

This document outlines the standardized workflow for developing features in this project with the assistance of AI agents. The goal is to create a symbiotic relationship between human developers and AI, ensuring high-quality, consistent, and efficient delivery.

This process is designed to be followed by both human developers and AI agents.

## Guiding Principles

This workflow is built upon the core development practices outlined in the [CAMS Development Guidelines](../guidelines.md). Key principles include:

*   **Test-Driven Development (TDD):** We write tests before we write implementation code.
*   **Behavior-Driven Development (BDD):** We use Gherkin to define requirements as executable specifications.
*   **Vertical Slices:** We build features incrementally in small, end-to-end slices.
*   **Option-Enabling Architecture:** Our design choices must adhere to the architectural principles defined in our guidelines, such as Screaming Architecture and the Dependency Rule.

## The Workflow

Each new feature should be developed within its own directory under `ai/specs/`. While this comprehensive workflow is ideal for new features, a streamlined version may be used for minor bug fixes at the developer's discretion.

### 1. Feature Definition (Human-AI Collaboration)

The process begins with a human developer defining the feature.

1.  **Create a Feature Directory:** Create a new directory under `ai/specs/<ticket-number>_<feature-name>`, where `<ticket-number>` is the issue tracking ticket number for traceability, and `<feature-name>` is a short, descriptive name for the feature. For example: `CAMS-123_short_decription`.

2.  **Write Gherkin Requirements:** Inside the new directory, create a `<feature-name>.feature` file. This file will contain the feature's requirements written in Gherkin syntax and is the single source of truth for the feature's functionality. The feature file must contain a comment header with the issue tracking number.

Alternatively, the AI agent can be prompted to collaborate in a question and answer manner to convert human-provided natural language into a properly formatted Gherkin syntax.

If the AI agent is asked to collaborate to write feature requirements, then the AI agent should:

1. Start a Q&A session to author a new feature requirements file.
2. Ask for the ticket number for the feature. This should be in the format `CAMS-####`. The digits can be three or four characters long.
3. Ask for a short feature name.
4. Ask questions about the feature requirements. Ask for clarification if necessary.
5. Write the feature document in the specified location using the Gherkin syntax. The entire Q&A session must be saved to a `<feature-name>.feature-qa.md` file.
6. Refine the document with more detailed questions to cover exceptions and other edge cases. Update the requirements document and append the follow-up Q&A to the `.feature-qa.md` file.
7. Stop when the document can be no further refined.

### 2. Design Approach Q&A (Human-AI Collaboration)

After the feature requirements are defined, the AI and human collaborate to discuss the design approach.

*   **Input:** The `<feature-name>.feature` file. The AI's knowledge of architecture comes from the project guidelines (`ai/guidelines.md`) and by inspecting the current organization of the repository's source files and directory structure. A RAG is not used.
*   **Task:** Engage in a Q&A session to reason about:
    *   Option-enabling architecture principles for this feature
    *   Separation of concerns
    *   Good fences between components
    *   Dependency rules and how they apply to this feature
    *   Architectural considerations specific to the feature requirements
*   **Process:** The AI should ask targeted questions about architectural decisions and provide reasoning about different approaches.
*   **Output:** A `<feature-name>.design-qa.md` file located in the feature's spec directory. This file contains the full transcript of the design discussion, capturing the key decisions and trade-offs considered.

### 3. Design Documentation (AI Task)

Next, the AI agent will document the technical design for the feature.

*   **Input:** The `<feature-name>.feature` file, the project guidelines defined in `ai/guidelines.md`, and the discussion transcript from `<feature-name>.design-qa.md`.
*   **Task:** Create a technical design document. This document must:
    *   Outline the proposed software design to implement the feature.
    *   Explicitly describe how the design adheres to the **Option-Enabling Architecture** principles (Screaming Architecture, Dependency Rule, etc.).
    *   Identify any new components, classes, or modules that need to be created.
    *   Detail how the new feature will integrate with existing code.
    *   Provide example code to clarify intent.
*   **Output:** A `<feature-name>.design.md` file located in the feature's spec directory (`ai/specs/<ticket-number>_<feature-name>/`).

### 4. Implementation Plan (AI Task)

With a design in place, the AI agent will create a step-by-step implementation plan.

*   **Input:** The `<feature-name>.design.md` file.
*   **Task:** Break down the implementation work into a series of **vertical slices**. Each slice should represent a small, concrete, and actionable development step that delivers a piece of end-to-end functionality. The plan should be ordered logically, starting with a happy-path slice, and contain checkboxes to track progress.
*   **Output:** An `<feature-name>.plan.md` file in the feature's spec directory.

### 5. Review and Refinement (Human Task)

This is a critical checkpoint. A human developer must review all the artifacts generated by the AI.

*   **Review `<feature-name>.design.md`:** Ensure the design is sound, efficient, and aligns with the project's architectural vision.
*   **Review `<feature-name>.plan.md`:** Check that the vertical slices are logical and appropriately sized.

The human developer should make any necessary corrections or refinements to these documents before proceeding.

### 6. BDD Test Generation (AI Task)

Before implementation begins, an AI agent will generate the initial test suite.

*   **Input:** The `<feature-name>.feature` file.
*   **Task:** Based on the Gherkin scenarios, generate BDD-oriented unit and integration tests. These tests should be written following the TDD practice of "test-first," meaning they are expected to fail initially. The tests must adhere to the project's [Testing Guidelines](../guidelines.md#testing-guidelines).
*   **Output:** New or modified test files in the appropriate test directories.

### 7. Implementation

This phase can be carried out by a human developer, an AI agent with human supervision, or a combination of both.

*   **Task:** Follow the `<feature-name>.plan.md`, working on one vertical slice at a time. Write the necessary application code to make the corresponding tests pass.
*   **Process:** Adhere to the TDD cycle: write a failing test (already done in step 6, but new ones can be added), write the minimum code to make it pass, and then refactor locally.
*   **Code Quality Standards:** Ensure all code adheres to the project's ESLint configuration and formatting requirements. Files should always end with a newline.
*   **Test Coverage Requirements:** Aim for the branch coverage targets specified in the `test-coverage-plan.md`.

### 8. Final Refactoring and Polish

After the implementation passes all tests and delivers the required functionality, this dedicated phase ensures the new code meets the project's highest quality standards. This is distinct from the small refactoring steps within the TDD cycle and serves as a final polish before the work is considered complete.

*   **Task:** Review the implemented code for opportunities to improve readability, maintainability, and performance without changing its external behavior.
*   **Architecture Alignment:** This is the final check to ensure the implementation strictly adheres to the Option-Enabling Architecture principles defined in the design artifacts and project guidelines.
*   **Performance and Security:** Review the implementation for potential performance bottlenecks or security vulnerabilities and address them.

---

## The Iterative Nature of Development

This workflow is not strictly linear. Discoveries made in later stages often require revisiting earlier ones. If a flaw in the design or an overlooked requirement is found during implementation (Step 7), the process is as follows:

1.  Pause implementation for the affected slice.
2.  Return to the appropriate earlier step (e.g., Step 2 to revisit the design discussion or Step 3 to directly edit the design document).
3.  Update the relevant artifacts (`.feature`, `.design.md`, `.plan.md`, etc.). This is crucial to ensure the documentation remains the source of truth.
4.  Regenerate or update any downstream artifacts (e.g., tests) if necessary.
5.  Resume implementation based on the revised artifacts.
