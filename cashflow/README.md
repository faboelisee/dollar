# CashFlow CI — Outil de Gestion de Caisse Professionnel

**Application SaaS de gestion de caisse pour les PME africaines — Côte d'Ivoire & Afrique de l'Ouest**

---

## Aperçu

CashFlow CI est une application web et mobile complète de gestion de trésorerie, conçue spécifiquement pour les réalités des entreprises africaines. Elle intègre la norme comptable SYSCOHADA et les modes de paiement locaux (Orange Money, MTN MoMo, Wave).

---

## Structure du Projet

```
cashflow/
├── CAHIER_DES_CHARGES.md    ← Spécification complète (11 sections)
├── frontend/                 ← Application Web (Next.js 14 + TypeScript)
│   ├── src/
│   │   ├── app/             ← Pages (App Router)
│   │   ├── components/      ← Composants réutilisables
│   │   ├── lib/             ← API client, utilitaires
│   │   ├── store/           ← État global (Zustand)
│   │   └── types/           ← Types TypeScript
│   ├── Dockerfile
│   └── package.json
├── backend/                  ← API REST (Fastify + Prisma + PostgreSQL)
│   ├── src/
│   │   ├── routes/          ← Tous les endpoints API
│   │   ├── services/        ← Logique métier
│   │   ├── middleware/      ← Auth, gestion d'erreurs
│   │   └── lib/             ← Prisma client, utilitaires
│   ├── prisma/
│   │   └── schema.prisma    ← Schéma base de données complet
│   ├── Dockerfile
│   └── package.json
├── mobile/                   ← App React Native (Expo) — à développer
└── infra/
    └── docker/
        ├── docker-compose.yml
        └── nginx.conf
```

---

## Technologies

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, Zustand |
| Backend | Fastify, TypeScript, Prisma ORM |
| Base de données | PostgreSQL 16 |
| Cache | Redis 7 |
| Temps réel | Socket.io (WebSocket) |
| PDF | PDFKit |
| OCR | Tesseract.js |
| Mobile | React Native (Expo) |
| Infra | Docker, Nginx |

---

## Démarrage Rapide

### Prérequis
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (ou via Docker)

### 1. Cloner le projet
```bash
git clone <repo>
cd cashflow
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Remplir les variables dans .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### 4. Via Docker Compose
```bash
cd infra/docker
docker compose up -d
```

---

## Endpoints API Principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/v1/auth/login` | Connexion |
| GET | `/api/v1/companies/:id/dashboard` | Tableau de bord |
| GET | `/api/v1/operations` | Liste des opérations |
| POST | `/api/v1/operations` | Créer une opération |
| POST | `/api/v1/operations/:id/validate` | Valider une opération |
| POST | `/api/v1/cash-registers/:id/close` | Clôturer une caisse |
| GET | `/api/v1/accounting/trial-balance` | Balance des comptes |
| GET | `/api/v1/reports/daily-cash/:id` | Rapport journalier |
| POST | `/api/v1/ocr/scan` | Scanner un reçu (OCR) |

---

## Plans Tarifaires (FCFA)

| Plan | Mensuel | Annuel | Caisses | Utilisateurs |
|------|---------|--------|---------|--------------|
| Starter | 15 000 | 150 000 | 2 | 3 |
| Business | 45 000 | 450 000 | 10 | 15 |
| Enterprise | Sur devis | Sur devis | Illimité | Illimité |

---

## Conformité

- Norme comptable **SYSCOHADA Révisé 2017**
- Régime fiscal **DGI Côte d'Ivoire**
- Protection des données (**RGPD-compatible**)
- Archivage légal **10 ans**

---

*CashFlow CI — Votre trésorerie, sous contrôle.*
