// Advisory position checks; permission and attendance authority stay on the server.
export function distanceMetres(a, b) {
  const lat1 = Number(a?.latitude),
    lng1 = Number(a?.longitude),
    lat2 = Number(b?.latitude),
    lng2 = Number(b?.longitude);
  if (
    [a?.latitude, a?.longitude, b?.latitude, b?.longitude].some(
      (v) => v == null || v === "",
    ) ||
    ![lat1, lng1, lat2, lng2].every(Number.isFinite)
  )
    return null;
  const rad = (n) => (n * Math.PI) / 180;
  const dlat = rad(lat2 - lat1),
    dlng = rad(lng2 - lng1);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
