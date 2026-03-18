# 3D Pipeline Tracker (Hanuman Tracker)

A high-performance, cinematic 3D production tracking dashboard built with **Next.js 16**, **React 19**, and **Tailwind CSS v4**. This application is designed to manage complex 3D asset workflows with precision, automation, and deep team intelligence.

## 🚀 Key Features

### 1. Master Asset Library (The Vault)
*   **Gatekept Production**: A centralized inventory for all Characters, Props, Weapons, and Vehicles.
*   **Ready-to-Release Logic**: Assets can only enter the production pipeline once marked as "Ready" and associated with a master source link.
*   **Source Control**: Unified management of Concept Art and T-Pose drive links.

### 2. Dynamic Production Pipeline
*   **Custom Character Stages**: Add unique milestones (e.g., "Rigging", "Fur Sim") at the individual character level.
*   **Visual Reordering**: Drag or move pipeline stages left/right to customize the sequence for specific asset requirements.
*   **Smart Dependencies**: Automatic logic ensures stages are approved in the correct sequence before the next can proceed.

### 3. Precision Review System
*   **Standard Reviews**: Fast "Approve" or "Rework" actions for Base input, Grey scale Model, and Texture stages.
*   **Split Final Package Review**: Concurrent review paths for **Model & Texture** and **Rig & Animation** leads.
*   **Feedback Persistence**: Full version history with timestamps, reviewer notes, and external documentation links.

### 4. Team & Analytics Intelligence
*   **Global Team Metrics**: Deep-dive performance table showing workload, involvement, on-time delivery rates, and reworks for every team member.
*   **Reviewer Intelligence**: Detailed breakdown of reviewer efficiency and recent feedback patterns.
*   **Production Velocity**: Automated tracking of pipeline efficiency and milestone event logs.

### 5. Smart Automations
*   **Slack Integration**: Automated notifications for assignments, approvals, and rework requests.
*   **Redundancy Protection**: Smart logic to combine notifications if a user holds multiple roles (e.g., Artist + Ops Lead).
*   **Dynamic Deadlines**: Automatically calculates next-stage expected dates based on previous milestone approvals.

## 🛠 Tech Stack

*   **Framework**: Next.js 16.1.6 (App Router)
*   **Library**: React 19.2.3
*   **Styling**: Tailwind CSS v4 (Cinematic Glass Aesthetic)
*   **Database**: Firebase Firestore (Live Sync)
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

## 🏗 Data Architecture

*   `assets`: Master inventory and active production states.
*   `versions`: Atomic history of every upload and review event.
*   `team_members`: User profiles, roles, and expertise mapping.

## 📄 License

Private Project - All Rights Reserved.
