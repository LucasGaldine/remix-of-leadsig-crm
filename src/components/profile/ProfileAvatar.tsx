import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ProfileAvatarProps = {
  avatarUrl?: string | null;
  fullName?: string | null;
  fallbackText?: string;
  className?: string;
  focusX?: number | null;
  focusY?: number | null;
};

const clampFocus = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const getInitials = (name?: string | null) => {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export function ProfileAvatar({
  avatarUrl,
  fullName,
  fallbackText,
  className,
  focusX,
  focusY,
}: ProfileAvatarProps) {
  const x = clampFocus(focusX);
  const y = clampFocus(focusY);
  const initials = fallbackText || getInitials(fullName);

  return (
    <Avatar className={className}>
      {avatarUrl ? (
        <AvatarImage
          src={avatarUrl}
          alt={fullName || "User"}
          className="h-full w-full object-cover"
          style={{ objectPosition: `${x}% ${y}%` }}
        />
      ) : null}
      <AvatarFallback className="bg-primary/10 text-primary">
        {avatarUrl ? initials : <User className="h-1/2 w-1/2 text-muted-foreground" />}
      </AvatarFallback>
    </Avatar>
  );
}
