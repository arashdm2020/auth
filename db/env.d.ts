declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    AUTHORIZED_WALLET_ADDRESS?: string;
    AUTHORIZED_AMOUNT?: string;
    AUTHORIZED_ASSET?: string;
    AUTHORIZED_REFERENCE?: string;
    AUTHORIZED_WALLETS_JSON?: string;
    BASE_WALLET_ADDRESS?: string;
    TRONGRID_API_KEY?: string;
    TRONGRID_BASE_URL?: string;
    ADMIN_ACCESS_TOKEN?: string;
  }
}
