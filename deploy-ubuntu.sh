#!/bin/bash

# SP500 Dashboard Ubuntu Deployment Script
# This script automates the deployment process on Ubuntu

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Configuration
PROJECT_DIR="/opt/sp500-dashboard"
REPO_URL="https://github.com/a0x0h/sp500-dashboard.git"

print_header "🚀 SP500 Dashboard Ubuntu Deployment Script"
echo "======================================================="
echo "This script will deploy the SP500 Dashboard on Ubuntu"
echo "======================================================="
echo

# Step 1: System Updates
print_header "Step 1: Updating System"
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip software-properties-common bc

# Step 2: Install Docker
print_header "Step 2: Installing Docker"
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    print_status "Docker installed successfully"
else
    print_status "Docker already installed"
fi

# Step 3: Configure Firewall
print_header "Step 3: Configuring Firewall"
if ! sudo ufw status | grep -q "Status: active"; then
    print_status "Configuring UFW firewall..."
    sudo ufw --force enable
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    print_status "Firewall configured"
else
    print_status "Firewall already configured"
fi

# Step 4: Clone Repository
print_header "Step 4: Setting up Application"
if [ ! -d "$PROJECT_DIR" ]; then
    print_status "Cloning repository..."
    sudo git clone $REPO_URL $PROJECT_DIR
    sudo chown -R $USER:$USER $PROJECT_DIR
else
    print_status "Repository already exists, updating..."
    cd $PROJECT_DIR
    git pull
fi

cd $PROJECT_DIR

# Step 5: Environment Configuration
print_header "Step 5: Configuring Environment"
if [ ! -f ".env" ]; then
    print_status "Creating environment configuration..."
    cp .env.example .env
    
    print_warning "Please configure your environment variables:"
    echo "1. MongoDB Password"
    echo "2. FRED API Key (get from https://fred.stlouisfed.org/docs/api/api_key.html)"
    echo "3. Domain name"
    echo "4. Server IP"
    echo
    
    read -p "Enter MongoDB password: " MONGO_PASS
    read -p "Enter FRED API Key: " FRED_KEY
    read -p "Enter your domain (or press Enter for IP access): " DOMAIN
    read -p "Enter your server IP: " SERVER_IP
    
    # Update .env file
    sed -i "s/MONGO_PASSWORD=.*/MONGO_PASSWORD=$MONGO_PASS/" .env
    sed -i "s/FRED_API_KEY=.*/FRED_API_KEY=$FRED_KEY/" .env
    sed -i "s/DOMAIN=.*/DOMAIN=${DOMAIN:-$SERVER_IP}/" .env
    sed -i "s/SERVER_IP=.*/SERVER_IP=$SERVER_IP/" .env
    
    print_status "Environment configured"
else
    print_status "Environment file already exists"
fi

# Step 6: Create Directories
print_header "Step 6: Creating Data Directories"
mkdir -p mongodb-init nginx/logs backend2/logs backup
chmod -R 755 nginx/logs backend2/logs backup

# Step 7: Deploy Application
print_header "Step 7: Deploying Application"
print_status "Building and starting containers..."

# New group membership requires a new shell
newgrp docker << EOF
docker compose pull
docker compose build --no-cache
docker compose up -d
EOF

# Wait for services to start
print_status "Waiting for services to start..."
sleep 30

# Step 8: Verify Deployment
print_header "Step 8: Verifying Deployment"
print_status "Checking container status..."

if docker compose ps | grep -q "Up"; then
    print_status "✅ Containers are running"
else
    print_error "❌ Some containers failed to start"
    docker compose ps
    exit 1
fi

# Test connectivity
print_status "Testing connectivity..."
if curl -f http://localhost > /dev/null 2>&1; then
    print_status "✅ Frontend is accessible"
else
    print_warning "⚠️  Frontend may not be ready yet"
fi

if curl -f http://localhost/api/health > /dev/null 2>&1; then
    print_status "✅ Backend API is accessible"
else
    print_warning "⚠️  Backend API may not be ready yet"
fi

# Step 9: Setup Monitoring
print_header "Step 9: Setting up Monitoring"
cat > monitor.sh << 'EOF'
#!/bin/bash

# SP500 Dashboard Monitoring Script
LOGFILE="/var/log/sp500-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting health check..." >> $LOGFILE

# Check Docker containers
if ! docker compose -f /opt/sp500-dashboard/docker-compose.yml ps | grep -q "Up"; then
    echo "[$DATE] ERROR: Some containers are down" >> $LOGFILE
    docker compose -f /opt/sp500-dashboard/docker-compose.yml up -d
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "[$DATE] WARNING: Disk usage is at ${DISK_USAGE}%" >> $LOGFILE
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{printf("%.2f", $3/$2 * 100.0)}')
if (( $(echo "$MEM_USAGE > 85" | bc -l) )); then
    echo "[$DATE] WARNING: Memory usage is at ${MEM_USAGE}%" >> $LOGFILE
fi

echo "[$DATE] Health check completed" >> $LOGFILE
EOF

chmod +x monitor.sh

# Add monitoring cron job
(crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_DIR/monitor.sh") | crontab -

# Step 10: Setup Backup
print_header "Step 10: Setting up Backup"
cat > backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/sp500-dashboard/backup"
DATE=$(date '+%Y%m%d_%H%M%S')
RETENTION_DAYS=30

# Load environment variables
source /opt/sp500-dashboard/.env

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MongoDB
docker exec sp500_mongodb mongodump --authenticationDatabase admin -u admin -p $MONGO_PASSWORD --out /backup/mongodb_$DATE
docker cp sp500_mongodb:/backup/mongodb_$DATE $BACKUP_DIR/

# Backup application data
tar -czf $BACKUP_DIR/app_data_$DATE.tar.gz /opt/sp500-dashboard/backend2/src/data /opt/sp500-dashboard/nginx/logs

# Clean old backups
find $BACKUP_DIR -name "mongodb_*" -mtime +$RETENTION_DAYS -exec rm -rf {} \;
find $BACKUP_DIR -name "app_data_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $(date)"
EOF

chmod +x backup.sh

# Add backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * * $PROJECT_DIR/backup.sh >> /var/log/sp500-backup.log 2>&1") | crontab -

# Final Steps
print_header "🎉 Deployment Complete!"
echo "======================================================="
print_status "SP500 Dashboard has been successfully deployed!"
echo
echo "📊 Access your application:"
echo "   HTTP:  http://$SERVER_IP"
echo "   API:   http://$SERVER_IP/api"
if [ ! -z "$DOMAIN" ] && [ "$DOMAIN" != "$SERVER_IP" ]; then
    echo "   Domain: http://$DOMAIN"
fi
echo
echo "🔧 Management commands:"
echo "   View logs:     docker compose logs -f"
echo "   Restart:       docker compose restart"
echo "   Stop:          docker compose down"
echo "   Update:        git pull && docker compose build --no-cache && docker compose up -d"
echo
echo "📝 Next steps:"
echo "   1. Configure DNS to point to your server IP"
echo "   2. Set up SSL certificate (see DEPLOYMENT_UBUNTU.md)"
echo "   3. Monitor logs and application performance"
echo
print_warning "Note: You may need to log out and back in for Docker group changes to take effect"
echo "======================================================="
