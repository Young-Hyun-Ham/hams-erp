export type WorkspaceAction = (
  body: Record<string, unknown>,
  message: string,
) => Promise<boolean>;
