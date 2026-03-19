# 3D Pipeline Tracker (Hanuman Tracker)

A high-performance, cinematic 3D production tracking dashboard built with **Next.js 16**, **React 19**, and **Tailwind CSS v4**. This application is designed to manage complex 3D asset workflows with precision, automation, and deep team intelligence.

## 🚀 Key Features

### 1. Master Asset Library (The Vault)
*   **Gatekept Production**: A centralized inventory for all Characters, Props, Weapons, and Vehicles.
*   **Ready-to-Release Logic**: Assets can only enter the production pipeline once marked as "Ready" and associated with a master source link.
*   **Source Control**: Unified management of Concept Art and T-Pose drive links.
*   **Variation Management**: Easily register nested variations from any main asset in the library.

### 2. Dynamic Production Pipeline
*   **Custom Character Stages**: Add unique milestones (e.g., "Rigging", "Fur Sim") at the individual character level (Admin restricted).
*   **Visual Reordering**: Drag or move pipeline stages left/right to customize the sequence for specific asset requirements.
*   **Variation Intelligence**: Variations are visually distinguished with a signature **Indigo Theme** and automatically maintain context with their "Main Asset" across notifications and UI.
*   **Automated Release SLA**: Releasing an asset from the vault automatically initializes a 48-hour "Base Input" timer, ensuring consistent production turnaround.

### 3. Precision Review & Routing System
*   **Intelligent Round-Robin Assignment**: Reviewers are automatically assigned via a logic-based rotation that considers their active status, assigned stages, and specific expertise.
*   **Specialized Expertise Matrix**: Reviewers are categorized by domain (e.g., "Model/Texture" vs. "Rig/Animation") for specialized Final Package reviews.
*   **Standard Reviews**: Fast "Approve" or "Rework" actions for Base input, Grey scale Model, and Texture stages.
*   **Split Final Package Review**: Concurrent review paths for Model & Texture and Rig & Animation leads with combined vendor reporting.
*   **Director's Master Approval (RM Locked)**: A final approval stage for Rajesh Mapuskar (Director) that officially locks the asset and notifies the full team channel.

### 4. Operations & System Timeline
*   **Automated Daily Ops (Timeline)**: A centralized, searchable, and filterable log of every production event—uploads, reviews, and notifications—providing a complete system history at `/tasks`.
*   **Studio & Priority Orchestration**: Track assets by Studio source (Xentrix, Innovative Colors, Inhouse) and Priority levels (Primary/Secondary) for better pipeline prioritization.

### 5. Team & Analytics Intelligence
*   **Temporal Analytics**: Full date-filtering capability allows for deep-dive reporting on specific production days or "All Time" velocity.
*   **Production Power**: A quantitative score that measures contribution based on complexity weights (e.g., Character = 10 pts, Prop = 3 pts).
*   **Agility & Turnaround**: Individual speed tracking measuring hours-to-action for artists, reviewers, and Ops (Vendor Notification).

### 6. Security & Control Center
*   **Admin Mode**: A secret password-protected "Lock" system. Critical actions like deleting pipelines, adding library assets, or reordering stages are restricted to authorized users.
*   **Granular Slack Management**: Global and individual notification toggles in Team Management to manage "Slack noise" without stopping production.
*   **Production Reset**: Safe "Stop Production" logic that clears pipeline data and history for a character and all its variations while preserving the master library entry.

### 7. Smart Automations
*   **CORS-Bypassing Slack Integration**: Reliable notifications dispatched directly from the browser using "Simple Request" payload encoding (Spark-plan compatible).
*   **Vendor Reminders**: Automated 60-minute timers for Ops members to notify vendors once feedback or approvals are logged.
*   **Role-Based Alerting**: Targeted notifications ensure Artists receive rework notes, while Ops members handle vendor-facing instructions.

## 🛠 Tech Stack

*   **Framework**: Next.js 16.1.6 (App Router)
*   **Library**: React 19.2.3
*   **Styling**: Tailwind CSS v4 (Cinematic Glass Aesthetic)
*   **Database**: Firebase Firestore (Live Sync)
*   **Hosting**: Firebase Hosting
*   **Animations**: Framer Motion
*   **Icons**: Lucide React
*   **Charts**: Recharts

## 📋 Setup & Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/prajwal-galleri5/CH_3D_pipeline_tracker.git
    cd CH_3D_pipeline_tracker/hanuman-tracker
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    NEXT_PUBLIC_SLACK_WEBHOOK_URL=your_webhook
    ```

4.  **Run the development server**:
    ```bash
    npm run dev
    ```

5.  **Build & Deploy**:
    ```bash
    npm run build
    firebase deploy
    ```

## 🏗 Data Architecture

*   **assets**: Master inventory and active production states.
*   **versions**: Atomic history of every upload and review event.
*   **team_members**: User profiles, roles, expertise, and notification preferences.
*   **settings**: Global application configurations (e.g., Slack Master Toggle).

## 📄 License

Private Project - All Rights Reserved.
