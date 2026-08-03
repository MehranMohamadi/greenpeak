#!/bin/bash

# SP500 Dashboard Management Script
# This script provides easy management commands for the SP500 Dashboard

# Configuration
PROJECT_DIR="/opt/sp500-dashboard"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
ENV_FILE="$PROJECT_DIR/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored output
print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[ACTION]${NC} $1"; }

# Check if running from correct directory
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "Docker compose file not found at $COMPOSE_FILE"
    print_error "Please run this script from the project directory or update PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Function to show help
show_help() {
    echo "SP500 Dashboard Management Script"
    echo "================================="
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  status      Show service status"
    echo "  logs        Show logs (use -f for follow)"
    echo "  update      Update application and restart"
    echo "  backup      Create backup"
    echo "  restore     Restore from backup"
    echo "  clean       Clean up Docker resources"
    echo "  monitor     Show resource usage"
    echo "  health      Run health checks"
    echo "  ssl         Setup SSL certificate"
    echo "  env         Edit environment variables"
    echo "  shell       Access container shell"
    echo "  help        Show this help message"
    echo
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs -f frontend"
    echo "  $0 shell backend"
    echo
}

# Function to start services
start_services() {
    print_header "Starting SP500 Dashboard services..."
    docker compose up -d
    sleep 10
    
    print_status "Checking service status..."
    docker compose ps
    
    print_status "Services started. Access your application at:"
    if [ -f "$ENV_FILE" ]; then
        DOMAIN=$(grep "DOMAIN=" "$ENV_FILE" | cut -d'=' -f2)
        SERVER_IP=$(grep "SERVER_IP=" "$ENV_FILE" | cut -d'=' -f2)
        SSL_ENABLED=$(grep "SSL_ENABLED=" "$ENV_FILE" | cut -d'=' -f2)
        
        if [ "$SSL_ENABLED" = "true" ]; then
            echo "  🌐 https://$DOMAIN"
        else
            echo "  🌐 http://$DOMAIN"
            echo "  🌐 http://$SERVER_IP"
        fi
    fi
}

# Function to stop services
stop_services() {
    print_header "Stopping SP500 Dashboard services..."
    docker compose down
    print_status "Services stopped"
}

# Function to restart services
restart_services() {
    print_header "Restarting SP500 Dashboard services..."
    docker compose restart
    print_status "Services restarted"
}

