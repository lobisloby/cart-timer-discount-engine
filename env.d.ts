/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** Public Crisp inbox id from https://app.crisp.chat/settings/website/ingamechat/ */
    CRISP_WEBSITE_ID?: string;
  }
}
