// Shared types for the GPS903 discovery page and its client components.
// No directives — importable from both server and client.

export interface LinkedCase {
  gpsDeviceId: string;
  caseId:      string;
  caseNumber:  string;
  agentId:     string | null;
  agentName:   string | null;
  agentCode:   string | null;
}

export interface EnrichedDevice {
  credentialId: string;        // gps903_credentials.id (replaces old catalog id)
  gps903Id:     number | null; // gps903_credentials.gps903_device_id
  deviceName:   string;        // gps903_credentials.device_name
  imei:         string;
  phoneNumber:  string | null; // from credential directly
  provider:     string | null; // from credential directly
  lastSynced:   string | null; // gps903_credentials.last_synced_at
  lastSyncOk:   boolean | null;
  linkedCases:  LinkedCase[];
}

export interface CaseOption  { id: string; case_number: string }
export interface AgentOption { id: string; full_name: string; agent_code: string }
