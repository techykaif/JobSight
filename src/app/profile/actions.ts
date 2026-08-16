'use server'

import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';

export async function getProfiles() {
  const userId = await getCurrentUserId();
  return db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
}

export async function getProfile(id: string) {
  const userId = await getCurrentUserId();
  const result = await db.select()
    .from(schema.profiles)
    .where(and(eq(schema.profiles.id, id), eq(schema.profiles.userId, userId)))
    .limit(1);
  return result[0] || null;
}

export async function saveProfile(formData: FormData) {
  const userId = await getCurrentUserId();
  const profileId = formData.get('id')?.toString() || crypto.randomUUID();
  
  const rawSkills = formData.get('skills')?.toString() || '';
  const skills = rawSkills.split(',').map(s => s.trim()).filter(Boolean);

  const rawProjectExperience = formData.get('projectExperience')?.toString() || '';
  const projectExperience = rawProjectExperience.split(',').map(s => s.trim()).filter(Boolean);

  const rawTargetRoles = formData.get('targetRoles')?.toString() || '';
  const targetRoles = rawTargetRoles.split(',').map(s => s.trim()).filter(Boolean);
  
  const data = {
    id: profileId,
    userId,
    name: formData.get('name')?.toString() || 'Candidate',
    yearsOfProfessionalExperience: parseInt(formData.get('yearsOfProfessionalExperience')?.toString() || '0', 10),
    education: formData.get('education')?.toString() || null,
    targetRoles,
    skills,
    projectExperience,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Enforce ownership: only update if userId matches, or insert if new
  const existing = await db.select({ id: schema.profiles.id, userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profileId))
    .limit(1);
    
  if (existing[0] && existing[0].userId !== userId) {
    throw new Error('Unauthorized');
  }

  await db.insert(schema.profiles)
    .values(data)
    .onConflictDoUpdate({
      target: schema.profiles.id,
      set: {
        name: data.name,
        yearsOfProfessionalExperience: data.yearsOfProfessionalExperience,
        education: data.education,
        targetRoles: data.targetRoles,
        skills: data.skills,
        projectExperience: data.projectExperience,
        updatedAt: data.updatedAt
      }
    });

  return { success: true };
}

export async function deleteProfile(id: string) {
  const userId = await getCurrentUserId();
  
  const existing = await db.select({ id: schema.profiles.id, userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, id))
    .limit(1);
    
  if (!existing[0]) return { success: false, error: 'Not found' };
  if (existing[0].userId !== userId) throw new Error('Unauthorized');
  
  await db.delete(schema.profiles).where(eq(schema.profiles.id, id));
  return { success: true };
}

export async function extractProfileFromInput(formData: FormData) {
  const _userId = await getCurrentUserId(); // Ensure authenticated
  
  const textInput = formData.get('pastedText')?.toString();
  const fileInput = formData.get('resumeFile') as File | null;
  
  let rawText = '';
  let sourceType = '';
  
  if (textInput && textInput.trim().length > 0) {
    rawText = textInput.trim();
    sourceType = 'PASTED_TEXT';
  } else if (fileInput && fileInput.size > 0) {
    const buffer = Buffer.from(await fileInput.arrayBuffer());
    // Use dynamic import or existing parser
    const { extractTextFromBuffer } = await import('@/lib/profile/parser.js');
    
    // Validate mime type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(fileInput.type)) {
      throw new Error(`Unsupported file type: ${fileInput.type}`);
    }
    
    const parsed = await extractTextFromBuffer(buffer, fileInput.type as any);
    rawText = parsed.text;
    sourceType = parsed.sourceType;
  } else {
    throw new Error('No valid text or file provided.');
  }

  // Prevent enormous extractions that could blow up the prompt
  if (rawText.length > 50000) {
    rawText = rawText.substring(0, 50000);
  }

  const { extractStructuredProfile } = await import('@/lib/profile/extractor.js');
  const extracted = await extractStructuredProfile(rawText);
  
  return {
    success: true,
    sourceType,
    extracted
  };
}
