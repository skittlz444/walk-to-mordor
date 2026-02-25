# Development Guidelines & Project Context

- **Repository**: https://github.com/skittlz444/walk-to-mordor

## Infrastructure & Architecture
The underlying infrastructure for this project is built on Cloudflare Workers, utilizing Wrangler for deployment and management.
- **Runtime**: Cloudflare Workers (Single Worker Monolith).
- **Database**: D1 (SQLite) - The source of truth.
- **Frontend Strategy**: "Islands Architecture".
  - **Legacy**: Vanilla JS in `public/js/`.
  - **New Components**: Preact in `client/src/` (e.g., Maps, new UI).
  - **State**: Preact Signals for new client logic.
- **Map**: Konva.js for interactive maps.
- **Assets**: Served via Assets Binding.

## Coding Standards
- **TypeScript**: Strict mode is enforced. No `any`. Define interfaces for all D1 results.
- **File Manipulation**: Prioritize `create_file`, `edit_file` and `replace_string_in_file`. **NEVER** use `run_in_terminal` for file manipulation.
- **Islands Rule**: Do not rewrite working legacy Vanilla JS without explicit permission. New features go to `client/`.

## Testing
Always ensure that your code changes are covered by appropriate tests.
- **Playwright**: Use `npm run test:ui`. Use `--run` flag to avoid interactive prompts.
- **Coverage**: Maintain >90% coverage for new code.
- **Visual Testing**: Use Snapshots for Konva/Canvas elements.
- **Docs**: Update `docs/`, `TESTING.md` when patterns change.

## Documentation
- Location: `docs/`.
- Size: Keep files < 500 lines. Break them up if larger.
- Update immediately after code changes.

## Tools & MCP Servers
You have access to:
- **GitHub MCP**: PRs and CI.
- **Cloudflare Documentation MCP**: APIs and services.
- **Playwright MCP**: Browser testing.


<!-- BMAD:START -->
# BMAD Method — Project Instructions

## Project Configuration

- **Project**: walk-to-mordor
- **User**: Hayden
- **Communication Language**: English
- **Document Output Language**: English
- **User Skill Level**: expert
- **Output Folder**: {project-root}/_bmad-output
- **Planning Artifacts**: {project-root}/_bmad-output/planning-artifacts
- **Implementation Artifacts**: {project-root}/_bmad-output/implementation-artifacts
- **Project Knowledge**: {project-root}/docs

## BMAD Runtime Structure

- **Agent definitions**: `_bmad/bmm/agents/` (BMM module) and `_bmad/core/agents/` (core)
- **Workflow definitions**: `_bmad/bmm/workflows/` (organized by phase)
- **Core tasks**: `_bmad/core/tasks/` (help, editorial review, indexing, sharding, adversarial review)
- **Core workflows**: `_bmad/core/workflows/` (brainstorming, party-mode, advanced-elicitation)
- **Workflow engine**: `_bmad/core/tasks/workflow.xml` (executes YAML-based workflows)
- **Module configuration**: `_bmad/bmm/config.yaml`
- **Core configuration**: `_bmad/core/config.yaml`
- **Agent manifest**: `_bmad/_config/agent-manifest.csv`
- **Workflow manifest**: `_bmad/_config/workflow-manifest.csv`
- **Help manifest**: `_bmad/_config/bmad-help.csv`
- **Agent memory**: `_bmad/_memory/`

## Key Conventions

- Always load `_bmad/bmm/config.yaml` before any agent activation or workflow execution
- Store all config fields as session variables: `{user_name}`, `{communication_language}`, `{output_folder}`, `{planning_artifacts}`, `{implementation_artifacts}`, `{project_knowledge}`
- MD-based workflows execute directly — load and follow the `.md` file
- YAML-based workflows require the workflow engine — load `workflow.xml` first, then pass the `.yaml` config
- Follow step-based workflow execution: load steps JIT, never multiple at once
- Save outputs after EACH step when using the workflow engine
- The `{project-root}` variable resolves to the workspace root at runtime

## Available Agents

| Agent | Persona | Title | Capabilities |
|---|---|---|---|
| bmad-master | BMad Master | BMad Master Executor, Knowledge Custodian, and Workflow Orchestrator | runtime resource management, workflow orchestration, task execution, knowledge custodian |
| analyst | Mary | Business Analyst | market research, competitive analysis, requirements elicitation, domain expertise |
| architect | Winston | Architect | distributed systems, cloud infrastructure, API design, scalable patterns |
| dev | Amelia | Developer Agent | story execution, test-driven development, code implementation |
| pm | John | Product Manager | PRD creation, requirements discovery, stakeholder alignment, user interviews |
| qa | Quinn | QA Engineer | test automation, API testing, E2E testing, coverage analysis |
| quick-flow-solo-dev | Barry | Quick Flow Solo Dev | rapid spec creation, lean implementation, minimum ceremony |
| sm | Bob | Scrum Master | sprint planning, story preparation, agile ceremonies, backlog management |
| tech-writer | Paige | Technical Writer | documentation, Mermaid diagrams, standards compliance, concept explanation |
| ux-designer | Sally | UX Designer | user research, interaction design, UI patterns, experience strategy |

## Slash Commands

Type `/bmad-` in Copilot Chat to see all available BMAD workflows and agent activators. Agents are also available in the agents dropdown.
<!-- BMAD:END -->
