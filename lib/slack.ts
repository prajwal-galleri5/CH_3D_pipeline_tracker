"use client";

import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { TeamMember, GlobalSettings } from "@/types";

const SLACK_WEBHOOK_URL = process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;

export async function sendSlackNotification(message: string, personSlackId?: string) {
  if (!SLACK_WEBHOOK_URL) {
    console.log("Slack Setup: Webhook URL not found. Notification skipped.");
    return;
  }

  try {
    // Check Global Toggle
    const settingsRef = doc(db, "settings", "app_settings");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      const settings = settingsSnap.data() as GlobalSettings;
      if (settings.slackNotificationsEnabled === false) {
        console.log("Slack Global: Notifications are disabled in settings.");
        return;
      }
    }

    const finalMessage = personSlackId ? `<@${personSlackId}> ${message}` : message;

    const body = new URLSearchParams();
    body.append('payload', JSON.stringify({ text: finalMessage }));

    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    console.log("Slack Dispatch: Notification sent successfully.");
  } catch (error) {
    console.error("Slack Error: Failed to send notification.", error);
  }
}

/**
 * Helper to notify multiple artists by their names.
 * Fetches their Slack IDs from Firestore and sends notifications.
 */
export async function notifyArtistsByName(artistNames: string[], message: string) {
  if (!artistNames || artistNames.length === 0) return;
  
  const trimmedNames = artistNames.map(n => n.trim()).filter(Boolean);
  if (trimmedNames.length === 0) return;

  try {
    console.log("Slack Lookup: Finding IDs for:", trimmedNames);
    const teamRef = collection(db, "team_members");
    const q = query(teamRef, where("name", "in", trimmedNames));
    const snap = await getDocs(q);
    
    console.log(`Slack Lookup: Found ${snap.size} members.`);
    
    const notifications: Promise<void>[] = [];
    snap.forEach(docSnap => {
      const member = docSnap.data() as TeamMember;
      // Respect individual toggle
      if (member.slackId && member.active && member.slackEnabled !== false) {
        console.log(`Slack Dispatch: Notifying ${member.name} (${member.slackId})`);
        notifications.push(sendSlackNotification(message, member.slackId));
      } else if (member.slackEnabled === false) {
        console.log(`Slack Dispatch: Skipped ${member.name} (Individual toggle OFF)`);
      }
    });
    
    await Promise.all(notifications);
  } catch (error) {
    console.error("Slack Error: Lookup failed.", error);
  }
}
