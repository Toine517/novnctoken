FROM ubuntu:22.04

# Éviter les interactions lors des installations apt
ENV DEBIAN_FRONTEND=noninteractive

# Installation des paquets nécessaires : Node.js, Nginx, XFCE, TigerVNC, noVNC, Git
RUN apt-get update && apt-get install -y \
    curl \
    nginx \
    tigervnc-standalone-server \
    xfce4 \
    xfce4-goodies \
    novnc \
    websockify \
    nodejs \
    npm \
    git \
    && rm -rf /var/lib/apt/lists/*

# Création d'un utilisateur non-root pour la sécurité (recommandé)
RUN useradd -m -s /bin/bash appuser
WORKDIR /home/appuser

# Copie des fichiers de configuration et du serveur d'authentification
COPY nginx.conf /etc/nginx/sites-available/default
COPY server.js /home/appuser/server.js

# Configuration des permissions
RUN chown -R appuser:appuser /home/appuser

# Ports exposés (Clever Cloud écoute généralement sur le port 8080 ou utilise $PORT)
EXPOSE 8080

# Script de lancement global (Nginx + Node + VNC)
CMD ["node", "server.js"]
