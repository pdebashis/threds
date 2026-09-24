# Deploy threds-api on AWS EC2

This deployment uses one EC2 instance running Docker Compose. The Rails API connects to Neon for PostgreSQL, and Caddy provides HTTPS certificates automatically for the API domain.

## AWS setup

1. Create an Ubuntu 24.04 EC2 instance using a free-tier eligible instance type in the region you prefer.
2. Attach a security group that allows TCP 22 from your IP, and TCP 80 and 443 from `0.0.0.0/0`. Do not open port 5432.
3. Allocate and associate an Elastic IP so the address does not change after a stop/start.
4. Point an `A` DNS record such as `api.example.com` to that Elastic IP.
5. Connect over SSH and install Docker:

```sh
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Sign out and reconnect after the group change.

## Deploy

From the EC2 host:

```sh
git clone YOUR_REPOSITORY_URL threds
cd threds
cp deploy/aws/env.example deploy/aws/.env.aws
nano deploy/aws/.env.aws
```

Set `API_DOMAIN` to the DNS name already pointing to the instance, set `CORS_ORIGINS` to the public frontend URL, and set `DATABASE_URL` to the pooled Neon connection string. The Neon URL should include `?sslmode=require`. Also fill in the Rails and Cloudinary values. Copy the Rails master key from your local `threds-api/config/master.key`; never commit it or the `.env.aws` file.

Start the stack:

```sh
docker compose --env-file deploy/aws/.env.aws -f deploy/aws/docker-compose.yml up -d --build
```

Check the API:

```sh
curl https://api.example.com/up
docker compose --env-file deploy/aws/.env.aws -f deploy/aws/docker-compose.yml logs -f api
```

The first boot runs `rails db:prepare` against Neon. Use Neon branching and backups for database recovery; no database data is stored on the EC2 instance.

## Frontend

Set `VITE_API_URL=https://api.example.com` in `threds-ui`, build the frontend, and deploy it to your frontend host. The API's `CORS_ORIGINS` value must exactly match the frontend origin, without a trailing slash.

## Updates

```sh
git pull
docker compose --env-file deploy/aws/.env.aws -f deploy/aws/docker-compose.yml up -d --build
```

