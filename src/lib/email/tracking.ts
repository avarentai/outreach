import { textToHtml } from "@/lib/email";

export function trackedHtml(text: string, messageId: string, appUrl = process.env.APP_URL) {
  let html = textToHtml(text);
  if (!appUrl) return html;
  const base = appUrl.replace(/\/$/, "");
  html = html.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const clean = url.replace(/[),.;]+$/, "");
    const trailing = url.slice(clean.length);
    const href = `${base}/api/track/click/${encodeURIComponent(messageId)}?url=${encodeURIComponent(clean)}`;
    return `<a href="${href}">${clean}</a>${trailing}`;
  });
  return `${html}<img src="${base}/api/track/open/${encodeURIComponent(messageId)}.gif" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0" />`;
}
