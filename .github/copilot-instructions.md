## Test Instructions

When writing or updating tests in the `tests/` directory, please follow these guidelines:
- Preference is to use `npm run test:ui` for playwright browser testing, not npx commands directly, if subsets of the tests are desired to be run, then use `--run` flag or similar to avoid interactive prompts and line reporter to avoid waiting on a html report at completion.
- update the testing documentation in the README.md, TESTING.md, and TEST_ORGANIZATION.md as needed to reflect any new testing patterns or practices.