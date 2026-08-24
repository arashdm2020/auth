declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL?: string;
    DATABASE_URL_UNPOOLED?: string;
    POSTGRES_PRISMA_URL?: string;
    POSTGRES_URL_NON_POOLING?: string;
    POSTGRES_URL?: string;
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