# Function to show status
show_status() {
    print_header "SP500 Dashboard Service Status"
    docker compose ps
    echo
    
    print_header "Resource Usage"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Function to show logs
show_logs() {
    service=${2:-""}
    follow_flag=""
    
    if [ "$2" = "-f" ]; then
        follow_flag="-f"
        service=${3:-""}
    fi
    
    if [ -n "$service" ]; then
        print_header "Showing logs for $service..."
        docker compose logs $follow_flag "$service"
    else
        print_header "Showing logs for all services..."
        docker compose logs $follow_flag
    fi
}

# Function to update application
update_application() {
    print_header "Updating SP500 Dashboard..."
    
    # Pull latest code
    print_status "Pulling latest code..."
    git pull
    
    # Rebuild containers
    print_status "Rebuilding containers..."
    docker compose build --no-cache
    
    # Restart services
    print_status "Restarting services..."
    docker compose up -d
    
    # Clean up old images
    print_status "Cleaning up old images..."
    docker image prune -f
    
    print_status "Update completed successfully!"
}

# Function to create backup
create_backup() {
    print_header "Creating backup..."
    
    if [ -f "$PROJECT_DIR/backup.sh" ]; then
        "$PROJECT_DIR/backup.sh"
        print_status "Backup completed"
    else
        print_error "Backup script not found at $PROJECT_DIR/backup.sh"
        exit 1
    fi
}

# Function to restore backup
restore_backup() {
    print_header "Available backups:"
    ls -la "$PROJECT_DIR/backup/" | grep mongodb_
    echo
    
    read -p "Enter backup date (YYYYMMDD_HHMMSS): " backup_date
    
    if [ -d "$PROJECT_DIR/backup/mongodb_$backup_date" ]; then
        print_warning "This will overwrite current database. Continue? (y/N)"
        read -r confirm
        
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            print_status "Restoring backup..."
            # Stop services
            docker compose stop backend
            
            # Restore MongoDB
            docker cp "$PROJECT_DIR/backup/mongodb_$backup_date" sp500_mongodb:/backup/
            docker exec sp500_mongodb mongorestore --authenticationDatabase admin -u admin -p "$MONGO_PASSWORD" --drop /backup/mongodb_$backup_date/sp500_dashboard
            
            # Start services
            docker compose start backend
            
            print_status "Restore completed"
        else
            print_status "Restore cancelled"
        fi
    else
        print_error "Backup not found: mongodb_$backup_date"
    fi
}

# Function to clean up Docker resources
clean_docker() {
    print_header "Cleaning up Docker resources..."
    
    print_warning "This will remove unused Docker images, containers, and volumes. Continue? (y/N)"
    read -r confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        docker system prune -f
        docker volume prune -f
        print_status "Docker cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to monitor resources
monitor_resources() {
    print_header "SP500 Dashboard Resource Monitor"
    echo "Press Ctrl+C to exit"
    echo
    
    watch -n 2 'echo "=== CONTAINER STATS ==="; docker stats --no-stream; echo; echo "=== SYSTEM RESOURCES ==="; free -h; echo; df -h | head -5'
}

# Function to run health checks
run_health_checks() {
    print_header "Running health checks..."
    
    # Check container status
    print_status "Checking container status..."
    if docker compose ps | grep -q "Up"; then
        print_status "✅ Containers are running"
    else
        print_error "❌ Some containers are not running"
        docker compose ps
    fi
    
    # Check frontend
    print_status "Checking frontend..."
    if curl -f http://localhost > /dev/null 2>&1; then
        print_status "✅ Frontend is accessible"
    else
        print_error "❌ Frontend is not accessible"
    fi
    
    # Check backend API
    print_status "Checking backend API..."
    if curl -f http://localhost/api/health > /dev/null 2>&1; then
        print_status "✅ Backend API is accessible"
    else
        print_error "❌ Backend API is not accessible"
    fi
    
    # Check MongoDB
    print_status "Checking MongoDB..."
    if docker compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        print_status "✅ MongoDB is accessible"
    else
        print_error "❌ MongoDB is not accessible"
    fi
    
    # Check disk space
    print_status "Checking disk space..."
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 85 ]; then
        print_status "✅ Disk usage is OK (${disk_usage}%)"
    else
        print_warning "⚠️  Disk usage is high (${disk_usage}%)"
    fi
    
    # Check memory
    print_status "Checking memory usage..."
    mem_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
    if [ "$mem_usage" -lt 85 ]; then
        print_status "✅ Memory usage is OK (${mem_usage}%)"
    else
        print_warning "⚠️  Memory usage is high (${mem_usage}%)"
    fi
}

# Function to setup SSL
setup_ssl() {
    print_header "Setting up SSL certificate..."
    
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found"
        exit 1
    fi
    
    DOMAIN=$(grep "DOMAIN=" "$ENV_FILE" | cut -d'=' -f2)
    
    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
        print_error "Please set a valid domain in your .env file"
        exit 1
    fi
    
    print_status "Setting up SSL for domain: $DOMAIN"
    
    # Install certbot if not present
    if ! command -v certbot &> /dev/null; then
        print_status "Installing certbot..."
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
    fi
    
    # Stop nginx temporarily
    docker compose stop nginx
    
    # Get certificate
    print_status "Obtaining SSL certificate..."
    sudo certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN"
    
    # Copy certificates
    print_status "Copying certificates..."
    sudo mkdir -p "$PROJECT_DIR/nginx/ssl"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$PROJECT_DIR/nginx/ssl/"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$PROJECT_DIR/nginx/ssl/"
    sudo chown -R $USER:$USER "$PROJECT_DIR/nginx/ssl"
    
    # Enable SSL in environment
    sed -i 's/SSL_ENABLED=false/SSL_ENABLED=true/' "$ENV_FILE"
    
    # Enable SSL configuration
    if [ -f "$PROJECT_DIR/nginx/conf.d/ssl.conf.disabled" ]; then
        mv "$PROJECT_DIR/nginx/conf.d/ssl.conf.disabled" "$PROJECT_DIR/nginx/conf.d/ssl.conf"
    fi
    
    # Start nginx
    docker compose start nginx
    
    print_status "SSL setup completed! Your site is now available at https://$DOMAIN"
}

# Function to edit environment
edit_environment() {
    print_header "Opening environment file for editing..."
    
    if command -v nano &> /dev/null; then
        nano "$ENV_FILE"
    elif command -v vim &> /dev/null; then
        vim "$ENV_FILE"
    else
        print_error "No text editor found (nano/vim)"
        exit 1
    fi
    
    print_warning "Environment changed. Restart services to apply changes."
}

# Function to access container shell
access_shell() {
    service=${2:-"backend"}
    
    print_header "Accessing $service container shell..."
    
    if docker compose ps | grep -q "$service.*Up"; then
        docker compose exec "$service" bash
    else
        print_error "Service '$service' is not running"
        exit 1
    fi
}

# Main script logic
case "${1:-help}" in
    "start")
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        restart_services
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs "$@"
        ;;
    "update")
        update_application
        ;;
    "backup")
        create_backup
        ;;
    "restore")
        restore_backup
        ;;
    "clean")
        clean_docker
        ;;
    "monitor")
        monitor_resources
        ;;
    "health")
        run_health_checks
        ;;
    "ssl")
        setup_ssl
        ;;
    "env")
        edit_environment
        ;;
    "shell")
        access_shell "$@"
        ;;
    "help"|*)
        show_help
        ;;
esac
