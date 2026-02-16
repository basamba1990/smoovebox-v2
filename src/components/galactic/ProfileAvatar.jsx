import React from "react";
import { getPublicUrl } from "../../lib/storageUtils.js";

/**
 * Reusable profile avatar with storage URL resolution and fallbacks.
 * Use wherever you display a user's avatar (galactic map, connections, chat).
 */
function ProfileAvatar({ profile, size = 48, className = "" }) {
  const fallback =
    profile?.sex === "female"
      ? "/default-avatars/female.png"
      : profile?.sex === "male"
        ? "/default-avatars/male.png"
        : "/default-avatars/neutral.png";

  const src = React.useMemo(() => {
    if (!profile?.avatar_url) return fallback;
    if (profile.avatar_url.startsWith("http")) return profile.avatar_url;
    return getPublicUrl(profile.avatar_url, "avatars") || fallback;
  }, [profile?.avatar_url, fallback]);

  return (
    <img
      src={src}
      alt={profile?.full_name || "Utilisateur"}
      className={`rounded-full object-cover border-2 border-blue-200 ${className}`}
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.src = fallback;
      }}
    />
  );
}

export default ProfileAvatar;
