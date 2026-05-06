// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFriendlyError(error: any): string {
  const message = error?.message || error?.toString() || "";

  if (message.includes("529") || message.toLowerCase().includes("overloaded")) {
    return "Our AI is taking a short break — servers are busy right now. This usually resolves in 2-3 minutes. Please try again shortly.";
  }
  if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
    return "You have used all 5 free generations this month. Upgrade to Premium for unlimited access.";
  }
  if (message.toLowerCase().includes("timeout") || message.includes("ECONNRESET")) {
    return "Connection timed out. Please check your internet connection and try again.";
  }
  if (message.includes("401") || message.toLowerCase().includes("authentication")) {
    return "Service temporarily unavailable. Our team has been notified. Please try again in a few minutes.";
  }
  if (message.includes("500") || message.toLowerCase().includes("internal")) {
    return "Something went wrong on our end. Please try again in a moment.";
  }
  return "Something went wrong. Please try again. If the problem continues, contact support at gyaanmitra.com/about";
}
