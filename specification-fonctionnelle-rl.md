# Spécification fonctionnelle et technique

Cahier de sortie d'aviron - Rowing Logbook

---

## Table des matières

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [Périmètre du MVP](#2-périmètre-du-mvp)
3. [Acteurs et rôles](#3-acteurs-et-rôles)
4. [Fonctionnalités détaillées](#4-fonctionnalités-détaillées)
5. [Règles métier](#5-règles-métier)
6. [Architecture technique](#6-architecture-technique)
7. [Modèle de données](#7-modèle-de-données)
8. [Sécurité et authentification](#8-sécurité-et-authentification)
9. [Notifications](#9-notifications)
10. [Conservation des données](#10-conservation-des-données)
11. [Hors périmètre MVP (V2)](#11-hors-périmètre-mvp-v2)
12. [Interfaces API MVP](#12-interfaces-api-mvp)
13. [Tests et critères d'acceptation](#13-tests-et-critères-dacceptation)
14. [Hypothèses techniques](#14-hypothèses-techniques)

---

## 1. Contexte et objectifs

Dans les clubs d'aviron, les rameurs ont l'obligation réglementaire de s'inscrire sur un cahier de sortie avant chaque mise à l'eau. Ce cahier permet de :

- Assurer la sécurité des pratiquants (qui est sur l'eau, avec quel bateau, depuis combien de temps)
- Suivre l'utilisation des bateaux (maintenance, disponibilités)
- Constituer un historique des activités du club

Objectif du projet : dématérialiser ce cahier sous forme de deux applications complémentaires :

- Une application mobile pour les rameurs
- Une application web d'administration pour le staff et les administrateurs

---

## 2. Périmètre du MVP

Le MVP couvre les fonctionnalités essentielles suivantes :

| Fonctionnalité                 | Application  | Inclus MVP |
| ------------------------------ | ------------ | ---------- |
| Authentification               | Mobile + Web | Oui        |
| Créer une sortie               | Mobile       | Oui        |
| Clôturer une sortie            | Mobile + Web | Oui        |
| Consulter les sorties en cours | Mobile + Web | Oui        |
| Historique des sorties         | Mobile + Web | Oui        |
| Gestion des membres            | Web          | Oui        |
| Gestion des bateaux            | Web          | Oui        |
| Alertes de sécurité (3h)       | Mobile + Web | Oui        |
| Statistiques avancées          | Web          | Oui        |
| Export des données (CSV)       | Web          | Oui        |
| Mode hors-ligne                | Mobile       | Non (V2)   |
| Carte / tracé GPS              | Mobile       | Non (V2)   |
| Gestion des parcours           | Web          | Non (V2)   |

Précision MVP : sur mobile, l'historique affiche uniquement les sorties du membre connecté.

---

## 3. Acteurs et rôles

### 3.1 Rameur (`ROWER`)

- Se connecter à l'application mobile
- Créer et clôturer ses propres sorties
- Consulter les sorties en cours
- Consulter l'historique de ses sorties

### 3.2 Staff (`STAFF`)

- Hérite des capacités `ROWER` côté mobile
- Accède à l'application web d'administration
- Reçoit les alertes de sécurité
- Clôture n'importe quelle sortie depuis le web
- Consulte les statistiques

### 3.3 Administrateur (`ADMIN`)

- Hérite des capacités `STAFF` et `ROWER`
- Gère les membres (CRUD + activation/désactivation)
- Gère les bateaux (CRUD + hors service)
- Accède à toutes les fonctionnalités de l'application web

Note : un utilisateur a un seul rôle à la fois. Hiérarchie : `ADMIN > STAFF > ROWER`.

---

## 4. Fonctionnalités détaillées

### 4.1 Application mobile - Rameurs

#### 4.1.1 Authentification

- Connexion par email + mot de passe
- Maintien de session via JWT
- Déconnexion manuelle
- Mot de passe oublié (email de réinitialisation)

#### 4.1.2 Tableau de bord

- Liste des sorties en cours (bateaux actuellement sur l'eau)
  - Affichage : bateau, responsable, heure de départ, durée écoulée
  - Mise en évidence visuelle à partir de 2h30
- Bouton d'accès rapide "Nouvelle sortie"

#### 4.1.3 Créer une sortie

| Champ           | Type            | Obligatoire | Détail                                        |
| --------------- | --------------- | ----------- | --------------------------------------------- |
| Bateau          | Sélection       | Oui         | Liste des bateaux disponibles                 |
| Heure de départ | Date/heure      | Oui         | Pré-remplie avec l'heure actuelle, modifiable |
| Distance prévue | Nombre (km)     | Oui         | Valeur décimale                               |
| Parcours        | Texte libre     | Non         | Description libre                             |
| Équipage        | Multi-sélection | Non         | Membres actifs uniquement                     |
| Remarques       | Texte libre     | Non         | Observations avant départ                     |

Règles de validation :

- Le bateau sélectionné ne doit pas avoir de sortie en cours
- L'heure de départ ne peut pas être dans le futur
- Le créateur est automatiquement responsable de la sortie
- La taille de l'équipage doit respecter la capacité du bateau (validation applicative)

#### 4.1.4 Clôturer une sortie

Accessible uniquement pour les sorties dont l'utilisateur est responsable.

| Champ           | Type        | Obligatoire | Détail                              |
| --------------- | ----------- | ----------- | ----------------------------------- |
| Heure de retour | Date/heure  | Oui         | Pré-remplie avec l'heure actuelle   |
| Distance réelle | Nombre (km) | Oui         | Pré-remplie avec la distance prévue |
| Remarques       | Texte libre | Non         | Observations après sortie           |

Règles de validation :

- L'heure de retour est strictement postérieure à l'heure de départ
- La clôture libère immédiatement le bateau

#### 4.1.5 Historique des sorties

- Liste paginée des sorties du membre connecté
- Filtres : date, bateau
- Tri par défaut : date décroissante
- Détail d'une sortie : tous les champs, équipage, remarques

### 4.2 Application web - Administration

#### 4.2.1 Authentification

- Connexion email + mot de passe
- Accès réservé aux rôles `STAFF` et `ADMIN`

#### 4.2.2 Tableau de bord

- Vue en temps réel des sorties en cours
  - Colonnes : bateau, responsable, équipage, départ, durée, parcours, distance prévue
  - Mise en évidence des sorties dépassant 3h
- Indicateurs du jour :
  - Nombre de sorties en cours
  - Nombre de sorties clôturées
  - Bateaux disponibles / total

#### 4.2.3 Gestion des sorties

- Liste complète (en cours + historique)
  - Filtres : date, bateau, rameur, statut
  - Tri par colonnes
  - Pagination
- Clôturer n'importe quelle sortie en cours (`STAFF`, `ADMIN`)
- Détail d'une sortie
- Export CSV des résultats filtrés

#### 4.2.4 Gestion des membres (`ADMIN`)

- Liste : prénom, nom, email, rôle, statut, date d'inscription
- Créer un membre (invitation email)
- Modifier un membre (email non modifiable)
- Désactiver / réactiver un membre
- Supprimer logiquement un membre (historique conservé)

#### 4.2.5 Gestion des bateaux (`ADMIN`)

- Liste : nom, type, capacité, état, statut
- Créer un bateau
- Modifier un bateau
- Mettre hors service un bateau
- Consulter l'historique par bateau

#### 4.2.6 Statistiques (`STAFF`, `ADMIN`)

Accès réservé aux rôles `STAFF` et `ADMIN`.

- Par période (semaine, mois, année, personnalisée)
  - Nombre de sorties
  - Distance totale
  - Durée totale
- Par rameur
  - Nombre de sorties
  - Distance totale
  - Classement d'activité
- Par bateau
  - Taux d'utilisation
  - Nombre de sorties
  - Distance totale

### 4.3 Fonctionnalités transversales

#### 4.3.1 Alertes de sécurité

- Vérification automatique toutes les 15 minutes des sorties en cours
- Déclenchement si une sortie dépasse 3 heures
- Destinataires : responsable de sortie + tous les `STAFF` et `ADMIN`
- Canaux : email + notification in-app
- Répétition toutes les 30 minutes tant que la sortie n'est pas clôturée

#### 4.3.2 Remarques

- Les remarques de sortie sont visibles par tous les membres authentifiés
- Affichage dans le détail de sortie mobile et web

---

## 5. Règles métier

| #     | Règle                                                                           |
| ----- | ------------------------------------------------------------------------------- |
| RG-01 | Un bateau ne peut pas avoir deux sorties en cours simultanément                 |
| RG-02 | L'heure de départ ne peut pas être dans le futur                                |
| RG-03 | L'heure de retour doit être strictement postérieure à l'heure de départ         |
| RG-04 | Seul le responsable peut clôturer sa sortie depuis mobile                       |
| RG-05 | `STAFF` et `ADMIN` peuvent clôturer n'importe quelle sortie depuis le web       |
| RG-06 | Un membre inactif ne peut pas se connecter ni être sélectionné dans un équipage |
| RG-07 | Un bateau hors service ne peut pas être sélectionné pour une nouvelle sortie    |
| RG-08 | Une alerte est déclenchée si une sortie dépasse 3 heures                        |
| RG-09 | Les alertes sont répétées toutes les 30 minutes jusqu'à clôture                 |
| RG-10 | La suppression d'un membre est logique et l'historique est conservé             |
| RG-11 | Les données de sortie sont conservées 10 ans minimum                            |
| RG-12 | Les distances planifiée/réelle ne peuvent pas être négatives                    |
| RG-13 | La taille d'équipage doit respecter la capacité du bateau                       |

---

## 6. Architecture technique

### 6.1 Vue d'ensemble

- Mobile : React Native (Expo)
- Web admin : React + Vite
- Backend API : NestJS (REST)
- Base de données : PostgreSQL 18.x (patch latest)
- Emails : Mailpit (local), Resend (production)

### 6.2 Backend - NestJS

- Langage : TypeScript
- Framework : NestJS
- API : REST JSON
- ORM : Drizzle
- Migrations : Drizzle
- Authentification : JWT access + refresh token
- Scheduler : NestJS Scheduler (process long-running)
- Documentation API : OpenAPI 3 / Swagger

### 6.3 Application web - React + Vite

- Framework : React (Vite)
- Langage : TypeScript
- UI : Tailwind CSS + shadcn/ui
- Authentification : access token en mémoire, refresh token en cookie `HttpOnly Secure`

### 6.4 Application mobile - React Native

- Framework : React Native (Expo)
- Langage : TypeScript
- Navigation : React Navigation
- État local : Zustand
- Stockage sécurisé des tokens : Secure Storage (ex: Expo SecureStore)

### 6.5 Environnement local

Exécution via Docker Compose avec les services suivants :

- `web-admin` (React + Vite)
- `api` (NestJS)
- `postgres` (PostgreSQL 18)
- `mailpit` (SMTP local + interface web)

Objectifs : démarrage rapide, environnement homogène pour toute l'équipe, test local complet de la boucle fonctionnelle.

### 6.6 Production

Déploiement cible MVP : VPS + Docker Compose.

- Services : reverse proxy TLS, `web-admin`, `api`, `postgres`
- Volumes persistants pour PostgreSQL
- Sauvegardes automatiques base de données
- Monitoring et centralisation des logs côté serveur

### 6.7 Plateformes alternatives (non retenues MVP)

- Vercel et Netlify peuvent héberger un backend via fonctions serverless.
- Ce mode n'est pas retenu pour le MVP afin de conserver un scheduler interne long-running.
- En cas de migration future vers serverless, les alertes devront être pilotées par cron externe.

### 6.8 Organisation du monorepo

Le projet est organisé en monorepo avec trois applications principales :

```txt
/
  backend/                  # API NestJS + logique métier + accès DB
  web/                      # Application web d'administration (React + Vite)
  app/                      # Application mobile (React Native Expo)
  docker-compose.dev.yml
  docker-compose.prod.yml
```

Règle de responsabilité :

- `backend/` expose l'API REST consommée par `web/` et `app/`.
- `web/` ne contient que l'interface d'administration.
- `app/` ne contient que l'expérience mobile rameur/staff.

---

## 7. Modèle de données

### 7.1 Entité `Member`

| Colonne         | Type         | Contrainte             | Description               |
| --------------- | ------------ | ---------------------- | ------------------------- |
| `id`            | UUID         | PK                     | Identifiant unique        |
| `first_name`    | VARCHAR(100) | NOT NULL               | Prénom                    |
| `last_name`     | VARCHAR(100) | NOT NULL               | Nom                       |
| `email`         | VARCHAR(255) | NOT NULL, UNIQUE       | Email de connexion        |
| `password_hash` | VARCHAR(255) | NOT NULL               | Mot de passe hashé        |
| `role`          | ENUM         | NOT NULL               | `ROWER`, `STAFF`, `ADMIN` |
| `is_active`     | BOOLEAN      | NOT NULL, DEFAULT TRUE | Statut actif/inactif      |
| `created_at`    | TIMESTAMPTZ  | NOT NULL               | Date de création          |
| `updated_at`    | TIMESTAMPTZ  | NOT NULL               | Date de modification      |
| `deleted_at`    | TIMESTAMPTZ  | NULLABLE               | Suppression logique       |

### 7.2 Entité `Boat`

| Colonne      | Type         | Contrainte             | Description                           |
| ------------ | ------------ | ---------------------- | ------------------------------------- |
| `id`         | UUID         | PK                     | Identifiant unique                    |
| `name`       | VARCHAR(100) | NOT NULL, UNIQUE       | Nom du bateau                         |
| `type`       | VARCHAR(50)  | NOT NULL               | Type (skiff, double, quatre, huit...) |
| `capacity`   | INTEGER      | NOT NULL               | Nombre de places                      |
| `condition`  | ENUM         | NOT NULL               | `GOOD`, `WATCH`, `MAINTENANCE`        |
| `is_active`  | BOOLEAN      | NOT NULL, DEFAULT TRUE | Disponible pour nouvelles sorties     |
| `notes`      | TEXT         | NULLABLE               | Notes libres                          |
| `created_at` | TIMESTAMPTZ  | NOT NULL               | Date de création                      |
| `updated_at` | TIMESTAMPTZ  | NOT NULL               | Date de modification                  |

### 7.3 Entité `Session`

| Colonne               | Type         | Contrainte               | Description                |
| --------------------- | ------------ | ------------------------ | -------------------------- |
| `id`                  | UUID         | PK                       | Identifiant unique         |
| `boat_id`             | UUID         | FK -> `Boat`, NOT NULL   | Bateau utilisé             |
| `responsible_id`      | UUID         | FK -> `Member`, NOT NULL | Responsable                |
| `departure_time`      | TIMESTAMPTZ  | NOT NULL                 | Heure de départ            |
| `return_time`         | TIMESTAMPTZ  | NULLABLE                 | Heure de retour            |
| `planned_distance_km` | DECIMAL(6,2) | NOT NULL                 | Distance prévue            |
| `actual_distance_km`  | DECIMAL(6,2) | NULLABLE                 | Distance réelle            |
| `route`               | TEXT         | NULLABLE                 | Parcours                   |
| `pre_remarks`         | TEXT         | NULLABLE                 | Remarques avant départ     |
| `post_remarks`        | TEXT         | NULLABLE                 | Remarques après retour     |
| `status`              | ENUM         | NOT NULL                 | `IN_PROGRESS`, `COMPLETED` |
| `created_at`          | TIMESTAMPTZ  | NOT NULL                 | Date de création           |
| `updated_at`          | TIMESTAMPTZ  | NOT NULL                 | Date de modification       |

### 7.4 Entité `SessionCrew`

Table de jointure entre sortie et équipage.

| Colonne      | Type | Contrainte                  | Description            |
| ------------ | ---- | --------------------------- | ---------------------- |
| `session_id` | UUID | FK -> `Session`, NOT NULL   | Sortie                 |
| `member_id`  | UUID | FK -> `Member`, NOT NULL    | Membre équipage        |
| PK           | -    | (`session_id`, `member_id`) | Clé primaire composite |

### 7.5 Entité `Alert`

| Colonne      | Type        | Contrainte                | Description        |
| ------------ | ----------- | ------------------------- | ------------------ |
| `id`         | UUID        | PK                        | Identifiant unique |
| `session_id` | UUID        | FK -> `Session`, NOT NULL | Sortie concernée   |
| `member_id`  | UUID        | FK -> `Member`, NOT NULL  | Destinataire       |
| `sent_at`    | TIMESTAMPTZ | NOT NULL                  | Date d'envoi       |
| `is_read`    | BOOLEAN     | NOT NULL, DEFAULT FALSE   | Lu/non lu          |
| `channel`    | ENUM        | NOT NULL                  | `IN_APP`, `EMAIL`  |

### 7.6 Entité `RefreshToken`

| Colonne      | Type         | Contrainte               | Description           |
| ------------ | ------------ | ------------------------ | --------------------- |
| `id`         | UUID         | PK                       | Identifiant unique    |
| `member_id`  | UUID         | FK -> `Member`, NOT NULL | Propriétaire          |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE         | Hash du refresh token |
| `expires_at` | TIMESTAMPTZ  | NOT NULL                 | Expiration            |
| `revoked_at` | TIMESTAMPTZ  | NULLABLE                 | Date de révocation    |
| `created_at` | TIMESTAMPTZ  | NOT NULL                 | Date de création      |

### 7.7 Entité `PasswordResetToken`

| Colonne      | Type         | Contrainte               | Description         |
| ------------ | ------------ | ------------------------ | ------------------- |
| `id`         | UUID         | PK                       | Identifiant unique  |
| `member_id`  | UUID         | FK -> `Member`, NOT NULL | Propriétaire        |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE         | Hash du token reset |
| `expires_at` | TIMESTAMPTZ  | NOT NULL                 | Expiration (1h)     |
| `used_at`    | TIMESTAMPTZ  | NULLABLE                 | Date d'utilisation  |
| `created_at` | TIMESTAMPTZ  | NOT NULL                 | Date de création    |

### 7.8 Entité `InvitationToken`

| Colonne      | Type         | Contrainte               | Description              |
| ------------ | ------------ | ------------------------ | ------------------------ |
| `id`         | UUID         | PK                       | Identifiant unique       |
| `member_id`  | UUID         | FK -> `Member`, NOT NULL | Propriétaire             |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE         | Hash du token invitation |
| `expires_at` | TIMESTAMPTZ  | NOT NULL                 | Expiration (48h)         |
| `used_at`    | TIMESTAMPTZ  | NULLABLE                 | Date d'utilisation       |
| `created_at` | TIMESTAMPTZ  | NOT NULL                 | Date de création         |

### 7.9 Contraintes DB et invariants

- Index unique partiel : une seule session `IN_PROGRESS` par `boat_id`
- `CHECK (return_time IS NULL OR return_time > departure_time)`
- `CHECK (planned_distance_km >= 0 AND (actual_distance_km IS NULL OR actual_distance_km >= 0))`
- Invariant session :
  - `status = IN_PROGRESS` implique `return_time IS NULL`
  - `status = COMPLETED` implique `return_time IS NOT NULL`
- Capacité équipage : validée côté logique applicative lors de la création/modification

---

## 8. Sécurité et authentification

### 8.1 Mécanisme

- Authentification email + mot de passe
- Access token JWT (`Authorization: Bearer <token>`) durée 24h
- Refresh token durée 30 jours
- Renouvellement via endpoint dédié

### 8.2 Rotation et révocation des refresh tokens

- Rotation à chaque `POST /auth/refresh` : émission d'un nouveau refresh token
- Révocation de l'ancien refresh token après rotation
- Révocation globale possible (déconnexion de toutes les sessions)

### 8.3 Stockage des tokens

- Mobile : stockage sécurisé (Secure Storage)
- Web : refresh token en cookie `HttpOnly`, `Secure`, `SameSite=Strict`

### 8.4 Invitation et réinitialisation

- Invitation membre : token à usage unique, validité 48h
- Mot de passe oublié : token à usage unique, validité 1h
- Les tokens sont stockés hashés en base

### 8.5 Contrôle d'accès

| Endpoint / action                      | `ROWER`           | `STAFF` | `ADMIN` |
| -------------------------------------- | ----------------- | ------- | ------- |
| `POST /sessions` (créer sortie)        | Oui               | Oui     | Oui     |
| `POST /sessions/:id/close` (sa sortie) | Oui               | Oui     | Oui     |
| Clôturer toute sortie (web admin)      | Non               | Oui     | Oui     |
| `GET /sessions/active`                 | Oui               | Oui     | Oui     |
| `GET /sessions/history`                | Oui (ses sorties) | Oui     | Oui     |
| `GET /stats/*`                         | Non               | Oui     | Oui     |
| Gestion membres                        | Non               | Non     | Oui     |
| Gestion bateaux                        | Non               | Non     | Oui     |
| Export CSV                             | Non               | Oui     | Oui     |
| Recevoir alertes sécurité              | Non               | Oui     | Oui     |

---

## 9. Notifications

### 9.1 Alerte de sécurité (sortie > 3h)

- Déclencheur : job NestJS Scheduler toutes les 15 minutes
- Condition : `status = IN_PROGRESS` et `departure_time < now() - interval '3 hours'`
- Destinataires : responsable + tous les `STAFF`/`ADMIN`
- Canaux :
  - Email (Resend en production, Mailpit en local)
  - Notification in-app (`Alert`)
- Répétition : toutes les 30 minutes tant que la session n'est pas clôturée

### 9.2 Idempotence et anti-duplication

- Chaque cycle de répétition est identifié par un créneau temporel de 30 minutes
- Pour un couple (`session_id`, `member_id`, `channel`, `slot_30_min`), un seul envoi est autorisé
- En cas de retry technique, aucun doublon fonctionnel ne doit être créé

### 9.3 Autres emails transactionnels

- Invitation membre
- Réinitialisation de mot de passe

---

## 10. Conservation des données

- Conservation minimale des sorties : 10 ans
- Suppression des membres : logique (`deleted_at`), historique conservé
- Sorties de plus de 3 ans : archivées et masquées par défaut (filtre "Archives")
- RGPD :
  - Sur demande, anonymisation des données personnelles au lieu de suppression brute
  - Nom/prénom remplacés par valeur neutre (ex: `Membre supprimé`)
  - Email remplacé par un email pseudonymisé unique (ex: `deleted+<uuid>@anon.invalid`) pour préserver les contraintes d'unicité

---

## 11. Hors périmètre MVP (V2)

- Mode hors-ligne complet
- Tracé GPS des sorties
- Gestion de parcours prédéfinis
- Import en masse des membres
- Multi-club (multi-tenant)
- Intégration fédération/tiers

---

## 12. Interfaces API MVP

### 12.1 Sessions

- `GET /sessions/active`
- `POST /sessions`
- `POST /sessions/:id/close`
- `GET /sessions/history` (scope par défaut pour `ROWER` : ses sorties)

### 12.2 Statistiques

- `GET /stats/overview`
- `GET /stats/rowers`
- `GET /stats/boats`

Accès : `STAFF`, `ADMIN`.

### 12.3 Authentification

- `POST /auth/login`
- `POST /auth/refresh` (rotation de refresh token)
- `POST /auth/logout`
- `POST /auth/invitations/accept`
- `POST /auth/password/reset/request`
- `POST /auth/password/reset/confirm`

### 12.4 Types et enums clés

- Session status : `IN_PROGRESS`, `COMPLETED`
- Alert channel : `IN_APP`, `EMAIL`
- Role : `ROWER`, `STAFF`, `ADMIN`

---

## 13. Tests et critères d'acceptation

### 13.1 RBAC

- Un `ROWER` est refusé sur `GET /stats/*`
- Un `ROWER` ne voit que son historique mobile

### 13.2 Métier

- Impossible de créer 2 sorties en cours pour un même bateau
- Clôture refusée si `return_time <= departure_time`
- Un membre inactif ne peut pas se connecter ni être ajouté à un équipage
- Un bateau hors service n'est pas sélectionnable

### 13.3 Alertes

- Déclenchement vérifié au-delà de 3h
- Répétition toutes les 30 minutes jusqu'à clôture
- Aucun doublon dans un même créneau de 30 minutes

### 13.4 Infrastructure

- Docker Compose local démarre la stack complète
- Le comportement fonctionnel en production VPS est identique au local

---

## 14. Hypothèses techniques

- PostgreSQL ciblé : branche `18.x` avec patch latest
- Production MVP : VPS + Docker Compose
- Si migration vers Vercel/Netlify serverless : remplacement du scheduler interne par un déclencheur cron externe
