import * as ImagePicker from 'expo-image-picker';

import { api, intents } from '@/api';
import {
  completeEvidenceUpload,
  EVIDENCE_BUCKET,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_TYPES,
  startEvidenceUpload,
  type EvidenceType,
} from '@/api/endpoints/care';
import { supabase } from '@/lib/supabase';

// A photo for the safety team after SOS (docs/spec/03-screens.md §7.14). Upload goes straight to private storage
// through a signed URL the server issued for a path it chose; the server then verifies the file itself.

export type EvidenceOutcome = 'added' | 'cancelled' | 'denied' | 'tooLarge' | 'failed';

export async function addEvidencePhoto(incidentId: string, source: 'camera' | 'library'): Promise<EvidenceOutcome> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return 'denied';
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false, allowsEditing: false };
  const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return 'cancelled';

  const contentType: EvidenceType = (EVIDENCE_TYPES as readonly string[]).includes(asset.mimeType ?? '')
    ? (asset.mimeType as EvidenceType)
    : 'image/jpeg';

  try {
    const bytes = await (await fetch(asset.uri)).arrayBuffer();
    if (bytes.byteLength === 0) return 'failed';
    if (bytes.byteLength > EVIDENCE_MAX_BYTES) return 'tooLarge';

    const intent = `evidence:${incidentId}:${asset.uri}`;
    const slot = await intents().run(`${intent}:slot`, (key) => startEvidenceUpload(api(), incidentId, contentType, key));
    const { error } = await supabase().storage.from(EVIDENCE_BUCKET).uploadToSignedUrl(slot.path, slot.token, bytes, { contentType });
    if (error) return 'failed';
    await intents().run(`${intent}:complete`, (key) => completeEvidenceUpload(api(), incidentId, { path: slot.path, contentType }, key));
    return 'added';
  } catch {
    return 'failed';
  }
}
