export interface Subdomain {
  subdomain: string;
  token: string;
  createdAt: string;
  email?: string;
  description?: string;
}

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
  created_on?: string;
  modified_on?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
