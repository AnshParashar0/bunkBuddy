export type Availability = 'available' | 'busy' | 'maybe' | 'in_class';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Profile {
  id: string; name: string; photo_url: string | null; college_id: string | null;
  course: string | null; department: string | null; year: number | null; student_id: string | null;
  verification_status: VerificationStatus; availability_status: Availability; availability_until: string | null;
  bio: string | null; interests: string[]; role: 'student' | 'admin'; suspended: boolean; flagged: boolean;
}
export interface PublicProfile {
  id: string; name: string; photo_url: string | null; course: string | null; department: string | null;
  year: number | null; bio: string | null; interests: string[]; verified: boolean;
}
export interface College { id: string; name: string; location: string | null; domain: string | null; verification_method: string; status: 'active' | 'inactive' }
export interface InboxItem { request_id: string; recipient_id: string; activity: string; duration_minutes: number; expires_at: string }
export interface BunkRequest { id: string; user_id: string; activity: string; duration_minutes: number; status: 'open' | 'matched' | 'expired' | 'cancelled'; expires_at: string }
export interface Match { id: string; request_id: string; user1_id: string; user2_id: string; status: 'active' | 'ended'; meeting_spot: string | null; created_at: string }
export interface Message { id: string; match_id: string; sender_id: string; message: string; created_at: string }
