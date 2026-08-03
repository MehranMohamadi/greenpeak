# 🚀 Ubuntu Deployment Guide for SP500 Dashboard

This guide will help you deploy the SP500 Dashboard on Ubuntu 20.04/22.04 LTS.

## 📋 Prerequisites

### System Requirements
- Ubuntu 20.04 LTS or 22.04 LTS
- Minimum 2GB RAM (4GB+ recommended)
- Minimum 20GB disk space
- Root or sudo access

### Required Services
- Docker & Docker Compose
- Git
- UFW (Uncomplicated Firewall)

## 🛠️ Step 1: Initial Server Setup

### Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip software-properties-common
```

### Install Docker
```bash
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

# Verify installation
docker --version
docker compose version
```

### Install Docker Compose (if not included with Docker)
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 🔥 Step 2: Configure Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow MongoDB (only if external access needed)
# sudo ufw allow 27017/tcp

# Check status
sudo ufw status
```

## 📁 Step 3: Deploy Application

### Clone Repository
```bash
# Navigate to desired directory
cd /opt

# Clone the repository
sudo git clone https://github.com/a0x0h/sp500-dashboard.git
cd sp500-dashboard

# Set ownership
sudo chown -R $USER:$USER /opt/sp500-dashboard
```

### Configure Environment Variables
```bash
# Copy and edit environment file
cp .env.example .env
nano .env
```

Update the `.env` file with your values:
```bash
# MongoDB Configuration
MONGO_PASSWORD=your_secure_mongodb_password_here

# FRED API Configuration (get from https://fred.stlouisfed.org/docs/api/api_key.html)
FRED_API_KEY=your_fred_api_key_here

# Domain Configuration
DOMAIN=yourdomain.com
SERVER_IP=your_server_ip_here

# SSL Configuration (set to false initially)
SSL_ENABLED=false

# Application Environment
NODE_ENV=production
ENVIRONMENT=production

# Backup Configuration
BACKUP_RETENTION_DAYS=30

# Monitoring Configuration
ENABLE_MONITORING=true
```

### Create Data Directories
```bash
# Create necessary directories
sudo mkdir -p /opt/sp500-dashboard/mongodb-init
sudo mkdir -p /opt/sp500-dashboard/nginx/logs
sudo mkdir -p /opt/sp500-dashboard/backend2/logs
sudo mkdir -p /opt/sp500-dashboard/backup

# Set permissions
sudo chown -R $USER:$USER /opt/sp500-dashboard
```

## 🚀 Step 4: Deploy with Docker Compose

### Build and Start Services
```bash
cd /opt/sp500-dashboard

# Pull latest images and build
docker compose pull
docker compose build --no-cache

# Start services
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

### Verify Deployment
```bash
# Check all containers are running
docker compose ps

# Check individual service logs
docker compose logs mongodb
docker compose logs backend
docker compose logs frontend
docker compose logs nginx

# Test connectivity
curl http://localhost
curl http://localhost/api/health
```

## 🔒 Step 5: SSL Setup (Optional but Recommended)

### Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Get SSL Certificate
```bash
# Stop nginx container temporarily
docker compose stop nginx

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Update environment
sed -i 's/SSL_ENABLED=false/SSL_ENABLED=true/' .env
```

### Enable SSL Configuration
```bash
# Copy SSL certificate to nginx directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/sp500-dashboard/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/sp500-dashboard/nginx/ssl/

# Enable SSL config
sudo mv /opt/sp500-dashboard/nginx/conf.d/ssl.conf.disabled /opt/sp500-dashboard/nginx/conf.d/ssl.conf

# Restart nginx
docker compose restart nginx
```

## 📊 Step 6: Set Up Monitoring

### Create Monitoring Script
```bash
sudo tee /opt/sp500-dashboard/monitor.sh > /dev/null << 'EOF'
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

sudo chmod +x /opt/sp500-dashboard/monitor.sh
```

### Set Up Cron Job
```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/sp500-dashboard/monitor.sh") | crontab -

# Verify crontab
crontab -l
```

## 💾 Step 7: Backup Strategy

### Create Backup Script
```bash
sudo tee /opt/sp500-dashboard/backup.sh > /dev/null << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/sp500-dashboard/backup"
DATE=$(date '+%Y%m%d_%H%M%S')
RETENTION_DAYS=30

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

sudo chmod +x /opt/sp500-dashboard/backup.sh
```

### Schedule Backups
```bash
# Add daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/sp500-dashboard/backup.sh >> /var/log/sp500-backup.log 2>&1") | crontab -
```

## 🔧 Step 8: Useful Management Commands

### Service Management
```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart backend

# View logs
docker compose logs -f frontend

# Update application
git pull
docker compose build --no-cache
docker compose up -d
```

### System Maintenance
```bash
# Clean up Docker
docker system prune -f
docker volume prune -f

# Update system
sudo apt update && sudo apt upgrade -y

# Check disk usage
df -h
du -sh /opt/sp500-dashboard/*
```

### Troubleshooting
```bash
# Check container status
docker compose ps

# Check container logs
docker compose logs --tail=50 backend

# Access container shell
docker compose exec backend bash
docker compose exec mongodb mongosh

# Check nginx configuration
docker compose exec nginx nginx -t

# Monitor resource usage
docker stats
```

## 🚨 Common Issues & Solutions

### Issue: Containers won't start
```bash
# Check logs
docker compose logs

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Issue: Database connection failed
```bash
# Check MongoDB is running
docker compose logs mongodb

# Test connection
docker compose exec backend python -c "import pymongo; print('MongoDB connected')"
```

### Issue: High memory usage
```bash
# Check memory usage
free -h
docker stats

# Restart services
docker compose restart
```

### Issue: SSL certificate problems
```bash
# Renew certificate
sudo certbot renew --dry-run

# Check certificate
sudo certbot certificates
```

## 📝 Production Checklist

- [ ] Server hardened and updated
- [ ] Firewall configured (UFW)
- [ ] Docker and Docker Compose installed
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Monitoring script running
- [ ] Backup strategy implemented
- [ ] DNS records configured
- [ ] Application accessible via domain
- [ ] All health checks passing

## 🌐 Accessing Your Application

Once deployed, your application will be available at:
- **HTTP**: `http://yourdomain.com` or `http://your-server-ip`
- **HTTPS**: `https://yourdomain.com` (if SSL enabled)
- **API**: `http://yourdomain.com/api` or `https://yourdomain.com/api`

## 📞 Support

If you encounter issues:
1. Check the logs: `docker compose logs`
2. Verify all containers are running: `docker compose ps`
3. Check system resources: `htop` or `docker stats`
4. Review this guide for troubleshooting steps

## 🔄 Updates

To update your application:
```bash
cd /opt/sp500-dashboard
git pull
docker compose build --no-cache
docker compose up -d
```

---

**🎉 Congratulations!** Your SP500 Dashboard is now deployed on Ubuntu and ready for production use.
