export const ticketOrigin = "https://opencurtainplayers.ludus.com";
export const ticketUrl = `${ticketOrigin}/index.php?show_id=200545825`;
export const ticketEmbedUrl = `${ticketOrigin}/embed/index.php?widget=1&show_id=200545825&sections=events&category_id=&hideNav=true`;

export function getTicketHeight(data) {
  if (typeof data !== "string") return null;
  const match = /^resize::(\d{1,5})$/.exec(data);
  if (!match) return null;
  const height = Number(match[1]);
  return height >= 350 && height <= 12000 ? height : null;
}

export function isTicketMessage(event, frameWindow) {
  return (
    frameWindow != null &&
    event.origin === ticketOrigin &&
    event.source === frameWindow
  );
}
