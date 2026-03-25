#!/bin/bash
set -e

# E2E Testing with Podman - Helper Script
# Usage: ./scripts/run-e2e-podman.sh [command]
#
# Commands:
#   test        - Run all E2E tests (default)
#   services    - Start backend and frontend services only
#   debug       - Start services and wait (for manual testing)
#   logs        - Show logs from all services
#   clean       - Stop and remove all containers
#   rebuild     - Rebuild all containers from scratch

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMMAND="${1:-test}"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found in test/e2e/"
    echo "Please create .env file with required configuration."
    exit 1
fi

case "$COMMAND" in
    test)
        echo "🚀 Running E2E tests in Podman..."
        echo ""
        podman-compose up --build --abort-on-container-exit
        EXIT_CODE=$?
        echo ""
        if [ $EXIT_CODE -eq 0 ]; then
            echo "✅ E2E tests passed!"
            echo "📊 View test report: npx playwright show-report"
        else
            echo "❌ E2E tests failed!"
            echo "📊 View test report: npx playwright show-report"
            echo "🔍 Check test-results/ for traces and screenshots"
        fi
        podman-compose down
        exit $EXIT_CODE
        ;;

    services)
        echo "🚀 Starting backend and frontend services..."
        podman-compose up --build -d backend frontend
        echo ""
        echo "✅ Services started!"
        echo "🌐 Frontend: http://localhost:3000"
        echo "🔧 Backend:  http://localhost:7071"
        echo ""
        echo "To view logs: podman-compose logs -f"
        echo "To stop:      podman-compose down"
        ;;

    debug)
        echo "🔍 Starting services in debug mode..."
        podman-compose up --build backend frontend
        ;;

    logs)
        echo "📋 Showing logs (press Ctrl+C to exit)..."
        podman-compose logs -f
        ;;

    clean)
        echo "🧹 Cleaning up Podman containers and volumes..."
        podman-compose down -v --rmi local
        rm -rf test-results/ playwright-report/
        echo "✅ Cleanup complete!"
        ;;

    rebuild)
        echo "🔨 Rebuilding all containers..."
        podman-compose build --no-cache
        echo "✅ Rebuild complete!"
        ;;

    *)
        echo "❌ Unknown command: $COMMAND"
        echo ""
        echo "Usage: ./scripts/run-e2e-podman.sh [command]"
        echo ""
        echo "Commands:"
        echo "  test        - Run all E2E tests (default)"
        echo "  services    - Start backend and frontend services only"
        echo "  debug       - Start services and wait (for manual testing)"
        echo "  logs        - Show logs from all services"
        echo "  clean       - Stop and remove all containers"
        echo "  rebuild     - Rebuild all containers from scratch"
        exit 1
        ;;
esac
