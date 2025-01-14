#!/bin/bash

# Mise à jour du système
echo "Mise à jour du système..."
apt update && apt upgrade -y

# Installation de Node.js et npm
echo "Installation de Node.js et npm..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Installation de git
echo "Installation de git..."
apt install -y git

# Création du répertoire pour l'application
echo "Création du répertoire de l'application..."
mkdir -p /opt/network-config
cd /opt/network-config

# Clonage du projet (à remplacer par votre dépôt Git)
echo "Clonage du projet..."
git clone https://github.com/votre-repo/network-config.git .

# Installation des dépendances
echo "Installation des dépendances..."
npm install

# Build de l'application
echo "Build de l'application..."
npm run build

# Installation de nginx
echo "Installation de nginx..."
apt install -y nginx

# Configuration de nginx
echo "Configuration de nginx..."
cat > /etc/nginx/sites-available/network-config << 'EOL'
server {
    listen 80;
    server_name _;
    root /opt/network-config/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOL

# Activation du site nginx
ln -s /etc/nginx/sites-available/network-config /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
systemctl restart nginx

echo "Installation terminée !"
echo "L'application est accessible sur http://IP_DE_VOTRE_VM"