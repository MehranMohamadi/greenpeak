# 🚀 Quick Start: Deploy SP500 Dashboard on Ubuntu

This is a **quick deployment guide** for Ubuntu. For detailed instructions, see `DEPLOYMENT_UBUNTU.md`.

## ⚡ One-Command Deployment

```bash
curl -fsSL https://raw.githubusercontent.com/a0x0h/sp500-dashboard/main/deploy-ubuntu.sh | bash
```

## 📋 Manual Quick Setup

### 1. Prerequisites
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 2. Deploy Application
```bash
# Clone and setup
git clone https://github.com/a0x0h/sp500-dashboard.git /opt/sp500-dashboard
cd /opt/sp500-dashboard

# Configure environment
cp .env.example .env
nano .env  # Edit with your values

# Deploy
docker compose up -d
```

### 3. Essential Configuration

Edit `.env` file with these required values:
```bash
MONGO_PASSWORD=your_secure_password
FRED_API_KEY=your_fred_api_key  # Get from https://fred.stlouisfed.org/
DOMAIN=yourdomain.com
SERVER_IP=your.server.ip
```

## 🎯 Quick Management

```bash
# Make management script executable
chmod +x sp500-manage.sh

# Essential commands
./sp500-manage.sh start     # Start services
./sp500-manage.sh status    # Check status
./sp500-manage.sh logs      # View logs
./sp500-manage.sh health    # Health check
./sp500-manage.sh ssl       # Setup SSL
```

## 🔧 Verify Deployment

```bash
# Check containers
docker compose ps

# Test application
curl http://localhost              # Frontend
curl http://localhost/api/health   # Backend API

# View logs
docker compose logs -f
```

## 🌐 Access Your Application

- **Local**: `http://your-server-ip`
- **Domain**: `http://yourdomain.com` (after DNS setup)
- **API**: `http://yourdomain.com/api`

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Containers won't start | `docker compose logs` |
| Permission denied | `sudo chown -R $USER:$USER /opt/sp500-dashboard` |
| Port conflicts | `sudo netstat -tulpn \| grep :80` |
| Memory issues | `docker stats` and `free -h` |

## 📞 Need Help?

1. **Check logs**: `./sp500-manage.sh logs`
2. **Run health check**: `./sp500-manage.sh health`
3. **View detailed guide**: `DEPLOYMENT_UBUNTU.md`
4. **Container status**: `docker compose ps`

## 🔄 Quick Updates

```bash
cd /opt/sp500-dashboard
./sp500-manage.sh update
```

---

**🎉 That's it!** Your SP500 Dashboard should now be running on Ubuntu.

For production deployment, **always**:
- Use strong passwords
- Set up SSL certificates
- Configure proper backups
- Monitor system resources
- Keep system updated
