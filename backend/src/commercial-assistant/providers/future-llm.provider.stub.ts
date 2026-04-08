/**
 * Ponto de extensão para integração futura com LLM (OpenAI, Anthropic, etc.).
 *
 * 1. Implemente `CommercialMessageProvider` (ver `commercial-assistant.types.ts`)
 *    chamando a API externa com `CommercialMessageContext` serializado em JSON.
 * 2. Registre no `CommercialAssistantModule` com useClass / useFactory,
 *    e injete no `CommercialAssistantService` para substituir ou combinar com
 *    o compositor baseado em templates (`commercial-message.composer.ts`).
 *
 * Mantenha o compositor de templates como fallback offline e para custo zero.
 */

export const COMMERCIAL_MESSAGE_PROVIDER = Symbol('COMMERCIAL_MESSAGE_PROVIDER');
