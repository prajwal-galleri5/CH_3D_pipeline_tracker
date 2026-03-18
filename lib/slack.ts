"use server";

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { TeamMember } from "@/types";

const SLACK_WEBHOOK_URL = process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;

export async function sendSlackNotification(message: string, personSlackId?: string) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("Slack Webhook URL not found. Skipping notification.");
    return;
  }

  const finalMessage = personSlackId ? `<@${personSlackId}> ${message}` : message;

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: finalMessage }),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error sending Slack notification:", error);
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
    const teamRef = collection(db, "team_members");
    // Firebase 'in' operator supports up to 10 items.
    const q = query(teamRef, where("name", "in", trimmedNames));
    const snap = await getDocs(q);
    
    const notifications: Promise<void>[] = [];
    snap.forEach(docSnap => {
      const member = docSnap.data() as TeamMember;
      if (member.slackId && member.active) {
        notifications.push(sendSlackNotification(message, member.slackId));
      }
    });
    
    await Promise.all(notifications);
  } catch (error) {
    console.error("Error notifying artists by name:", error);
  }
}
