# Getting Started with E2E Testing

This guide will help you run E2E tests using the simplified Podman-based approach.

## Prerequisites

### Automated Installation (Recommended)

Run the automated installer that checks and installs all dependencies:

```bash
cd test/e2e
npm run podman:install
```

This script will:
- ✅ Check if Homebrew is installed (required)
- ✅ Check if Podman is installed, install if missing
- ✅ Check if Podman Compose is installed, install if missing
- ✅ Initialize and start Podman machine if needed
- ✅ Verify everything is working

### Manual Installation

If you prefer to install manually:

```bash
# Install Podman
brew install podman

# Install Podman Compose
brew install podman-compose

# Initialize Podman machine
podman machine init
podman machine start
```

### Environment Configuration

- The `.env` file in `test/e2e/` directory is already configured
- Contains database connections and authentication credentials

## Quick Start (Simplest Way)

### Option 1: Complete Orchestrated Workflow (Recommended)

```bash
cd test/e2e
npm run e2e
```

That's it! This single command orchestrates the complete workflow:

**Step 1: Startup** 🚀
- Builds all containers (backend, frontend)
- Starts services in background
- Waits for health checks to pass

**Step 2: Testing** 🧪
- Runs all Playwright E2E tests
- Captures results and traces

**Step 3: Reporting** 📊
- Shows test summary (passed/failed)
- Displays test artifact locations
- Shows service logs on failure

**Step 4: Teardown** 🧹
- Automatically stops all services
- Cleans up containers

### Option 2: Using npm scripts (Manual control)

```bash
cd test/e2e
npm run podman:test
```

This runs tests with manual cleanup control.

### Option 3: Using Helper Script

```bash
cd test/e2e
./scripts/run-e2e-workflow.sh  # Complete orchestrated workflow
./scripts/run-e2e-podman.sh test  # Manual control
```

### Option 4: Using Podman Compose Directly

```bash
cd test/e2e
podman-compose up --build --abort-on-container-exit
```

## Common Workflows

### Run complete workflow (Recommended)

```bash
npm run e2e
```

This is the simplest way - handles everything automatically.

### Run tests once (Manual control)

```bash
npm run podman:test
```

### Start services for manual testing

```bash
# Start services in background
npm run podman:services

# Access the application
open http://localhost:3000

# Run specific tests locally while services are running
npm run test -- consolidation-orders

# Stop services when done
npm run podman:down
```

### Debug test failures

```bash
# Start services and view logs
npm run podman:debug

# In another terminal, run tests with UI mode
npm run test

# View test report
npm run report
```

### View service logs

```bash
# All services
npm run podman:logs

# Specific service (in another terminal)
podman-compose logs -f backend
podman-compose logs -f frontend
```

### Check service status

```bash
npm run podman:status
```

### Clean up everything

```bash
npm run podman:clean
```

## Available npm Commands

Run `npm run --list` to see all available commands, or use these common ones:

**Recommended:**
```
npm run e2e               - 🌟 Complete orchestrated workflow (startup → test → report → teardown)
npm run podman:install    - Install Podman dependencies (first time only)
```

**Manual Control:**
```
npm run podman:test       - Run all E2E tests in Podman
npm run podman:services   - Start backend and frontend services only
npm run podman:debug      - Start services in foreground (with logs)
npm run podman:logs       - Show logs from all services
npm run podman:status     - Show status of all services
npm run podman:down       - Stop all services
npm run podman:clean      - Stop and remove all containers and volumes
npm run podman:rebuild    - Rebuild all containers from scratch
npm run report            - Open Playwright test report
```

## Understanding the Setup

### Architecture

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Podman Network: cams-e2e                       │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Backend    │  │  Frontend    │            │
│  │  (API:7071)  │◄─┤  (UI:3000)   │            │
│  └──────────────┘  └──────────────┘            │
│         ▲                  ▲                    │
│         │                  │                    │
│         └──────────────────┘                    │
│                  │                              │
│         ┌──────────────────┐                    │
│         │   Playwright     │                    │
│         │  (Test Runner)   │                    │
│         └──────────────────┘                    │
│                                                 │
└─────────────────────────────────────────────────┘
         │                    │
         │                    │
    Host Port            Host Port
      7071                 3000
```

### What Each Service Does

**Backend (backend)**
- Runs Azure Functions API
- Connects to real Cosmos DB and SQL Server (from .env)
- Exposed on localhost:7071
- Includes healthcheck endpoint

**Frontend (frontend)**
- Runs Vite preview server with built UI
- Connects to backend container
- Exposed on localhost:3000
- Serves production-like build

**Playwright (playwright)**
- Runs headless browsers (Chromium, Edge)
- Executes test suite
- Connects to frontend container
- Saves results to mounted volumes

### Test Results

After running tests, results are saved to:
- `test-results/` - Screenshots, videos, traces
- `playwright-report/` - HTML report

View the report:
```bash
npm run report
# or
npx playwright show-report
```

## Troubleshooting

### "Port already in use"

If ports 3000 or 7071 are taken:
1. Stop other services using those ports
2. Or modify `podman-compose.yml` to use different host ports

### "Service unhealthy"

Check service logs:
```bash
podman-compose logs backend
podman-compose logs frontend
```

Common causes:
- Database connection issues (check `.env` credentials)
- Build failures (check logs for errors)

### "Tests timing out"

The containers may need more time to start:
1. Check if services are healthy: `npm run podman:status`
2. View logs: `npm run podman:logs`
3. Try running services first: `npm run podman:services`, then run tests separately

### "Podman out of space"

Clean up old containers and images:
```bash
npm run podman:clean
podman system prune -a
```

### Need to rebuild from scratch

```bash
npm run podman:rebuild
```

## Comparison: Local vs Podman

### Local Development (Traditional)

```bash
# Terminal 1: Start backend
cd backend/function-apps/api
npm run start

# Terminal 2: Start frontend
cd user-interface
npm run start

# Terminal 3: Run tests
cd test/e2e
npm run headless
```

Requires:
- Node.js installed
- Azure Functions Core Tools installed
- 3 separate terminals
- Manual coordination

### Podman (New Approach)

```bash
cd test/e2e
npm run podman:test
```

Requires:
- Just Podman
- Single command
- Automatic coordination
- Consistent environment

## CI/CD Integration

The Podman setup is CI/CD ready. Example GitHub Actions:

```yaml
- name: Run E2E Tests
  run: |
    cd test/e2e
    npm run e2e  # Complete orchestrated workflow
```

Or for more control:

```yaml
- name: Run E2E Tests
  run: |
    cd test/e2e
    npm run podman:test
```

## Tips

1. **First time setup takes longer** - Podman needs to build images
2. **Subsequent runs are faster** - Podman caches layers
3. **Keep services running** - Use `npm run podman:services` to avoid rebuilding between test runs
4. **View traces** - Playwright saves detailed traces in `test-results/`
5. **Parallel testing** - Currently disabled (workers: 1) for stability

## Next Steps

- Run your first test: `npm run e2e`
- Explore test results: `npm run report`
- Start contributing: Write new tests in `playwright/` directory
- Manual testing: `npm run podman:services` then access http://localhost:3000

## Getting Help

- View this guide: `cat GETTING-STARTED.md`
- View Podman README: `cat README.docker.md`
- View available commands: `npm run --list`
- Check service status: `npm run podman:status`
- View logs: `npm run podman:logs`
