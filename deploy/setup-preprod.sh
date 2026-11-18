#!/usr/bin/env bash
# À lancer une fois sur le VPS, en tant qu'ubuntu : ./setup-preprod.sh
# Clone la branche preprod, crée le script de déploiement et le premier déploiement.
set -euo pipefail

DIR=/home/ubuntu/auspex-preprod
REPO=https://github.com/orphane-a/auspex.git

[ -d "$DIR/.git" ] || git clone --branch preprod "$REPO" "$DIR"

cat > /home/ubuntu/deploy-auspex-preprod.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/auspex-preprod
git fetch origin preprod
git reset --hard origin/preprod
docker compose -f docker-compose.preprod.yml up -d --build
docker image prune -f
SCRIPT
chmod +x /home/ubuntu/deploy-auspex-preprod.sh

/home/ubuntu/deploy-auspex-preprod.sh
echo "Préprod lancée sur https://preprod.auspex.orphane.fr"
