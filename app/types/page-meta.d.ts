declare module '#app' {
  interface PageMeta {
    requiredPermission?: {
      resource: string;
      action: string;
    };
    requireAdmin?: boolean;
  }
}

export {};
