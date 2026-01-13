# Development Guidelines

## Infrastructure
The underlying infrastructure for this project is built on Cloudflare Workers, utilizing Wrangler for deployment and management. Ensure you are familiar with the following components:
- **Cloudflare Workers**: Serverless platform for deploying JavaScript code.
- **D1 Database**: Lightweight SQL database for storing application data.
- **Assets Binding**: For serving static files.

Both the api and site are deployed to a single Worker with route-based request handling.

## Tools
Prioritize `create_file`, `edit_file` and `replace_string_in_file`, NEVER use `run_in_terminal` for file manipulation.
You have access to a number of IDE tools when running in VS Code, including direct file editing, this means you **NEVER** have to use terminal commands to edit files. You also have access to sub-agents for context isolation in tasks that benefit from it, and to-do lists for task management.

## MCP Servers
You have access to a number of powerful MCP Servers for development and testing, including:
- GitHub MCP, for checking PRs and running CI.
- Cloudflare Documentation MCP, for gathering information on Cloudflare services.
- Playwright MCP, for running browser-based tests.
- Context7 MCP, for gathering up to date information on sdk api's and libraries.

## Testing
Always ensure that your code changes are covered by appropriate tests.
When adding new features or fixing bugs, write unit tests and integration tests as needed to verify functionality.
When modifying existing functionality, update or add tests to cover the changes.
When writing or updating tests in the `tests/` directory, please follow these guidelines:
- Preference is to use `npm run test:ui` for playwright browser testing, not npx commands directly, if subsets of the tests are desired to be run, then use `--run` flag or similar to avoid interactive prompts and line reporter to avoid waiting on a html report at completion.
- Update the testing documentation in the README.md, TESTING.md, and TEST_ORGANIZATION.md as needed to reflect any new testing patterns or practices.

## Documentation
All documentation (except for the main README.md) is stored in the `docs/` directory. When making changes to functionality, please ensure that the relevant documentation files are created or updated accordingly. 
Always check for existing documentation on a topic before begining work on the topic, but be aware that given documentaiton may be out of date or incomplete. Always check the codebase and tests to verify the current state of functionality, using existing documentation as a guide.
Always update the documentation to reflect the current state of the codebase after making changes.
Documentation files should be in markdown format, and aim to be less than 500 lines each. If a document exceeds this length, consider breaking it into smaller, more focused documents.