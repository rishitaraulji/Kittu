import { collection, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';

export const relationshipIdFor = (userIdA: string, userIdB: string) => [userIdA, userIdB].sort().join('_');

export const relationshipDocRef = (relationshipId: string) => doc(db, 'relationships', relationshipId);

export const relationshipMoodsRef = (relationshipId: string) => collection(db, 'relationships', relationshipId, 'moods');

export const relationshipNotesRef = (relationshipId: string) => doc(db, 'relationships', relationshipId, 'notes', 'shared');

export const relationshipEventsRef = (relationshipId: string) => collection(db, 'relationships', relationshipId, 'events');

export const relationshipEmergencyRef = (relationshipId: string) => collection(db, 'relationships', relationshipId, 'emergency');

export const relationshipCanvasStrokesRef = (relationshipId: string) => collection(db, 'relationships', relationshipId, 'canvas', 'shared', 'strokes');

export const relationshipCanvasStrokesQuery = (relationshipId: string) =>
  query(relationshipCanvasStrokesRef(relationshipId), orderBy('timestamp', 'asc'));

export type RelationshipMood = {
  id: string;
  emoji: string;
  label: string;
  updatedAt?: number | null;
  userId?: string;
};

export type RelationshipNote = {
  text: string;
  updatedAt?: number | null;
  updatedBy?: string | null;
};

export type RelationshipEvent = {
  id: string;
  title: string;
  emoji: string;
  note?: string;
  eventDate: number;
  createdAt?: number | null;
  createdBy?: string | null;
  category?: 'love' | 'anniversary' | 'first_meet' | 'promise' | 'custom';
};

export type RelationshipEmergency = {
  id: string;
  text: string;
  from: string;
  createdAt?: number | null;
  acknowledgedAt?: number | null;
};

export type RelationshipCanvasStroke = {
  id?: string;
  action: 'point' | 'clear';
  strokeId?: string;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  timestamp: number;
  userId: string;
  isEraser?: boolean;
};