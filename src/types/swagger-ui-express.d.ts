declare module "swagger-ui-express" {
  import { RequestHandler } from "express";

  interface SwaggerUiOptions {
    swaggerOptions?: {
      url?: string;
      spec?: Record<string, any>;
      persistAuthorization?: boolean;
      oauth?: {
        clientId?: string;
        clientSecret?: string;
        realm?: string;
        appName?: string;
        scopeSeparator?: string;
        additionalQueryStringParams?: Record<string, string>;
      };
    };
    customCss?: string;
    customCssUrl?: string;
    customJs?: string;
    customfavIcon?: string;
    swaggerUrl?: string;
    url?: string;
    urls?: Array<{ url: string; name: string }>;
    layout?: string;
    deepLinking?: boolean;
    displayOperationId?: boolean;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    filter?: boolean | string;
    validatorUrl?: string;
    oauth2RedirectUrl?: string;
    initOAuth?: object;
    customSiteTitle?: string;
  }

  interface SwaggerUiApi {
    serve: RequestHandler[];
    setup(
      spec: Record<string, any>,
      options?: SwaggerUiOptions,
    ): RequestHandler;
  }

  const swaggerUi: SwaggerUiApi;
  export default swaggerUi;
}
