export function handleApiError(error: any): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      return parsed.detail || error.message;
    } catch {
      return error.message;
    }
  }
  return "An unexpected error occurred";
}

export async function confirmAction(message: string): Promise<boolean> {
  return window.confirm(message);
}
