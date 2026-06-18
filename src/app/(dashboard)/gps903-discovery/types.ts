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
  id:          string;
  gps903Id:    number;
  deviceName:  string | null;
  imei:        string | null;
  model:       string | null;
  lastSeen:    string | null;
  syncedAt:    string;
  linkedCases: LinkedCase[];
}

export interface CaseOption  { id: string; case_number: string }
export interface AgentOption { id: string; full_name: string; agent_code: string }
