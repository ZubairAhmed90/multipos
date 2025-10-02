#!/bin/bash

# Production Deployment Script for Frontend MultiPOS
# This script handles the complete deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="frontend-multipos"
BUILD_DIR=".next"
DIST_DIR="dist"
BACKUP_DIR="backups"
LOG_FILE="deployment.log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a $LOG_FILE
    exit 1
}

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    if ! command -v git &> /dev/null; then
        error "git is not installed"
    fi
    
    success "All dependencies are installed"
}

# Validate environment variables
validate_environment() {
    log "Validating environment variables..."
    
    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV="production"
        warning "NODE_ENV not set, defaulting to production"
    fi
    
    if [ -z "$NEXT_PUBLIC_API_URL" ]; then
        error "NEXT_PUBLIC_API_URL is required"
    fi
    
    success "Environment variables validated"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci --production=false
    else
        npm install
    fi
    
    success "Dependencies installed"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        npm test -- --passWithNoTests
        success "Tests passed"
    else
        warning "No tests configured, skipping..."
    fi
}

# Lint code
lint_code() {
    log "Linting code..."
    
    if [ -f "package.json" ] && grep -q '"lint"' package.json; then
        npm run lint || warning "Linting failed, continuing..."
    else
        warning "No linting configured, skipping..."
    fi
}

# Build application
build_application() {
    log "Building application..."
    
    # Clean previous build
    if [ -d "$BUILD_DIR" ]; then
        rm -rf $BUILD_DIR
        log "Cleaned previous build"
    fi
    
    # Create production build
    npm run build
    
    if [ ! -d "$BUILD_DIR" ]; then
        error "Build failed - build directory not found"
    fi
    
    success "Application built successfully"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    if [ -d "$DIST_DIR" ]; then
        mkdir -p $BACKUP_DIR
        BACKUP_NAME="backup-$(date +'%Y%m%d-%H%M%S')"
        cp -r $DIST_DIR $BACKUP_DIR/$BACKUP_NAME
        success "Backup created: $BACKUP_NAME"
    else
        warning "No existing dist directory to backup"
    fi
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Create dist directory
    mkdir -p $DIST_DIR
    
    # Copy build files
    cp -r $BUILD_DIR/* $DIST_DIR/
    
    # Copy public files
    if [ -d "public" ]; then
        cp -r public/* $DIST_DIR/
    fi
    
    # Copy package.json for production
    cp package.json $DIST_DIR/
    
    success "Application deployed to $DIST_DIR"
}

# Generate deployment info
generate_deployment_info() {
    log "Generating deployment info..."
    
    DEPLOYMENT_INFO="{
        \"timestamp\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\",
        \"version\": \"$(git describe --tags --always 2>/dev/null || echo 'unknown')\",
        \"commit\": \"$(git rev-parse HEAD 2>/dev/null || echo 'unknown')\",
        \"branch\": \"$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')\",
        \"node_version\": \"$(node --version)\",
        \"npm_version\": \"$(npm --version)\",
        \"environment\": \"$NODE_ENV\",
        \"api_url\": \"$NEXT_PUBLIC_API_URL\"
    }"
    
    echo $DEPLOYMENT_INFO > $DIST_DIR/deployment-info.json
    success "Deployment info generated"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check if build files exist
    if [ ! -f "$DIST_DIR/index.html" ] && [ ! -f "$DIST_DIR/_next/static" ]; then
        error "Health check failed - build files not found"
    fi
    
    success "Health check passed"
}

# Cleanup
cleanup() {
    log "Cleaning up..."
    
    # Remove old backups (keep last 5)
    if [ -d "$BACKUP_DIR" ]; then
        cd $BACKUP_DIR
        ls -t | tail -n +6 | xargs -r rm -rf
        cd ..
    fi
    
    success "Cleanup completed"
}

# Main deployment function
deploy() {
    log "Starting deployment process..."
    
    check_dependencies
    validate_environment
    install_dependencies
    run_tests
    lint_code
    build_application
    create_backup
    deploy_application
    generate_deployment_info
    health_check
    cleanup
    
    success "Deployment completed successfully!"
    log "Deployment log saved to: $LOG_FILE"
}

# Rollback function
rollback() {
    log "Starting rollback process..."
    
    if [ ! -d "$BACKUP_DIR" ]; then
        error "No backups found"
    fi
    
    LATEST_BACKUP=$(ls -t $BACKUP_DIR | head -n1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        error "No backup found"
    fi
    
    log "Rolling back to: $LATEST_BACKUP"
    
    # Remove current dist
    rm -rf $DIST_DIR
    
    # Restore from backup
    cp -r $BACKUP_DIR/$LATEST_BACKUP $DIST_DIR
    
    success "Rollback completed to: $LATEST_BACKUP"
}

# Show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy the application (default)"
    echo "  rollback  Rollback to previous version"
    echo "  build     Build application only"
    echo "  test      Run tests only"
    echo "  help      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  NODE_ENV              Node environment (default: production)"
    echo "  NEXT_PUBLIC_API_URL   API URL (required)"
    echo "  ANALYZE               Enable bundle analysis (true/false)"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  NODE_ENV=staging $0 deploy"
    echo "  $0 rollback"
}

# Main script logic
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "rollback")
        rollback
        ;;
    "build")
        check_dependencies
        validate_environment
        install_dependencies
        build_application
        success "Build completed"
        ;;
    "test")
        check_dependencies
        install_dependencies
        run_tests
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        error "Unknown command: $1. Use 'help' for usage information."
        ;;
esac
