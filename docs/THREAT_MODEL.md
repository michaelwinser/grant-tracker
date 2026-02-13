# Threat Model: Grant Tracker

This document provides a comprehensive threat model for the Grant Tracker project. Its purpose is to assist developers and AIs in evaluating security risks, prioritizing remediation, and developing robust mitigation strategies.

## 1. System Overview

Grant Tracker is a Svelte 5 PWA designed for managing grants. It is currently transitioning from a purely client-side architecture to a service account-based backend architecture.

### 1.1 Current Architecture (Client-Side)
- **Frontend**: Svelte 5 PWA hosted on GitHub Pages.
- **Data Storage**: Google Sheets and Google Drive (User's Workspace).
- **Authentication**: Client-side Google OAuth 2.0.
- **Authorization**: Individual user OAuth tokens with `drive.file` and `spreadsheets` scopes.

### 1.2 Target Architecture (Service Account)
- **Frontend**: Svelte 5 PWA.
- **Backend API**: Go/Cloud Run serving as a proxy to Google APIs.
- **Data Storage**: Google Sheets and Google Drive (Dedicated Service Account Workspace/Folder).
- **Authentication**: User OAuth for identity verification.
- **Authorization**: Drive permissions for access control, executed via a Service Account.

## 2. Data Flow

### 2.1 User Interaction Flow
1. User authenticates via Google OAuth (Browser -> Google).
2. PWA receives Identity Token (Google -> Browser).
3. PWA calls Backend API with session cookie (Browser -> Backend).
4. Backend verifies session and checks Drive Folder access using User's Identity Token (Backend -> Google Drive).
5. If authorized, Backend executes operation using Service Account (Backend -> Google Sheets/Drive).
6. Result returned to PWA (Backend -> Browser).

### 2.2 GitHub Action Flow
1. Developer pushes to Grantee Repo (Developer -> GitHub).
2. GitHub Action triggers on push to `reports/**`.
3. Action authenticates to Google using `GOOGLE_SERVICE_ACCOUNT` secret.
4. Action calls Sheets API to update report status (GitHub Action -> Google Sheets).

## 3. Assets

| Asset ID | Asset Name | Description | Sensitivity |
|----------|------------|-------------|-------------|
| A-1 | Grant Data | Information stored in Google Sheets (titles, amounts, status, contacts). | High |
| A-2 | Documents | Proposal documents and internal notes stored in Google Drive. | High |
| A-3 | User Identity | User email and profile information. | Medium |
| A-4 | OAuth Tokens | User-specific OAuth access and refresh tokens. | High |
| A-5 | Service Account Key | Private key for the Google Cloud Service Account. | Critical |
| A-6 | App Config | Spreadsheet IDs, folder IDs, and environment variables. | Medium |

## 4. Trust Boundaries

- **TB-1: User Browser vs. Internet**: Protected by TLS 1.2+.
- **TB-2: User Browser vs. GitHub Pages**: Trusting GitHub's CDN and build process.
- **TB-3: PWA/Backend vs. Google APIs**: Protected by OAuth 2.0 and API Keys/Service Accounts.
- **TB-4: User vs. PWA**: The application assumes the user is an authorized team member.
- **TB-5: PWA vs. Backend API**: Boundaries enforced via secure session cookies and CSRF protection.
- **TB-6: GitHub Actions vs. Backend**: Boundary between external repo and internal data.

## 5. Threat Analysis (STRIDE)

### 5.1 Spoofing (S)
- **T-1: Session Hijacking**: An attacker steals a user's session cookie to impersonate them.
- **T-2: Fake GitHub Action**: An attacker creates a look-alike repo to send false "report received" updates.
- **T-3: Token Theft**: Theft of the user's OAuth refresh token from local storage.

### 5.2 Tampering (T)
- **T-4: Direct Spreadsheet Edit**: A user with Sheet access bypasses the PWA to delete or corrupt data.
- **T-5: Request Manipulation**: Manipulating the `sheet` or `range` parameters in backend API calls.
- **T-6: Man-in-the-Middle (MITM)**: Intercepting traffic if TLS is compromised.

### 5.3 Repudiation (R)
- **T-7: Service Account Anonymity**: Since the Service Account performs all writes, it's unclear *which* human user initiated a change.
- **T-8: Log Deletion**: An attacker with GCP access deletes Cloud Logging records to hide their tracks.

### 5.4 Information Disclosure (I)
- **T-9: Cleartext Keys**: Service account keys stored in the repository or insecure environment variables.
- **T-10: Doc URL Leakage**: Sharing URLs to internal docs in public channels.
- **T-11: Improper Scopes**: Granting `drive.readonly` instead of `drive.file`, exposing all files in the user's Drive.

### 5.5 Denial of Service (D)
- **T-12: API Rate Limiting**: Maliciously triggering enough requests to exceed Google's 100 requests per 100 seconds quota.
- **T-13: Backend Flooding**: Hammering the Cloud Run endpoint to increase costs or cause timeout.

### 5.6 Elevation of Privilege (E)
- **T-14: Directory Traversal (Drive)**: Using the API to access folders outside the designated root.
- **T-15: Logic Flaw in Auth Check**: A bug in `requireDriveAccess` middleware that returns `true` for unauthorized users.

## 5. Risk Assessment & Mitigation

| Threat ID | Likelihood | Impact | Risk Level | Mitigation Strategy |
|-----------|------------|--------|------------|---------------------|
| T-1 | Low | High | Medium | Enforced Google OAuth 2.0; Check against team allowlist/Drive permissions. |
| T-4 | Medium | High | High | Use Google Sheets Tables for validation; Scheduled audit of Sheet vs. app logs. |
| T-6 | Low | Critical | High | Use Secret Manager or Workload Identity; Regular key rotation. |
| T-7 | Medium | High | High | Automated folder/doc creation with strict permissions; Periodic permission audits. |
| T-11 | Low | High | Medium | Strict backend validation; Drive access verification on every API call. |

## 6. Security Recommendations

1. **Implement Audit Logging**: Ensure every write operation through the Service Account is logged with the original user's email.
2. **Permission Least-Privilege**: Ensure the Service Account and User Scopes are the absolute minimum required.
3. **Secure Secrets**: Strictly prohibit the storage of JSON keys in source control.
4. **Regular Audits**: Periodically check Drive folder permissions to ensure internal notes haven't been shared externally.
5. **CSRF Protection**: Implement CSRF tokens on all state-changing backend endpoints.
