export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  default_llm_provider: string | null;
  default_llm_model: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
