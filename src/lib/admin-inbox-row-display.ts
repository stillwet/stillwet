export function stripInboxHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatInboxReceived(iso: string): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateLine: "—", timeLine: "" };
  }
  const dateLine = `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return { dateLine, timeLine: `${hours}:${minutes}${ampm}` };
}

export function inboxEmailBody(textBody: string | null, htmlBody: string | null): string {
  const text = textBody?.trim();
  if (text) return text;
  const html = htmlBody?.trim();
  if (html) return stripInboxHtml(html);
  return "—";
}
