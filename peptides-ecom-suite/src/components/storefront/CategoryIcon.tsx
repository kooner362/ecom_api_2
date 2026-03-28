import { icons } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CategoryIconProps {
  name: string;
  size?: number;
  className?: string;
}

export default function CategoryIcon({ name, size = 18, className }: CategoryIconProps) {
  const LucideIcon = (icons as Record<string, LucideIcon>)[name] ?? icons.FlaskConical;
  return <LucideIcon size={size} className={className} />;
}
