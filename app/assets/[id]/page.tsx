"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, Version, VersionStage, VersionStatus, AssetStatus, TeamMember } from "@/types";
import { ArrowLeft, ExternalLink, FileText, CheckCircle, XCircle, Clock, Plus, Edit2, Save, Activity, LayoutGrid, Zap, Trash2, Lock, AlertCircle, X, Calendar, User as UserIcon, MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { notifyArtistsByName, sendSlackNotification } from "@/lib/slack";

export default function AssetDetails() {
  const params = useParams();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Asset>>({});

  // Team State
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Version Management State
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [versionEditData, setVersionEditData] = useState<Partial<Version>>({});
  
  const [newStage, setNewStage] = useState<VersionStage>("Base input");
  const [newDriveLink, setNewDriveLink] = useState("");
  const [reviewNoteId, setReviewNoteId] = useState<string | null>(null);
  const [activeReviewSide, setActiveReviewSide] = useState<'Model' | 'Rig' | null>(null);
  const [reviewLink, setReviewLink] = useState("");
  const [reviewTextNote, setReviewTextNote] = useState("");
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [selectedReviewerRigId, setSelectedReviewerRigId] = useState("");
  const [modelStatus, setModelStatus] = useState<VersionStatus>("Pending Review");
  const [rigStatus, setRigStatus] = useState<VersionStatus>("Pending Review");

  const fetchAssetAndVersions = async () => {
    if (!assetId) return;
    try {
      const docRef = doc(db, "assets", assetId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Asset;
        setAsset(data);
        setEditData({
          ...data,
          assignedArtists: (data.assignedArtists || []) as any
        });
      }

      // Fetch versions
      const qv = query(collection(db, "versions"), where("assetId", "==", assetId));
      const versionsSnap = await getDocs(qv);
      const fetchedVersions: Version[] = [];
      versionsSnap.forEach((d) => {
        fetchedVersions.push({ id: d.id, ...d.data() } as Version);
      });
      fetchedVersions.sort((a, b) => b.createdAt - a.createdAt);
      setVersions(fetchedVersions);

      // Fetch team members
      const qt = query(collection(db, "team_members"), where("active", "==", true));
      const teamSnap = await getDocs(qt);
      const fetchedTeam: TeamMember[] = [];
      teamSnap.forEach((d) => {
        fetchedTeam.push({ id: d.id, ...d.data() } as TeamMember);
      });
      setTeamMembers(fetchedTeam);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getNextReviewer = async (stage: VersionStage, role: 'Model' | 'Rig' | 'Lead' = 'Lead') => {
    // 1. Get eligible active reviewers for this stage and role
    const eligible = teamMembers
      .filter(m => {
        if (!m.active || m.role !== 'Reviewer') return false;
        const stageMatch = !m.reviewerStages || m.reviewerStages.includes(stage);
        if (!stageMatch) return false;

        if (stage === 'Final Package') {
          if (role === 'Model') return m.reviewerExpertise?.includes('Model/Texture');
          if (role === 'Rig') return m.reviewerExpertise?.includes('Rig/Animation');
        }
        return true;
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    if (eligible.length === 0) return null;

    // 2. Query Firestore for the last assigned reviewer in this stage context
    const qv = query(
      collection(db, "versions"), 
      where("stage", "==", stage),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    try {
      const vSnap = await getDocs(qv);
      let lastId = "";
      
      const field = stage === 'Final Package' 
        ? (role === 'Model' ? 'reviewerModelId' : (role === 'Rig' ? 'reviewerRigId' : 'reviewerId'))
        : 'reviewerId';

      for (const dSnap of vSnap.docs) {
        const data = dSnap.data();
        if (data[field]) {
          lastId = data[field];
          break;
        }
      }

      if (!lastId) return eligible[0];

      const lastIdx = eligible.findIndex(m => m.id === lastId);
      const nextIdx = (lastIdx + 1) % eligible.length;
      return eligible[nextIdx];
    } catch (e) {
      console.warn("Firestore index for round robin might be missing.", e);
      return eligible[0];
    }
  };

  const getNextOpsMember = async () => {
    const eligible = teamMembers
      .filter(m => m.active && m.role === 'Ops')
      .sort((a, b) => a.id.localeCompare(b.id));

    if (eligible.length === 0) return null;

    // Simplified rotation based on timestamp seconds
    const seconds = Math.floor(Date.now() / 1000);
    return eligible[seconds % eligible.length];
  };

  useEffect(() => {
    fetchAssetAndVersions();
  }, [assetId]);

  // Sync main asset status based on version states
  const syncAssetStatus = async (currentVersions: Version[]) => {
    if (!assetId || !asset) return;
    
    const defaultPipeline = ["Base input", "Grey scale Model(1st pass)", "Texture", "Final Package"];
    const pipeline = asset.pipelineOrder || [...defaultPipeline, ...(asset.extraStages || [])];
    
    let newStatus: AssetStatus = "Not Started";
    
    // Find latest active stage by checking versions from end of pipeline
    for (let i = pipeline.length - 1; i >= 0; i--) {
      const stageName = pipeline[i];
      const stageVersions = currentVersions.filter(v => v.stage === stageName);
      if (stageVersions.length > 0) {
        if (stageName === "Final Package") {
          const isApproved = stageVersions[0].status === "Approved";
          newStatus = isApproved ? "Approved" : "Final Review";
        } else {
          newStatus = stageName as AssetStatus;
        }
        break;
      }
    }

    // Sync Milestone Flags and Dates
    const anyRefSent = currentVersions.some(v => v.refSent === "Yes");
    
    const latestVersion = currentVersions[0];
    const outcome = latestVersion?.status === "Approved" ? "Approved" : (latestVersion?.status === "Corrections Needed" ? "Rework" : "");

    const updateObj: any = {
      status: newStatus,
      refSent: anyRefSent ? "Yes" : "No",
      finalReviewOutcome: outcome,
      updatedAt: Date.now(),
      // Specific Approval Checks (dynamic)
      bmApproved: currentVersions.some(v => v.stage === "Base input" && v.status === "Approved"),
      fpApproved: currentVersions.some(v => v.stage === "Grey scale Model(1st pass)" && v.status === "Approved"),
      gsApproved: currentVersions.some(v => v.stage === "Texture" && v.status === "Approved"),
      finalApproved: currentVersions.some(v => v.stage === "Final Package" && v.status === "Approved"),
      
      // Re-derive Granular Review Timestamps
      bmReviewedAt: currentVersions.find(v => v.stage === "Base input" && v.reviewedAt)?.reviewedAt || null,
      fpReviewedAt: currentVersions.find(v => v.stage === "Grey scale Model(1st pass)" && v.reviewedAt)?.reviewedAt || null,
      gsReviewedAt: currentVersions.find(v => v.stage === "Texture" && v.reviewedAt)?.reviewedAt || null,
      finalReviewedAt: currentVersions.find(v => v.stage === "Final Package" && v.reviewedAt)?.reviewedAt || null,
      finalReviewedAtModel: currentVersions.find(v => v.stage === "Final Package" && v.reviewedAtModel)?.reviewedAtModel || null,
      finalReviewedAtRig: currentVersions.find(v => v.stage === "Final Package" && v.reviewedAtRig)?.reviewedAtRig || null
    };

    // Re-derive Milestone Dates
    const baseV = currentVersions.filter(v => v.stage === "Base input");
    if (baseV.length > 0) updateObj.inputCompletedDate = new Date(baseV[baseV.length - 1].createdAt).toISOString().split('T')[0];
    
    const fpV = currentVersions.filter(v => v.stage === "Grey scale Model(1st pass)");
    if (fpV.length > 0) {
      updateObj.firstPassReceived = "Yes";
      updateObj.firstPassReceivedDate = new Date(fpV[fpV.length - 1].createdAt).toISOString().split('T')[0];
    }
    
    const texV = currentVersions.filter(v => v.stage === "Texture");
    if (texV.length > 0) {
      updateObj.reviewed = "Yes";
      updateObj.reviewedDate = new Date(texV[texV.length - 1].createdAt).toISOString().split('T')[0];
    }

    const finalV = currentVersions.filter(v => v.stage === "Final Package");
    if (finalV.length > 0) updateObj.finalVersionReceivedDate = new Date(finalV[finalV.length - 1].createdAt).toISOString().split('T')[0];

    await updateDoc(doc(db, "assets", assetId), updateObj);
    setAsset(prev => prev ? ({ ...prev, ...updateObj }) : null);
  };

  // Granular Workflow Logic
  const getActionPermissions = (version: Version) => {
    const stageVersions = versions.filter(v => v.stage === version.stage);
    const isLatest = stageVersions.length > 0 && stageVersions[0].id === version.id;

    const defaultPipeline = ["Base input", "Grey scale Model(1st pass)", "Texture", "Final Package"];
    const pipeline = asset?.pipelineOrder || [...defaultPipeline, ...(asset?.extraStages || [])];
    const stageIndex = pipeline.indexOf(version.stage);

    let dependencyMet = true;
    let dependencyReason = "";

    if (stageIndex > 0) {
      const prevStage = pipeline[stageIndex - 1];
      const prevApproved = versions.some(v => v.stage === prevStage && v.status === "Approved");
      if (!prevApproved) {
        dependencyMet = false;
        dependencyReason = `Approve ${prevStage} first`;
      }
    }

    return {
      canChangeStatus: isLatest && dependencyMet,
      canEditLinks: true, 
      reason: !dependencyMet ? dependencyReason : (!isLatest ? "Newer available" : "")
    };
  };

  const handleUpdateAsset = async () => {
    if (!assetId || !asset) return;
    try {
      const updatePayload: any = { ...editData };
      delete updatePayload.id;
      
      // Automation: Vendor Notified logic
      if (editData.vendorNotified === "Yes" && asset.vendorNotified !== "Yes") {
        updatePayload.vendorActionDueAt = null;
        updatePayload.vendorNotifiedDate = new Date().toISOString().split('T')[0];
        
        // Granular Timestamps
        const latestVersion = versions[0];
        if (latestVersion?.stage === 'Base input') updatePayload.bmNotifiedAt = Date.now();
        else if (latestVersion?.stage === 'Grey scale Model(1st pass)') updatePayload.fpNotifiedAt = Date.now();
        else if (latestVersion?.stage === 'Texture') updatePayload.gsNotifiedAt = Date.now();
        else if (latestVersion?.stage === 'Final Package') updatePayload.finalNotifiedAt = Date.now();

        // Rule: Once vendor notified of Grey scale Model(1st pass) approval, Texture expected in T + 2 Days
        if (latestVersion?.stage === 'Grey scale Model(1st pass)' && latestVersion?.status === 'Approved') {
          const in2Days = new Date();
          in2Days.setDate(in2Days.getDate() + 2);
          updatePayload.greyScaleExpectedDate = in2Days.toISOString().split('T')[0];
        }
      }

      if (typeof updatePayload.assignedArtists === 'string') {
        updatePayload.assignedArtists = updatePayload.assignedArtists.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      await updateDoc(doc(db, "assets", assetId), {
        ...updatePayload,
        updatedAt: Date.now()
      });
      
      // Slack Notification for newly added artists
      const oldArtists = asset.assignedArtists || [];
      const newArtists = updatePayload.assignedArtists || [];
      const addedArtists = newArtists.filter(a => !oldArtists.includes(a));
      
      if (addedArtists.length > 0) {
        await notifyArtistsByName(
          addedArtists,
          `you have been assigned to asset: *${asset.name}* (${asset.studio}).`
        );
      }

      setIsEditing(false);
      fetchAssetAndVersions();
    } catch (err) {
      console.error("Update failed", err);
      alert("Failed to save changes.");
    }
  };

  const handleDeleteAsset = async () => {
    if (!asset) return;
    const confirmName = prompt(`To delete this character, please type its name: "${asset.name}"`);
    if (confirmName !== asset.name) {
      if (confirmName !== null) alert("Name does not match. Deletion cancelled.");
      return;
    }

    try {
      setLoading(true);
      // Delete versions associated with this asset
      const qv = query(collection(db, "versions"), where("assetId", "==", assetId));
      const versionsSnap = await getDocs(qv);
      const deletePromises = versionsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // Delete the asset itself
      await deleteDoc(doc(db, "assets", assetId));
      window.location.href = "/";
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete character.");
      setLoading(false);
    }
  };

  const handleAddVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriveLink || !asset) return;

    const nextVersionNumber = versions.filter(v => v.stage === newStage).length + 1;

    // Round Robin Assignment
    let reviewerId = "";
    let reviewerModelId = "";
    let reviewerRigId = "";

    const reviewersToNotify: TeamMember[] = [];

    if (newStage === 'Final Package') {
      const modelRev = await getNextReviewer(newStage, 'Model');
      const rigRev = await getNextReviewer(newStage, 'Rig');
      if (modelRev) {
        reviewerModelId = modelRev.id;
        reviewersToNotify.push(modelRev);
      }
      if (rigRev) {
        reviewerRigId = rigRev.id;
        if (rigRev.id !== modelRev?.id) reviewersToNotify.push(rigRev);
      }
    } else {
      const leadRev = await getNextReviewer(newStage, 'Lead');
      if (leadRev) {
        reviewerId = leadRev.id;
        reviewersToNotify.push(leadRev);
      }
    }

    const newVersion: any = {
      assetId,
      stage: newStage,
      versionNumber: nextVersionNumber,
      driveLink: newDriveLink,
      reviewNoteLink: "",
      status: "Pending Review" as VersionStatus,
      createdAt: Date.now(),
      reviewerId,
      reviewerModelId,
      reviewerRigId
    };

    // Calculate Review Deadline (Hourly rules)
    let reviewHours = 2;
    if (newStage === 'Grey scale Model(1st pass)') reviewHours = 3;
    else if (newStage === 'Texture') reviewHours = 4;
    else if (newStage === 'Final Package') reviewHours = 6;

    const reviewDueAt = Date.now() + (reviewHours * 60 * 60 * 1000);

    const docRef = await addDoc(collection(db, "versions"), newVersion);
    const fullNewVersion = { ...newVersion, id: docRef.id } as Version;
    
    const assetUpdate: any = {
      reviewDueAt,
      updatedAt: Date.now()
    };

    if (newStage === 'Base input') assetUpdate.bmUploadedAt = Date.now();
    else if (newStage === 'Grey scale Model(1st pass)') assetUpdate.fpUploadedAt = Date.now();
    else if (newStage === 'Texture') assetUpdate.gsUploadedAt = Date.now();
    else if (newStage === 'Final Package') assetUpdate.finalUploadedAt = Date.now();

    await updateDoc(doc(db, "assets", assetId), assetUpdate);

    await syncAssetStatus([fullNewVersion, ...versions]);

    // Slack Notifications for Reviewers
    for (const rev of reviewersToNotify) {
      if (rev.slackId) {
        const roleMsg = newStage === 'Final Package' 
          ? (rev.id === reviewerModelId ? '(Model & Texture)' : '(Rig & Anim)')
          : '';
          
        await sendSlackNotification(
          `New package uploaded for *${asset.name}* (Stage: ${newStage} ${roleMsg}). Please review: ${newDriveLink}`,
          rev.slackId
        );
      }
    }

    setShowVersionForm(false);
    setNewDriveLink("");
    fetchAssetAndVersions();
  };

  const handleMarkSent = async (version: Version) => {
    if (version.status !== 'Approved') return;
    if (!asset) return;

    try {
      const emailLink = prompt("Enter the link to the sent email (Optional):") || "";
      
      const versionUpdate = {
        refSent: "Yes" as const,
        emailLink: emailLink
      };

      await updateDoc(doc(db, "versions", version.id), versionUpdate);

      // Automation logic moved here from handleUpdateVersion
      const assetUpdate: any = { 
        updatedAt: Date.now(),
        vendorActionDueAt: null // Clear timer
      };

      // Set timestamps for timeline
      if (version.stage === 'Base input') assetUpdate.bmNotifiedAt = Date.now();
      else if (version.stage === 'Grey scale Model(1st pass)') assetUpdate.fpNotifiedAt = Date.now();
      else if (version.stage === 'Texture') assetUpdate.gsNotifiedAt = Date.now();
      else if (version.stage === 'Final Package') assetUpdate.finalNotifiedAt = Date.now();

      // Rule: Once base model/reference is sent, Grey scale Model(1st pass) is expected in T + 3 Days
      if (version.stage === 'Base input') {
        const fpExpected = new Date();
        fpExpected.setDate(fpExpected.getDate() + 3);
        assetUpdate.firstPassExpectedDate = fpExpected.toISOString().split('T')[0];
        assetUpdate.refSentDate = new Date().toISOString().split('T')[0];
      }

      // Rule: Once vendor notified of Grey scale Model(1st pass) approval, Texture expected in T + 2 Days
      if (version.stage === 'Grey scale Model(1st pass)') {
        const in2Days = new Date();
        in2Days.setDate(in2Days.getDate() + 2);
        assetUpdate.greyScaleExpectedDate = in2Days.toISOString().split('T')[0];
      }

      await updateDoc(doc(db, "assets", assetId), assetUpdate);
      fetchAssetAndVersions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, "versions", versionId));
      const remainingVersions = versions.filter(v => v.id !== versionId);
      await syncAssetStatus(remainingVersions);
      fetchAssetAndVersions();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleStartEditVersion = (version: Version) => {
    setEditingVersionId(version.id);
    setVersionEditData(version);
  };

  const handleUpdateVersion = async () => {
    if (!editingVersionId) return;
    try {
      const version = versions.find(v => v.id === editingVersionId);
      if (!version) return;

      const perms = getActionPermissions(version);
      const updatePayload = { ...versionEditData };
      delete (updatePayload as any).id;

      if (!perms.canChangeStatus) {
        updatePayload.status = version.status;
      }

      // Sync overall status for Final Package based on split statuses
      if (version.stage === 'Final Package') {
        const mStatus = updatePayload.statusModel || "Pending Review";
        const rStatus = updatePayload.statusRig || "Pending Review";
        
        if (mStatus === "Approved" && rStatus === "Approved") {
          updatePayload.status = "Approved";
        } else if (mStatus === "Corrections Needed" || rStatus === "Corrections Needed") {
          updatePayload.status = "Corrections Needed";
        } else {
          updatePayload.status = "Pending Review";
        }

        if (updatePayload.statusModel !== version.statusModel) updatePayload.reviewedAtModel = Date.now();
        if (updatePayload.statusRig !== version.statusRig) updatePayload.reviewedAtRig = Date.now();
      }

      if (updatePayload.status !== "Pending Review" && version.status === "Pending Review") {
        updatePayload.reviewedAt = Date.now();
      }

      await updateDoc(doc(db, "versions", editingVersionId), updatePayload);

      // Slack Notification for Status Change via Edit
      if (updatePayload.status !== version.status && asset.assignedArtists?.length > 0) {
        const feedbackMsg = `\nNote: ${updatePayload.reviewNote || "None"}\nLink: ${updatePayload.reviewNoteLink || "None"}`;
        
        if (updatePayload.status === "Approved") {
          await notifyArtistsByName(
            asset.assignedArtists,
            `Stage *${version.stage}* for *${asset.name}* has been Approved!${feedbackMsg}`
          );
        } else if (updatePayload.status === "Corrections Needed") {
          await notifyArtistsByName(
            asset.assignedArtists,
            `Rework required for *${asset.name}* (Stage: ${version.stage}).${feedbackMsg}`
          );
        }
      }

      // Automation: If Ref Sent is toggled to Yes for this version, calculate Grey scale Model(1st pass) Expected for the Asset
      if (updatePayload.refSent === "Yes" && version.refSent !== "Yes") {
        const fpExpected = new Date();
        fpExpected.setDate(fpExpected.getDate() + 3);
        await updateDoc(doc(db, "assets", assetId), {
          firstPassExpectedDate: fpExpected.toISOString().split('T')[0],
          refSentDate: new Date().toISOString().split('T')[0],
          updatedAt: Date.now()
        });
      }

      const updatedVersions = versions.map(v => 
        v.id === editingVersionId ? { ...v, ...updatePayload } as Version : v
      );
      await syncAssetStatus(updatedVersions);

      setEditingVersionId(null);
      fetchAssetAndVersions();
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const handleAddReviewNote = async (versionId: string) => {
    if (!selectedReviewerId || !asset) {
      alert("Please select a reviewer.");
      return;
    }
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    const perms = getActionPermissions(version);
    const newStatus: VersionStatus = perms.canChangeStatus ? "Corrections Needed" : version.status;

    const assetUpdate: any = {
      updatedAt: Date.now(),
      reviewDueAt: null,
      vendorActionDueAt: asset.studio === 'Inhouse' ? null : Date.now() + (1 * 60 * 60 * 1000)
    };

    if (version.stage === 'Base input') assetUpdate.bmReviewedAt = Date.now();
    else if (version.stage === 'Grey scale Model(1st pass)') assetUpdate.fpReviewedAt = Date.now();
    else if (version.stage === 'Texture') assetUpdate.gsReviewedAt = Date.now();
    else if (version.stage === 'Final Package') assetUpdate.finalReviewedAt = Date.now();

    if (newStatus === "Corrections Needed") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      if (version.stage === 'Base input') assetUpdate.inputExpectedDate = tomorrowStr;
      else if (version.stage === 'Grey scale Model(1st pass)') assetUpdate.firstPassExpectedDate = tomorrowStr;
      else if (version.stage === 'Texture') assetUpdate.greyScaleExpectedDate = tomorrowStr;
      else if (version.stage === 'Final Package') assetUpdate.finalVersionExpectedDate = tomorrowStr;
    }

    await updateDoc(doc(db, "versions", versionId), {
      reviewNoteLink: reviewLink,
      reviewNote: reviewTextNote,
      status: newStatus,
      reviewerId: selectedReviewerId,
      reviewedAt: Date.now()
    });

    if (Object.keys(assetUpdate).length > 1) {
      await updateDoc(doc(db, "assets", assetId), assetUpdate);
    }

    const updatedVersions = versions.map(v => 
      v.id === versionId ? { ...v, reviewNoteLink: reviewLink, reviewNote: reviewTextNote, status: newStatus, reviewerId: selectedReviewerId } as Version : v
    );
    await syncAssetStatus(updatedVersions);

    // Slack Notification for Rework
    const feedbackMsg = `\nNote: ${reviewTextNote || "None"}\nLink: ${reviewLink || "None"}`;
    const opsMember = await getNextOpsMember();
    const artistSlackIds = teamMembers
      .filter(m => asset.assignedArtists?.includes(m.name) && m.slackId && m.active)
      .map(m => m.slackId!);
    const isOpsAlsoArtist = opsMember?.slackId && artistSlackIds.includes(opsMember.slackId);

    if (newStatus === "Corrections Needed" && asset.assignedArtists?.length > 0) {
      await notifyArtistsByName(
        asset.assignedArtists,
        `Rework required for *${asset.name}* (Stage: ${version.stage}).${feedbackMsg}${isOpsAlsoArtist && asset.studio !== 'Inhouse' ? "\n*Action: Please notify the vendor.*" : ""}`
      );
    }

    // Slack Notification for Ops (only if not already notified as artist)
    if (opsMember?.slackId && !isOpsAlsoArtist) {
      await sendSlackNotification(
        `Feedback uploaded for *${asset.name}* (${asset.studio}). Please notify the vendor.\nStage: ${version.stage}\nStatus: ${newStatus}${feedbackMsg}`,
        opsMember.slackId
      );
    }

    setReviewNoteId(null);
    setReviewLink("");
    setReviewTextNote("");
    setSelectedReviewerId("");
    fetchAssetAndVersions();
  };

  const handleOpenReviewModal = (version: Version, side?: 'Model' | 'Rig') => {
    setReviewNoteId(version.id);
    if (version.stage === 'Final Package' && side) {
      setActiveReviewSide(side);
      if (side === 'Model') {
        setSelectedReviewerId(version.reviewerModelId || "");
        setModelStatus(version.statusModel || "Pending Review");
        setReviewTextNote(version.reviewNoteModel || "");
        setReviewLink(version.reviewNoteLinkModel || "");
      } else {
        setSelectedReviewerRigId(version.reviewerRigId || "");
        setRigStatus(version.statusRig || "Pending Review");
        setReviewTextNote(version.reviewNoteRig || "");
        setReviewLink(version.reviewNoteLinkRig || "");
      }
    } else {
      setActiveReviewSide(null);
      setSelectedReviewerId(version.reviewerId || "");
      setModelStatus(version.status); 
      setReviewTextNote(version.reviewNote || "");
      setReviewLink(version.reviewNoteLink || "");
    }
  };

  const handleSaveSideReview = async (versionId: string, side: 'Model' | 'Rig', newStatus: VersionStatus) => {
    if (!asset) return;

    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    const updatePayload: any = {};
    if (side === 'Model') {
      if (!selectedReviewerId) return alert("Select Reviewer");
      updatePayload.reviewerModelId = selectedReviewerId;
      updatePayload.statusModel = newStatus;
      updatePayload.reviewNoteModel = reviewTextNote;
      updatePayload.reviewNoteLinkModel = reviewLink;
      updatePayload.reviewedAtModel = Date.now();
    } else {
      if (!selectedReviewerRigId) return alert("Select Reviewer");
      updatePayload.reviewerRigId = selectedReviewerRigId;
      updatePayload.statusRig = newStatus;
      updatePayload.reviewNoteRig = reviewTextNote;
      updatePayload.reviewNoteLinkRig = reviewLink;
      updatePayload.reviewedAtRig = Date.now();
    }

    // Determine overall status
    const mStatus = side === 'Model' ? newStatus : (version.statusModel || "Pending Review");
    const rStatus = side === 'Rig' ? newStatus : (version.statusRig || "Pending Review");
    
    let overallStatus: VersionStatus = "Pending Review";
    if (mStatus === "Approved" && rStatus === "Approved") {
      overallStatus = "Approved";
    } else if (mStatus === "Corrections Needed" || rStatus === "Corrections Needed") {
      overallStatus = "Corrections Needed";
    }
    updatePayload.status = overallStatus;

    await updateDoc(doc(db, "versions", versionId), updatePayload);

    // Sync Asset
    const assetUpdate: any = { updatedAt: Date.now(), reviewDueAt: null };
    if (overallStatus === "Corrections Needed") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      assetUpdate.finalVersionExpectedDate = tomorrow.toISOString().split('T')[0];
    }
    await updateDoc(doc(db, "assets", assetId), assetUpdate);

    const updatedVersions = versions.map(v => 
      v.id === versionId ? { ...v, ...updatePayload } as Version : v
    );
    await syncAssetStatus(updatedVersions);

    // Notification
    const opsMember = await getNextOpsMember();
    if (opsMember?.slackId) {
      await sendSlackNotification(
        `Final Package ${side} Feedback uploaded for *${asset.name}*.\nStatus: ${newStatus}\nNote: ${reviewTextNote || "None"}\nLink: ${reviewLink || "None"}`,
        opsMember.slackId
      );
    }

    setReviewNoteId(null);
    fetchAssetAndVersions();
  };

  const handleApproveVersion = async (version: Version) => {
    const perms = getActionPermissions(version);
    if (!perms.canChangeStatus || !asset) return;

    if (!selectedReviewerId && !version.reviewerId) {
       setReviewNoteId(version.id); 
       return;
    }

    const reviewerId = selectedReviewerId || version.reviewerId;
    const assetUpdate: any = { 
      updatedAt: Date.now(),
      reviewDueAt: null,
      vendorActionDueAt: asset.studio === 'Inhouse' ? null : Date.now() + (1 * 60 * 60 * 1000) 
    };

    if (version.stage === 'Base input') assetUpdate.bmReviewedAt = Date.now();
    else if (version.stage === 'Grey scale Model(1st pass)') assetUpdate.fpReviewedAt = Date.now();
    else if (version.stage === 'Texture') assetUpdate.gsReviewedAt = Date.now();
    else if (version.stage === 'Final Package') assetUpdate.finalReviewedAt = Date.now();

    if (version.stage === 'Texture') {
      const in2Days = new Date();
      in2Days.setDate(in2Days.getDate() + 2);
      assetUpdate.finalVersionExpectedDate = in2Days.toISOString().split('T')[0];
    }

    await updateDoc(doc(db, "versions", version.id), {
      status: "Approved",
      reviewerId: reviewerId,
      reviewNote: reviewTextNote, // Capture text note even on approval
      reviewedAt: Date.now()
    });

    await updateDoc(doc(db, "assets", assetId), assetUpdate);

    const updatedVersions = versions.map(v => 
      v.id === version.id ? { ...v, status: "Approved" as VersionStatus, reviewerId, reviewNote: reviewTextNote } as Version : v
    );
    await syncAssetStatus(updatedVersions);

    // Slack Notification for Approval
    const feedbackMsg = `\nNote: ${reviewTextNote || "None"}\nLink: ${reviewLink || "None"}`;
    const opsMember = await getNextOpsMember();
    const artistSlackIds = teamMembers
      .filter(m => asset.assignedArtists?.includes(m.name) && m.slackId && m.active)
      .map(m => m.slackId!);
    const isOpsAlsoArtist = opsMember?.slackId && artistSlackIds.includes(opsMember.slackId);

    if (asset.assignedArtists?.length > 0) {
      await notifyArtistsByName(
        asset.assignedArtists,
        `Stage *${version.stage}* for *${asset.name}* has been Approved!${feedbackMsg}${isOpsAlsoArtist && asset.studio !== 'Inhouse' ? "\n*Action: Please notify the vendor.*" : ""}`
      );
    }

    // Slack Notification for Ops (only if not already notified as artist)
    if (opsMember?.slackId && !isOpsAlsoArtist) {
      await sendSlackNotification(
        `Stage *${version.stage}* Approved for *${asset.name}* (${asset.studio}). Please notify the vendor.${feedbackMsg}`,
        opsMember.slackId
      );
    }

    setReviewNoteId(null);
    setReviewTextNote("");
    setSelectedReviewerId("");
    fetchAssetAndVersions();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <div className="w-10 h-10 border-2 border-orange-600/20 border-t-orange-600 rounded-full animate-spin"></div>
      <span className="text-orange-500 font-bold tracking-widest text-[10px]">Loading Asset...</span>
    </div>
  );
  
  if (!asset) return <div className="py-20 text-center font-bold text-slate-500">Asset not found</div>;

  const formatTime = (ts?: number) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const TimelineStage = ({ 
    title, exp, uploaded, reviewed, notified, isInhouse, reviewedModel, reviewedRig, 
    onMoveUp, onMoveDown, onDelete, isFirst, isLast 
  }: { 
    title: string, exp?: string, uploaded?: number, reviewed?: number, notified?: number, 
    isInhouse: boolean, reviewedModel?: number, reviewedRig?: number,
    onMoveUp?: () => void, onMoveDown?: () => void, onDelete?: () => void,
    isFirst?: boolean, isLast?: boolean
  }) => (
    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group/stage">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{title}</h4>
          <span className="text-[8px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 uppercase inline-block w-fit">
            Exp: {exp || "—"}
          </span>
        </div>
        
        {/* Stage Management Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover/stage:opacity-100 transition-opacity">
          {onMoveUp && !isFirst && (
            <button onClick={onMoveUp} className="p-1 hover:bg-white/10 rounded transition text-slate-500 hover:text-white" title="Move Left">
              <ArrowLeft className="w-3 h-3" />
            </button>
          )}
          {onMoveDown && !isLast && (
            <button onClick={onMoveDown} className="p-1 hover:bg-white/10 rounded transition text-slate-500 hover:text-white" title="Move Right">
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1 hover:bg-red-500/20 rounded transition text-slate-600 hover:text-red-500" title="Delete Stage">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Uploaded</span>
          <span className="text-[10px] font-black text-blue-400 tabular-nums">{formatTime(uploaded)}</span>
        </div>
        {title === "Final Package" && (reviewedModel || reviewedRig) ? (
          <>
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Model Review</span>
              <span className="text-[10px] font-black text-orange-400 tabular-nums">{formatTime(reviewedModel)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Rig Review</span>
              <span className="text-[10px] font-black text-orange-400 tabular-nums">{formatTime(reviewedRig)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Reviewed</span>
            <span className="text-[10px] font-black text-orange-400 tabular-nums">{formatTime(reviewed)}</span>
          </div>
        )}
        {!isInhouse && (
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Notified</span>
            <span className="text-[10px] font-black text-emerald-400 tabular-nums">{formatTime(notified)}</span>
          </div>
        )}
      </div>
      <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-white/5 rounded-full blur-2xl"></div>
    </div>
  );

  const InfoField = ({ label, name, value, type = "text" }: { label: string, name: string, value: any, type?: string }) => {
    const displayValue = isEditing && name === 'assignedArtists' && Array.isArray(value) 
      ? value.join(', ') 
      : value;

    return (
      <div className="flex flex-col gap-1 p-4 rounded-xl cinematic-glass border border-white/5">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        {isEditing ? (
          type === "select" ? (
            <select 
              value={value || ""} 
              onChange={(e) => setEditData(prev => ({ ...prev, [name]: e.target.value }))}
              className="text-xs font-bold bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-orange-500 w-full"
            >
              {name === "priority" ? (
                <>
                  <option value="Primary">Primary</option>
                  <option value="Secondary">Secondary</option>
                </>
              ) : name === "studio" ? (
                <>
                  <option value="Xentrix">Xentrix</option>
                  <option value="Innovative Colors">Innovative Colors</option>
                  <option value="Inhouse">Inhouse</option>
                  <option value="Other">Other</option>
                </>
              ) : (
                <>
                  <option value="Approved">Approved</option>
                  <option value="Rework">Rework</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </>
              )}
            </select>
          ) : (
            <input 
              type={type} 
              value={displayValue || ""} 
              onChange={(e) => setEditData(prev => ({ ...prev, [name]: e.target.value }))}
              className="text-xs font-bold bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-orange-500 w-full [color-scheme:dark]"
            />
          )
        ) : (
          name === 'masterDriveLink' && value ? (
            <a 
              href={value} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors truncate block group/link flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              VIEW SOURCE
            </a>
          ) : (
            <span className={`text-xs font-bold uppercase truncate ${value === 'Yes' || value === 'Approved' ? 'text-emerald-400' : value === 'Rework' || value === 'No' ? 'text-orange-400' : 'text-slate-100'}`}>
              {value || "—"}
            </span>
          )
        )}
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-32 px-4"
    >
      <Link href="/" className="inline-flex items-center text-[10px] font-bold text-slate-500 hover:text-orange-500 uppercase tracking-widest mb-6 transition-colors">
        <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
      </Link>

      <div className="cinematic-glass rounded-3xl p-6 mb-8 relative overflow-hidden border-white/5 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">{asset.type}</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight uppercase mb-3">{asset.name}</h1>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-white/5 rounded-full border border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{asset.status}</span>
              </div>
              
              {asset.reviewDueAt && Date.now() < asset.reviewDueAt && (
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <Clock className="w-2.5 h-2.5 text-blue-400" />
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">
                    Review Due: {Math.ceil((asset.reviewDueAt - Date.now()) / (1000 * 60))}m
                  </span>
                </div>
              )}

              {asset.vendorActionDueAt && Date.now() < asset.vendorActionDueAt && asset.studio !== 'Inhouse' && (
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <Zap className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                    Vendor Notify: {Math.ceil((asset.vendorActionDueAt - Date.now()) / (1000 * 60))}m
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDeleteAsset}
              className="p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 border border-white/10 transition-all shadow-xl"
              title="Delete Character"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={isEditing ? handleUpdateAsset : () => setIsEditing(true)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-xl ${isEditing ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'}`}
            >
              {isEditing ? <><Save className="w-3.5 h-3.5" /> Save</> : <><Edit2 className="w-3.5 h-3.5" /> Edit</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InfoField label="Studio" name="studio" value={isEditing ? editData.studio : asset.studio} type="select" />
          <InfoField label="Type" name="priority" value={isEditing ? editData.priority : asset.priority} type="select" />
          <InfoField label="Artist" name="assignedArtists" value={isEditing ? editData.assignedArtists : asset.assignedArtists?.join(", ")} />
          <InfoField label="Master Link" name="masterDriveLink" value={isEditing ? editData.masterDriveLink : asset.masterDriveLink} />
        </div>

        {isEditing && (
          <div className="flex justify-end mt-4">
            <button 
              onClick={handleUpdateAsset}
              className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-500 transition-all active:scale-[0.98]"
            >
              <Save className="w-4 h-4" /> Finalize Changes
            </button>
          </div>
        )}

        {/* Production Timeline Box */}
        <div className="mt-8 pt-8 border-t border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Production Pipeline Timeline</h3>
            </div>
            
            {/* Add Custom Stage UI */}
            <div className="flex items-center gap-2">
              <input 
                id="custom-stage-input"
                type="text"
                placeholder="CUSTOM STAGE..."
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[9px] font-bold text-white uppercase tracking-widest focus:border-orange-500 outline-none transition"
              />
              <button 
                onClick={async () => {
                  const input = document.getElementById('custom-stage-input') as HTMLInputElement;
                  const val = input.value.trim();
                  if (!val || !asset) return;
                  const updatedExtras = [...(asset.extraStages || []), val];
                  
                  const defaultPipeline = ["Base input", "Grey scale Model(1st pass)", "Texture", "Final Package"];
                  const currentOrder = asset.pipelineOrder || [...defaultPipeline, ...(asset.extraStages || [])];
                  const updatedOrder = [...currentOrder, val];

                  await updateDoc(doc(db, "assets", assetId), { 
                    extraStages: updatedExtras,
                    pipelineOrder: updatedOrder
                  });
                  input.value = "";
                  fetchAssetAndVersions();
                }}
                className="p-1.5 bg-orange-600/20 text-orange-500 border border-orange-500/20 rounded-lg hover:bg-orange-600 hover:text-white transition-all"
                title="Add Extra Stage"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {(() => {
              const defaultPipeline = ["Base input", "Grey scale Model(1st pass)", "Texture", "Final Package"];
              const pipeline = asset.pipelineOrder || [...defaultPipeline, ...(asset.extraStages || [])];
              
              return pipeline.map((stageName, idx) => {
                // Find versions for this stage
                const stageVersions = versions.filter(v => v.stage === stageName);
                const latestV = stageVersions[0];
                const firstV = stageVersions[stageVersions.length - 1];

                // Built-in field mapping
                let exp = "";
                let uploaded = firstV?.createdAt;
                let reviewed = latestV?.reviewedAt;
                let notified = undefined;
                let reviewedModel = undefined;
                let reviewedRig = undefined;

                if (stageName === "Base input") {
                  exp = asset.inputExpectedDate || "";
                  uploaded = asset.bmUploadedAt;
                  reviewed = asset.bmReviewedAt;
                  notified = asset.bmNotifiedAt;
                } else if (stageName === "Grey scale Model(1st pass)") {
                  exp = asset.firstPassExpectedDate || "";
                  uploaded = asset.fpUploadedAt;
                  reviewed = asset.fpReviewedAt;
                  notified = asset.fpNotifiedAt;
                } else if (stageName === "Texture") {
                  exp = asset.greyScaleExpectedDate || "";
                  uploaded = asset.gsUploadedAt;
                  reviewed = asset.gsReviewedAt;
                  notified = asset.gsNotifiedAt;
                } else if (stageName === "Final Package") {
                  exp = asset.finalVersionExpectedDate || "";
                  uploaded = asset.finalUploadedAt;
                  reviewed = asset.finalReviewedAt;
                  notified = asset.finalNotifiedAt;
                  reviewedModel = asset.finalReviewedAtModel;
                  reviewedRig = asset.finalReviewedAtRig;
                }

                const handleMove = async (direction: 'left' | 'right') => {
                  const newOrder = [...pipeline];
                  const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
                  [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
                  await updateDoc(doc(db, "assets", assetId), { pipelineOrder: newOrder });
                  fetchAssetAndVersions();
                };

                const handleDeleteStage = async () => {
                  if (!confirm(`Remove stage "${stageName}" from this character? This will NOT delete existing version history.`)) return;
                  const newExtras = (asset.extraStages || []).filter(s => s !== stageName);
                  const newOrder = pipeline.filter(s => s !== stageName);
                  await updateDoc(doc(db, "assets", assetId), { 
                    extraStages: newExtras,
                    pipelineOrder: newOrder
                  });
                  fetchAssetAndVersions();
                };

                return (
                  <TimelineStage 
                    key={stageName}
                    title={stageName}
                    exp={exp}
                    uploaded={uploaded}
                    reviewed={reviewed}
                    notified={notified}
                    reviewedModel={reviewedModel}
                    reviewedRig={reviewedRig}
                    isInhouse={asset.studio === 'Inhouse'}
                    isFirst={idx === 0}
                    isLast={idx === pipeline.length - 1}
                    onMoveUp={() => handleMove('left')}
                    onMoveDown={() => handleMove('right')}
                    onDelete={!defaultPipeline.includes(stageName) ? handleDeleteStage : undefined}
                  />
                );
              });
            })()}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-lg">
            <LayoutGrid className="w-4 h-4 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tight">Package History</h2>
        </div>
        <button
          onClick={() => setShowVersionForm(!showVersionForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-orange-500 transition-all shadow-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          New Version
        </button>
      </div>

      <AnimatePresence>
        {showVersionForm && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAddVersion} 
            className="cinematic-glass p-6 rounded-2xl mb-8 border-orange-500/20"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Stage</label>
                <select value={newStage} onChange={(e) => setNewStage(e.target.value as VersionStage)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-orange-500 transition">
                  <option value="Base input" className="bg-slate-900">Base input</option>
                  <option value="Grey scale Model(1st pass)" className="bg-slate-900">Grey scale Model(1st pass)</option>
                  <option value="Texture" className="bg-slate-900">Texture</option>
                  <option value="Final Package" className="bg-slate-900">Final Package</option>
                  {asset?.extraStages?.map(s => (
                    <option key={s} value={s} className="bg-slate-900">{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Drive Link</label>
                <input type="url" required value={newDriveLink} onChange={(e) => setNewDriveLink(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-orange-500 transition" placeholder="https://..." />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowVersionForm(false)} className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase hover:text-white transition">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-orange-600 text-white font-bold text-[10px] uppercase rounded-lg shadow-lg hover:bg-orange-500 transition">Upload</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="cinematic-glass rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.05] border-b border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Stage</th>
                <th className="px-6 py-4 text-center">Status</th>
                {asset.studio !== 'Inhouse' && <th className="px-6 py-4 text-center">Ref Sent</th>}
                <th className="px-6 py-4">Package Link</th>
                {asset.studio !== 'Inhouse' && <th className="px-6 py-4 text-center">Email Ref</th>}
                <th className="px-6 py-4">Review Notes</th>
                <th className="px-6 py-4 text-center">Actions</th>
                <th className="px-6 py-4 text-right">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {versions.length === 0 ? (
                <tr>
                  <td colSpan={asset.studio === 'Inhouse' ? 6 : 8} className="py-12 text-center text-slate-600 font-bold uppercase tracking-widest">No history detected</td>
                </tr>
              ) : (
                versions.map((version) => {
                  const perms = getActionPermissions(version);
                  const isEditingThis = editingVersionId === version.id;

                  return (
                    <tr key={version.id} className="group hover:bg-white/[0.02] transition-colors relative">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">V{version.versionNumber}</span>
                          {isEditingThis ? (
                            <select 
                              value={versionEditData.stage}
                              onChange={(e) => setVersionEditData({ ...versionEditData, stage: e.target.value as VersionStage })}
                              className="bg-slate-800 text-white text-[10px] font-bold p-1 rounded outline-none border border-white/10"
                            >
                              <option value="Base input">Base input</option>
                              <option value="Grey scale Model(1st pass)">Grey scale Model(1st pass)</option>
                              <option value="Texture">Texture</option>
                              <option value="Final Package">Final Package</option>
                            </select>
                          ) : (
                            <span className="font-bold text-white uppercase tracking-tight">{version.stage}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {isEditingThis ? (
                            version.stage === 'Final Package' ? (
                              <div className="flex flex-col gap-2 min-w-[120px]">
                                <div className="space-y-1">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Model</label>
                                  <select 
                                    value={versionEditData.statusModel || "Pending Review"}
                                    onChange={(e) => setVersionEditData({ ...versionEditData, statusModel: e.target.value as VersionStatus })}
                                    className="w-full bg-slate-800 text-white text-[8px] font-bold p-1 rounded outline-none border border-white/10"
                                  >
                                    <option value="Pending Review">Pending</option>
                                    <option value="Corrections Needed">Rework</option>
                                    <option value="Approved">Approved</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Rig</label>
                                  <select 
                                    value={versionEditData.statusRig || "Pending Review"}
                                    onChange={(e) => setVersionEditData({ ...versionEditData, statusRig: e.target.value as VersionStatus })}
                                    className="w-full bg-slate-800 text-white text-[8px] font-bold p-1 rounded outline-none border border-white/10"
                                  >
                                    <option value="Pending Review">Pending</option>
                                    <option value="Corrections Needed">Rework</option>
                                    <option value="Approved">Approved</option>
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <select 
                                value={versionEditData.status}
                                disabled={!perms.canChangeStatus}
                                onChange={(e) => setVersionEditData({ ...versionEditData, status: e.target.value as VersionStatus })}
                                className="bg-slate-800 text-white text-[9px] font-bold p-1 rounded outline-none border border-white/10 disabled:opacity-50"
                              >
                                <option value="Pending Review">Pending Review</option>
                                <option value="Corrections Needed">Corrections Needed</option>
                                <option value="Approved">Approved</option>
                              </select>
                            )
                          ) : version.stage === 'Final Package' && (version.statusModel || version.statusRig) ? (
                            <div className="flex flex-col gap-1">
                              <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${
                                version.statusModel === "Approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                                version.statusModel === "Corrections Needed" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : 
                                "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              }`}>
                                Model: {version.statusModel || "Pending"}
                              </div>
                              <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${
                                version.statusRig === "Approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                                version.statusRig === "Corrections Needed" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : 
                                "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              }`}>
                                Rig: {version.statusRig || "Pending"}
                              </div>
                            </div>
                          ) : (
                            <div className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border ${
                              version.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                              version.status === "Corrections Needed" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : 
                              "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}>
                              {version.status}
                            </div>
                          )}
                          {!perms.canChangeStatus && !isEditingThis && (
                            <span className="text-[7px] text-slate-600 font-bold uppercase tracking-tighter flex items-center gap-1">
                              <Lock className="w-2 h-2" /> {perms.reason}
                            </span>
                          )}
                        </div>
                      </td>
                      {asset.studio !== 'Inhouse' && (
                        <td className="px-6 py-4 text-center">
                          {version.refSent === 'Yes' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle className="w-2.5 h-2.5" /> SENT
                            </div>
                          ) : version.status === 'Approved' ? (
                            <button 
                              onClick={() => handleMarkSent(version)}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-orange-600 text-white hover:bg-orange-500 transition-all shadow-lg"
                            >
                              <Zap className="w-2.5 h-2.5" /> Mark Sent
                            </button>
                          ) : (
                            <div className="text-[8px] font-black text-slate-700 uppercase tracking-widest opacity-40">
                              Awaiting Approval
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        {isEditingThis ? (
                          <input 
                            type="url"
                            value={versionEditData.driveLink}
                            onChange={(e) => setVersionEditData({ ...versionEditData, driveLink: e.target.value })}
                            className="bg-slate-800 text-white text-[10px] p-1.5 rounded w-full border border-white/10"
                          />
                        ) : (
                          <a href={version.driveLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-orange-500 hover:text-orange-400 font-bold uppercase text-[9px] tracking-widest">
                            <ExternalLink className="w-3 h-3" /> Package
                          </a>
                        )}
                      </td>
                      {asset.studio !== 'Inhouse' && (
                        <td className="px-6 py-4 text-center">
                          {isEditingThis ? (
                            <input 
                              type="url"
                              value={versionEditData.emailLink || ""}
                              onChange={(e) => setVersionEditData({ ...versionEditData, emailLink: e.target.value })}
                              className="bg-slate-800 text-white text-[9px] p-1 rounded border border-white/10 w-full"
                              placeholder="Email Link"
                            />
                          ) : version.emailLink ? (
                            <a href={version.emailLink} target="_blank" className="text-blue-400 hover:text-blue-300">
                              <ExternalLink className="w-3.5 h-3.5 mx-auto" />
                            </a>
                          ) : (
                            <span className="text-slate-800">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        {isEditingThis ? (
                          <div className="space-y-2">
                            {version.stage === 'Final Package' ? (
                              <>
                                <div className="space-y-1">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Model Reviewer</label>
                                  <select 
                                    value={versionEditData.reviewerModelId || ""}
                                    onChange={(e) => setVersionEditData({ ...versionEditData, reviewerModelId: e.target.value })}
                                    className="w-full bg-slate-800 text-white text-[8px] font-bold p-1 rounded outline-none border border-white/10"
                                  >
                                    <option value="">Select Reviewer</option>
                                    {teamMembers.filter(m => m.role === 'Reviewer' && m.reviewerExpertise?.includes('Model/Texture')).map(m => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[7px] font-black text-slate-500 uppercase">Rig Reviewer</label>
                                  <select 
                                    value={versionEditData.reviewerRigId || ""}
                                    onChange={(e) => setVersionEditData({ ...versionEditData, reviewerRigId: e.target.value })}
                                    className="w-full bg-slate-800 text-white text-[8px] font-bold p-1 rounded outline-none border border-white/10"
                                  >
                                    <option value="">Select Reviewer</option>
                                    {teamMembers.filter(m => m.role === 'Reviewer' && m.reviewerExpertise?.includes('Rig/Animation')).map(m => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </>
                            ) : (
                              <>
                                <textarea 
                                  value={versionEditData.reviewNote || ""}
                                  onChange={(e) => setVersionEditData({ ...versionEditData, reviewNote: e.target.value })}
                                  className="bg-slate-800 text-white text-[10px] p-1.5 rounded w-full border border-white/10 resize-none"
                                  placeholder="Text Note..."
                                  rows={2}
                                />
                                <input 
                                  type="url" 
                                  value={versionEditData.reviewNoteLink || ""}
                                  onChange={(e) => setVersionEditData({ ...versionEditData, reviewNoteLink: e.target.value })}
                                  className="bg-slate-800 text-white text-[10px] p-1.5 rounded w-full border border-white/10"
                                  placeholder="Link (Optional)"
                                />
                                <select 
                                  value={versionEditData.reviewerId || ""}
                                  onChange={(e) => setVersionEditData({ ...versionEditData, reviewerId: e.target.value })}
                                  className="bg-slate-800 text-white text-[10px] p-1.5 rounded w-full border border-white/10"
                                >
                                  <option value="">Select Reviewer</option>
                                  {teamMembers.filter(m => m.role === 'Reviewer' && (!m.reviewerStages || m.reviewerStages.includes(version.stage))).map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                              </>
                            )}
                          </div>
                        ) : version.stage === 'Final Package' ? (
                          <div className="flex flex-col gap-3 min-w-[220px]">
                            {/* Model Section */}
                            <div className="space-y-1 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Model & Texture</span>
                                {version.reviewerModelId && (
                                  <span className="text-[7px] text-slate-400 font-bold flex items-center gap-1">
                                    <UserIcon className="w-2 h-2" /> {teamMembers.find(m => m.id === version.reviewerModelId)?.name || "Unknown"}
                                  </span>
                                )}
                              </div>
                              {version.reviewNoteModel && <p className="text-[9px] text-slate-300 italic">"{version.reviewNoteModel}"</p>}
                              {version.reviewNoteLinkModel && (
                                <a href={version.reviewNoteLinkModel} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[8px] font-bold uppercase">
                                  <FileText className="w-2 h-2" /> Link
                                </a>
                              )}
                              {version.statusModel !== 'Approved' && (
                                <button onClick={() => handleOpenReviewModal(version, 'Model')} disabled={!perms.canChangeStatus} className="block text-blue-400 hover:text-blue-300 font-bold uppercase text-[7px] tracking-widest mt-1">
                                  {version.reviewNoteModel ? 'Update Model' : 'Add Model Feedback'}
                                </button>
                              )}
                            </div>

                            {/* Rig Section */}
                            <div className="space-y-1 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Rig & Animation</span>
                                {version.reviewerRigId && (
                                  <span className="text-[7px] text-slate-400 font-bold flex items-center gap-1">
                                    <UserIcon className="w-2 h-2" /> {teamMembers.find(m => m.id === version.reviewerRigId)?.name || "Unknown"}
                                  </span>
                                )}
                              </div>
                              {version.reviewNoteRig && <p className="text-[9px] text-slate-300 italic">"{version.reviewNoteRig}"</p>}
                              {version.reviewNoteLinkRig && (
                                <a href={version.reviewNoteLinkRig} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[8px] font-bold uppercase">
                                  <FileText className="w-2 h-2" /> Link
                                </a>
                              )}
                              {version.statusRig !== 'Approved' && (
                                <button onClick={() => handleOpenReviewModal(version, 'Rig')} disabled={!perms.canChangeStatus} className="block text-blue-400 hover:text-blue-300 font-bold uppercase text-[7px] tracking-widest mt-1">
                                  {version.reviewNoteRig ? 'Update Rig' : 'Add Rig Feedback'}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 max-w-[200px]">
                            {/* Feedback Section */}
                            {(version.reviewNote || version.reviewNoteLink) && (
                              <div className="mb-1 space-y-1">
                                {version.reviewNote && (
                                  <p className="text-[10px] text-slate-300 leading-tight italic break-words">"{version.reviewNote}"</p>
                                )}
                                {version.reviewNoteLink && (
                                  <a href={version.reviewNoteLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-bold uppercase text-[9px] tracking-widest">
                                    <FileText className="w-3 h-3" /> External Note
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Assigned Reviewer Section */}
                            <div className="space-y-0.5 border-t border-white/5 pt-1.5">
                              {version.reviewerId && (
                                <span className="text-[7px] text-slate-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                                  <UserIcon className="w-2.5 h-2.5" /> {teamMembers.find(m => m.id === version.reviewerId)?.name || "Unknown"}
                                </span>
                              )}
                              
                              {/* Add Feedback Button (If not Approved) */}
                              {version.status !== 'Approved' && (
                                <button onClick={() => handleOpenReviewModal(version)} disabled={!perms.canChangeStatus} className="text-blue-400 hover:text-blue-300 font-bold uppercase text-[8px] tracking-widest flex items-center gap-1 disabled:opacity-30 mt-1 transition-colors">
                                  <MessageSquare className="w-2.5 h-2.5" /> {version.reviewNote || version.reviewNoteLink ? 'Update Feedback' : 'Add Feedback'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          {isEditingThis ? (
                            <>
                              <button onClick={handleUpdateVersion} className="p-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition"><Save className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingVersionId(null)} className="p-1.5 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              {version.status !== "Approved" && version.stage !== 'Final Package' && perms.canChangeStatus && (
                                <button onClick={() => handleApproveVersion(version)} title="Approve" className="p-1.5 bg-emerald-600/10 text-emerald-500 rounded-lg hover:bg-emerald-600 hover:text-white transition"><CheckCircle className="w-3.5 h-3.5" /></button>
                              )}
                              <button onClick={() => handleStartEditVersion(version)} title="Edit" className="p-1.5 bg-white/5 text-slate-500 rounded-lg hover:text-white hover:bg-white/10 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteVersion(version.id)} title="Delete" className="p-1.5 bg-red-900/10 text-red-900/50 rounded-lg hover:bg-red-600 hover:text-white transition"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-[9px] font-bold text-slate-600 font-mono">{new Date(version.createdAt).toLocaleDateString()}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {reviewNoteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {(() => {
              const currentVersion = versions.find(v => v.id === reviewNoteId);
              return (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                    onClick={() => setReviewNoteId(null)} 
                  />
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="flex flex-col gap-4 p-5 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-[400px] relative z-10"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Review Submission</span>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                          {currentVersion?.stage} {activeReviewSide ? `(${activeReviewSide} Side)` : ''}
                        </p>
                      </div>
                      <button onClick={() => setReviewNoteId(null)} className="text-slate-500 hover:text-white transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
              
              <div className="space-y-4">
                {/* Standard Reviewer (non-Final Package) or Model/Texture Reviewer (Final Package) */}
                {(!currentVersion || currentVersion.stage !== 'Final Package' || activeReviewSide === 'Model') && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      {currentVersion?.stage === 'Final Package' ? 'Model & Texture Reviewer' : 'Lead Reviewer'}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedReviewerId}
                        disabled={modelStatus === 'Approved' && currentVersion?.statusModel === 'Approved'}
                        onChange={(e) => setSelectedReviewerId(e.target.value)}
                        className="flex-1 bg-white/5 text-white text-xs font-bold p-2.5 rounded-xl border border-white/10 focus:border-orange-500 outline-none transition disabled:opacity-50"
                      >
                        <option value="" className="bg-slate-900">Select Reviewer</option>
                        {teamMembers.filter(m => {
                          if (!m.active || m.role !== 'Reviewer') return false;
                          const stage = currentVersion?.stage;
                          const stageMatch = !m.reviewerStages || m.reviewerStages.includes(stage as any);
                          if (!stageMatch) return false;
                          if (stage === 'Final Package') return m.reviewerExpertise?.includes('Model/Texture');
                          return true;
                        }).map(m => (
                          <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Rig & Animation Reviewer (Final Package Only) */}
                {currentVersion?.stage === 'Final Package' && activeReviewSide === 'Rig' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Rig & Animation Reviewer</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedReviewerRigId}
                        onChange={(e) => setSelectedReviewerRigId(e.target.value)}
                        className="flex-1 bg-white/5 text-white text-xs font-bold p-2.5 rounded-xl border border-white/10 focus:border-orange-500 outline-none transition"
                      >
                        <option value="" className="bg-slate-900">Select Reviewer</option>
                        {teamMembers.filter(m => {
                          if (!m.active || m.role !== 'Reviewer') return false;
                          const stage = currentVersion?.stage;
                          const stageMatch = !m.reviewerStages || m.reviewerStages.includes(stage as any);
                          if (!stageMatch) return false;
                          if (stage === 'Final Package') return m.reviewerExpertise?.includes('Rig/Animation');
                          return true;
                        }).map(m => (
                          <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Feedback & Reference</label>
                  <textarea 
                    value={reviewTextNote} 
                    onChange={(e) => setReviewTextNote(e.target.value)} 
                    className="w-full bg-white/5 text-white text-xs p-3 rounded-xl border border-white/10 resize-none focus:border-orange-500 outline-none transition" 
                    placeholder="Quick feedback note..." 
                    rows={2}
                  />
                  <input 
                    type="url" 
                    value={reviewLink} 
                    onChange={(e) => setReviewLink(e.target.value)} 
                    className="w-full bg-white/5 text-white text-[10px] p-2.5 rounded-xl border border-white/10 focus:border-orange-500 outline-none transition" 
                    placeholder="Review Note Link" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {currentVersion?.stage === 'Final Package' ? (
                  <>
                    <button
                      onClick={() => {
                        if (activeReviewSide) handleSaveSideReview(reviewNoteId!, activeReviewSide, 'Corrections Needed');
                      }}
                      className="py-3 bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-500/10 hover:text-orange-500 transition-all border border-white/10"
                    >
                      Rework {activeReviewSide}
                    </button>
                    <button
                      onClick={() => {
                        if (activeReviewSide) handleSaveSideReview(reviewNoteId!, activeReviewSide, 'Approved');
                      }}
                      className="py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
                    >
                      Approve {activeReviewSide}
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => handleAddReviewNote(reviewNoteId)} 
                      className="py-2.5 bg-orange-600/20 border border-orange-500/50 text-orange-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-lg shadow-orange-900/10"
                    >
                      Correction
                    </button>
                    <button 
                      onClick={() => {
                        if (currentVersion) handleApproveVersion(currentVersion);
                      }} 
                      className="py-2.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>

              
                    <button 
                      onClick={async () => {
                        const sideField = activeReviewSide === 'Model' ? 'reviewNoteModel' : (activeReviewSide === 'Rig' ? 'reviewNoteRig' : 'reviewNote');
                        const linkField = activeReviewSide === 'Model' ? 'reviewNoteLinkModel' : (activeReviewSide === 'Rig' ? 'reviewNoteLinkRig' : 'reviewNoteLink');
                        const revField = activeReviewSide === 'Rig' ? 'reviewerRigId' : (currentVersion?.stage === 'Final Package' ? 'reviewerModelId' : 'reviewerId');
                        
                        if (!reviewNoteId) return;
                        await updateDoc(doc(db, "versions", reviewNoteId), {
                          [sideField]: reviewTextNote,
                          [linkField]: reviewLink,
                          [revField]: activeReviewSide === 'Rig' ? selectedReviewerRigId : selectedReviewerId
                        });
                        setReviewNoteId(null);
                        fetchAssetAndVersions();
                      }}
                      className="w-full py-2 bg-white/5 text-slate-400 text-[8px] font-bold uppercase tracking-widest rounded-lg border border-white/5 hover:bg-white/10 transition-all"
                    >
                      Save Note Only
                    </button>
                  </motion.div>
                </>
              );
            })()}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
