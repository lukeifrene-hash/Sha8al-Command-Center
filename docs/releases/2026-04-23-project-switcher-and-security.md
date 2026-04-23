# Release Notes: 2026-04-23 (Security & Project Switcher Updates)

## Headline Summary

This update focuses on securing the build environment and improving the user experience for managing projects without manual configuration beforehand. Notable dependency adjustments were made to address vulnerabilities and strict peer dependencies. On the frontend UI, a new "Project Menu" was embedded directly into the status bar, allowing users to switch tracked projects or import roadmaps live rather than depending strictly on initial environmental configuration.

## Setup & UI Features

- **Project Swapping UI**: A new "Project Menu" has been introduced in the `StatusBar`. It provides a dropdown with options to:
  - **Change Project Folder**: Allows users to dynamically browse and switch the monitored workspace root folder directly from the running app.
  - **Import Roadmap**: Allows users to browse and import an existing markdown file as their active roadmap.
- **Graceful Unconfigured Launch**: Fixed an issue causing an immediate app crash when booting without a pre-configured `COMMAND_CENTER_PROJECT_ROOT`. The application will now gracefully show the "Choose Project" onboarding screen upon load.

## Dependency & Security Changes

- Fixed high-severity ReDoS / arbitrary file read vulnerabilities by patching underlying packages like `picomatch` and `vite`.
- Dependency installation was stabilized against strict upstream peer dependency validations (specifically between `vite` and `@vitejs/plugin-react`). Running `npm install --legacy-peer-deps` is now utilized to safely accept functional legacy matching against newer Vite versions avoiding the ERESOLVE errors in newer npm environments.
- Completely cleaned up partial `pnpm` migration steps, restoring standard `npm` and standardizing the install instructions.

## Breaking Changes

- None

## Compatibility Changes

- Modified `src/main/git.ts` to dynamically resolve the required profile and project root locally rather than at module definition time. This decoupling allows the Electron processes to start safely before a workspace is bound.

## Rollback Notes

- Standard revert.